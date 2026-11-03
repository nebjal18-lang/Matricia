import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { pinnedProviderRequest, publicIp } from "../marketing-autopilot/provider-orchestrator";

type ScanVerdict={result:"CLEAN"|"INFECTED"|"ERROR";engineCode:string;engineVersion:string;retryable?:boolean;retryCode?:"SCANNER_UNAVAILABLE"|"SCANNER_INVALID_RESPONSE"};
type Dependencies={resolveAddresses?:(host:string)=>Promise<readonly string[]>;sendPinned?:typeof pinnedProviderRequest;request?:typeof fetch;now?:()=>number;nonce?:()=>string};
const MAX_SCAN_BYTES=10*1024*1024,MAX_RESPONSE_BYTES=32768;
const failure=(retryCode:"SCANNER_UNAVAILABLE"|"SCANNER_INVALID_RESPONSE"="SCANNER_INVALID_RESPONSE"):ScanVerdict=>({result:"ERROR",engineCode:"MATRICIA_FAIL_CLOSED",engineVersion:"1.0.0",retryable:true,retryCode});
function sandboxInspect(bytes:Buffer,mediaType:unknown):ScanVerdict{const eicar=bytes.includes(Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE"));if(eicar)return{result:"INFECTED",engineCode:"MATRICIA_SANDBOX",engineVersion:"1.0.0"};const pdf=bytes.subarray(0,5).toString()==="%PDF-",jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff,png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));return{result:(mediaType==="application/pdf"&&pdf)||(mediaType==="image/jpeg"&&jpeg)||(mediaType==="image/png"&&png)?"CLEAN":"ERROR",engineCode:"MATRICIA_SANDBOX",engineVersion:"1.0.0"}}
function safeEqualHex(actual:string,expected:string){if(!/^[0-9a-f]{64}$/iu.test(actual)||!/^[0-9a-f]{64}$/iu.test(expected))return false;return timingSafeEqual(Buffer.from(actual,"hex"),Buffer.from(expected,"hex"));}
async function boundedResponse(response:Response){
 if(Number(response.headers.get("content-length")??0)>MAX_RESPONSE_BYTES){await response.body?.cancel();throw new Error("SCAN_RESPONSE_TOO_LARGE");}
 const reader=response.body?.getReader();if(!reader)throw new Error("SCAN_EMPTY_RESPONSE");const chunks:Uint8Array[]=[];let length=0;
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_RESPONSE_BYTES){await reader.cancel();throw new Error("SCAN_RESPONSE_TOO_LARGE");}chunks.push(value);}return Buffer.concat(chunks).toString("utf8");
}
export async function scanDocumentBytes(bytes:Buffer,sha256:string,mediaType:unknown,dependencies:Dependencies={}):Promise<ScanVerdict>{
 if(bytes.length<1||bytes.length>MAX_SCAN_BYTES||sha256!==createHash("sha256").update(bytes).digest("hex"))return failure();
 if(process.env.DELIVERY_PROOF_SCANNER_MODE==="SANDBOX"&&process.env.NODE_ENV!=="production"&&process.env.APP_ENV?.trim().toLowerCase()!=="production")return sandboxInspect(bytes,mediaType);
 const endpoint=process.env.MALWARE_SCANNER_URL??"",token=process.env.MALWARE_SCANNER_TOKEN??"";
 const allowed=(process.env.MALWARE_SCANNER_ALLOWED_HOSTS??"").split(",").map(value=>value.trim().toLowerCase()).filter(Boolean);
 let url:URL;try{url=new URL(endpoint);}catch{return failure("SCANNER_UNAVAILABLE");}
 const host=url.hostname.toLowerCase().replace(/^\[|\]$/gu,"");
 if(url.protocol!=="https:"||url.username||url.password||url.hash||(url.port&&url.port!=="443")||!allowed.includes(host)||token.length<32||(isIP(host)?!publicIp(host):!host.includes(".")||!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(host)||/(?:\.local|\.internal|\.invalid|\.test|\.localhost)$/u.test(host)))return failure("SCANNER_UNAVAILABLE");
 const now=dependencies.now??Date.now,nonce=(dependencies.nonce??randomUUID)(),issuedAt=new Date(now()).toISOString(),signal=AbortSignal.timeout(20_000);
 try{
  const body=JSON.stringify({version:2,sha256,mediaType,contentBase64:bytes.toString("base64"),requestNonce:nonce,issuedAt});const headers={authorization:`Bearer ${token}`,"content-type":"application/json"};
  let response:Response;
  if(isIP(host))response=await(dependencies.request??fetch)(url,{method:"POST",headers,body,signal,redirect:"error"});
  else{
   const addresses=await new Promise<readonly string[]>((resolve,reject)=>{const abort=()=>reject(new Error("SCAN_DNS_TIMEOUT"));signal.addEventListener("abort",abort,{once:true});(dependencies.resolveAddresses?.(host)??lookup(host,{all:true,verbatim:true}).then(rows=>rows.map(row=>row.address))).then(resolve,reject).finally(()=>signal.removeEventListener("abort",abort));});
   if(!addresses.length||addresses.some(address=>!publicIp(address)))return failure("SCANNER_UNAVAILABLE");
   response=await(dependencies.sendPinned??pinnedProviderRequest)(url,addresses[0]!,body,headers,signal,{maxResponseBytes:MAX_RESPONSE_BYTES});
  }
  const raw=await boundedResponse(response),signature=response.headers.get("x-scan-signature")??"",expected=createHmac("sha256",token).update(raw).digest("hex");
  if(!response.ok||!safeEqualHex(signature,expected))return failure();
  const parsed=JSON.parse(raw)as Record<string,unknown>;const scannedAt=typeof parsed.scannedAt==="string"?Date.parse(parsed.scannedAt):NaN;
  if(parsed.version!==2||parsed.requestNonce!==nonce||!Number.isFinite(scannedAt)||Math.abs(now()-scannedAt)>60_000||(parsed.result!=="CLEAN"&&parsed.result!=="INFECTED")||parsed.sha256!==sha256||typeof parsed.engineCode!=="string"||!/^[A-Z][A-Z0-9_.-]{2,79}$/u.test(parsed.engineCode)||typeof parsed.engineVersion!=="string"||parsed.engineVersion.trim().length<1||parsed.engineVersion.length>80)return failure();
  return {result:parsed.result,engineCode:parsed.engineCode,engineVersion:parsed.engineVersion};
 }catch{return failure("SCANNER_UNAVAILABLE");}
}
