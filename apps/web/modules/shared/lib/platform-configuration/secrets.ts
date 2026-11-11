import "server-only";
import {createCipheriv,createDecipheriv,hkdfSync,randomBytes} from "node:crypto";
import {z} from "zod";
import type {ConfigurationEnvironment,ConfigurationSection} from "./model";

export type ConfigurationSecretContext={environment:ConfigurationEnvironment;section:ConfigurationSection;revisionId:string};
function master(value=process.env.APP_ENCRYPTION_KEY):Buffer{
  if(!value||value.length>256)throw new Error("ENCRYPTION_NOT_CONFIGURED");
  let bytes:Buffer;
  if(/^[a-f0-9]{64}$/iu.test(value))bytes=Buffer.from(value,"hex");
  else if(/^[A-Za-z0-9_+/-]+={0,2}$/u.test(value))bytes=Buffer.from(value,"base64url");
  else throw new Error("ENCRYPTION_NOT_CONFIGURED");
  if(bytes.length<32||bytes.length>128)throw new Error("ENCRYPTION_NOT_CONFIGURED");
  return Buffer.from(hkdfSync("sha256",bytes,"matricia-platform-configuration","secrets-v1",32));
}
function aad(context:ConfigurationSecretContext){return Buffer.from(JSON.stringify(["matricia-platform-configuration-v1",context.environment,context.section,context.revisionId]));}
export function sealConfigurationSecrets(values:Record<string,string>,context:ConfigurationSecretContext,key?:string):string{
  const nonce=randomBytes(12),cipher=createCipheriv("aes-256-gcm",master(key),nonce);
  cipher.setAAD(aad(context));
  const plain=JSON.stringify(Object.fromEntries(Object.entries(values).sort(([a],[b])=>a.localeCompare(b))));
  const encrypted=Buffer.concat([cipher.update(plain,"utf8"),cipher.final()]);
  return ["v1",nonce.toString("base64url"),cipher.getAuthTag().toString("base64url"),encrypted.toString("base64url")].join(".");
}
export function unsealConfigurationSecrets(envelope:string,context:ConfigurationSecretContext,key?:string):Record<string,string>{
  try{
    const parts=envelope.split(".");if(parts.length!==4||parts[0]!=="v1"||envelope.length>100000||parts.slice(1).some(v=>!/^[A-Za-z0-9_-]+$/u.test(v)))throw new Error();
    const nonce=Buffer.from(parts[1]!,"base64url"),tag=Buffer.from(parts[2]!,"base64url");if(nonce.length!==12||tag.length!==16)throw new Error();
    const cipher=createDecipheriv("aes-256-gcm",master(key),nonce);cipher.setAAD(aad(context));cipher.setAuthTag(tag);
    const plain=Buffer.concat([cipher.update(Buffer.from(parts[3]!,"base64url")),cipher.final()]).toString("utf8");
    return z.record(z.string(),z.string()).parse(JSON.parse(plain));
  }catch{throw new Error("CONFIGURATION_SECRETS_UNAVAILABLE");}
}
