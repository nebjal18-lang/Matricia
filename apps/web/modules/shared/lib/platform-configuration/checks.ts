import "server-only";
import {X509Certificate,createHash} from "node:crypto";
import {scanDocumentBytesWithEnvironment} from "@/modules/shared/lib/document-scanning/scanner";
import {parseConfigurationValues,type ConfigurationEnvironment,type ConfigurationSection} from "./model";

export type ConfigurationProbe={status:"PASS"|"FAIL";code:string};
type Dependencies={fetch?:typeof fetch;operatorEnv?:Record<string,string|undefined>};
const failure=(code:string):ConfigurationProbe=>({status:"FAIL",code});
async function boundedText(response:Response):Promise<string>{
  if(Number(response.headers.get("content-length")??0)>65536)throw new Error("PROVIDER_RESPONSE_INVALID");
  const reader=response.body?.getReader();if(!reader)return "";
  const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536)throw new Error("PROVIDER_RESPONSE_INVALID");chunks.push(part.value);}}
  finally{await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks).toString("utf8");
}
function certificate(pemBase64:string):X509Certificate{
  try{
  const pem=Buffer.from(pemBase64,"base64").toString("utf8");if(!pem.startsWith("-----BEGIN CERTIFICATE-----")||pem.length>32768||pem.includes("PRIVATE KEY"))throw new Error("PAYPAL_CERTIFICATE_INVALID");
  const cert=new X509Certificate(pem);
  if(!["rsa","rsa-pss"].includes(cert.publicKey.asymmetricKeyType??"")||Date.parse(cert.validFrom)>Date.now()||Date.parse(cert.validTo)<=Date.now())throw new Error("PAYPAL_CERTIFICATE_INVALID");
  return cert;
  }catch{throw new Error("PAYPAL_CERTIFICATE_INVALID");}
}
export function validateProviderEnvironment(section:ConfigurationSection,settings:Record<string,string>,environment:ConfigurationEnvironment){
  if(section==="PAYPAL"){
    if(settings.PAYPAL_ENV!==(environment==="PRODUCTION"?"live":"sandbox"))throw new Error("PROVIDER_ENVIRONMENT_MISMATCH");
    const expected=environment==="PRODUCTION"?"api-m.paypal.com":"api-m.sandbox.paypal.com";
    if(new URL(settings.PAYPAL_WEBHOOK_CERT_URL!).hostname!==expected)throw new Error("PROVIDER_ENVIRONMENT_MISMATCH");
  }
  if(section==="YOUSIGN"&&settings.YOUSIGN_ENVIRONMENT!==(environment==="PRODUCTION"?"live":"sandbox"))throw new Error("PROVIDER_ENVIRONMENT_MISMATCH");
}
export function validateProviderSecrets(section:ConfigurationSection,secrets:Record<string,string>){if(section==="PAYPAL")certificate(secrets.PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64!);}
async function scannerProbe(settings:Record<string,string>,secrets:Record<string,string>,operator:Record<string,string|undefined>):Promise<ConfigurationProbe>{
  const url=new URL(settings.MALWARE_SCANNER_URL!),host=url.hostname.toLowerCase();
  const declared=settings.MALWARE_SCANNER_ALLOWED_HOSTS!.split(",").map(v=>v.trim().toLowerCase());
  const operatorHosts=(operator.MALWARE_SCANNER_ALLOWED_HOSTS??"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean);
  if(!operatorHosts.includes(host)||!declared.includes(host)||declared.some(h=>!operatorHosts.includes(h))||url.search||url.hash)return failure("SCANNER_HOST_NOT_ALLOWED");
  const bytes=Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n"),sha=createHash("sha256").update(bytes).digest("hex");
  const scan=await scanDocumentBytesWithEnvironment(bytes,sha,"application/pdf",{...operator,DELIVERY_PROOF_SCANNER_MODE:"EXTERNAL",MALWARE_SCANNER_URL:url.toString(),MALWARE_SCANNER_TOKEN:secrets.MALWARE_SCANNER_TOKEN,MALWARE_SCANNER_ALLOWED_HOSTS:host});
  return scan.result==="CLEAN"&&scan.engineCode!=="MATRICIA_SANDBOX"&&scan.engineCode!=="MATRICIA_FAIL_CLOSED"?{status:"PASS",code:"SCANNER_READY"}:failure("SCANNER_NOT_READY");
}
/** Read-only connectivity checks. A PASS never certifies payment, signature or email delivery. */
export async function checkConfigurationConnection(section:ConfigurationSection,settings:Record<string,string>,secrets:Record<string,string>,environment:ConfigurationEnvironment,dependencies:Dependencies={}):Promise<ConfigurationProbe>{
  try{
    parseConfigurationValues(section,settings,secrets);validateProviderEnvironment(section,settings,environment);validateProviderSecrets(section,secrets);
    if(section==="COMPANY")return {status:"PASS",code:"COMPANY_VALIDATED"};
    if(section==="SCANNER")return await scannerProbe(settings,secrets,dependencies.operatorEnv??process.env);
    const request=dependencies.fetch??fetch;
    const options={redirect:"error" as const,cache:"no-store" as const,signal:AbortSignal.timeout(10000)};
    if(section==="RESEND"){
      const response=await request("https://api.resend.com/domains",{...options,headers:{authorization:`Bearer ${secrets.RESEND_API_KEY}`,accept:"application/json"}});
      if(!response.ok)return failure("PROVIDER_REJECTED");
      const payload=JSON.parse(await boundedText(response)) as {data?:Array<{name?:unknown;status?:unknown}>};
      if(!Array.isArray(payload.data))return failure("PROVIDER_RESPONSE_INVALID");
      const domain=settings.RESEND_FROM_EMAIL!.split("@")[1]!.toLowerCase();
      return payload.data.some(row=>typeof row.name==="string"&&row.name.toLowerCase()===domain&&row.status==="verified")?{status:"PASS",code:"RESEND_DOMAIN_VERIFIED"}:failure("RESEND_DOMAIN_UNVERIFIED");
    }
    if(section==="PAYPAL"){
      const base=settings.PAYPAL_ENV==="live"?"https://api-m.paypal.com":"https://api-m.sandbox.paypal.com";
      const response=await request(`${base}/v1/oauth2/token`,{...options,method:"POST",headers:{authorization:`Basic ${Buffer.from(`${settings.PAYPAL_CLIENT_ID}:${secrets.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,"content-type":"application/x-www-form-urlencoded"},body:"grant_type=client_credentials"});
      if(!response.ok)return failure("PROVIDER_REJECTED");
      const payload=JSON.parse(await boundedText(response)) as {access_token?:unknown;token_type?:unknown};
      if(typeof payload.access_token!=="string"||payload.access_token.length<8||String(payload.token_type).toLowerCase()!=="bearer")return failure("PROVIDER_RESPONSE_INVALID");
      const native=await request(settings.PAYPAL_WEBHOOK_CERT_URL!,options);
      if(!native.ok)return failure("PAYPAL_CERTIFICATE_UNAVAILABLE");
      const nativeCert=new X509Certificate(await boundedText(native)),configured=certificate(secrets.PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64!);
      if(nativeCert.fingerprint256!==configured.fingerprint256)return failure("PAYPAL_CERTIFICATE_MISMATCH");
      return {status:"PASS",code:"PAYPAL_CREDENTIALS_VALID"};
    }
    const base=settings.YOUSIGN_ENVIRONMENT==="live"?"https://api.yousign.app":"https://api-sandbox.yousign.app";
    const response=await request(`${base}/v3/signature_requests?limit=1`,{...options,headers:{authorization:`Bearer ${secrets.YOUSIGN_API_KEY}`,accept:"application/json"}});
    if(!response.ok)return failure("PROVIDER_REJECTED");
    const payload=JSON.parse(await boundedText(response)) as {data?:unknown};
    return Array.isArray(payload.data)?{status:"PASS",code:"YOUSIGN_CREDENTIALS_VALID"}:failure("PROVIDER_RESPONSE_INVALID");
  }catch(error){return failure(error instanceof Error&&["PROVIDER_ENVIRONMENT_MISMATCH","PAYPAL_CERTIFICATE_INVALID"].includes(error.message)?error.message:"PROVIDER_UNAVAILABLE");}
}
