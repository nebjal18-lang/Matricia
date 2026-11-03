import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AntivirusScanner } from "./client-compliance/contracts";
const MAX_BYTES=10*1024*1024,MAX_BODY_BYTES=Math.ceil(MAX_BYTES/3)*4+8192;
type Options={token:string;scanner:AntivirusScanner;available:()=>boolean;now?:()=>number};
function zipContainer(bytes:Buffer){
 const signatures=[Buffer.from([0x50,0x4b,0x03,0x04]),Buffer.from([0x50,0x4b,0x05,0x06]),Buffer.from([0x50,0x4b,0x07,0x08])];
 return signatures.some(signature=>bytes.subarray(0,4).equals(signature))||bytes.subarray(Math.max(0,bytes.length-65557)).includes(Buffer.from([0x50,0x4b,0x05,0x06]));
}
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function createScannerHttpHandler(options:Options){
 let active=false;const seen=new Map<string,number>();const now=options.now??Date.now;
 return async(request:IncomingMessage,response:ServerResponse)=>{
  response.setHeader("cache-control","no-store");response.setHeader("content-type","application/json");
  const end=(status:number,code:string)=>{response.statusCode=status;response.end(JSON.stringify({code}));};
  if(request.method!=="POST"){response.setHeader("allow","POST");end(405,"METHOD_NOT_ALLOWED");return;}
  const match=request.headers.authorization?.match(/^Bearer\s+(.+)$/iu);
  if(options.token.length<32){end(503,"SCANNER_NOT_CONFIGURED");return;}
  if(!match||!equal(match[1]??"",options.token)){end(401,"UNAUTHORIZED");return;}
  if(!options.available()){end(503,"ANTIVIRUS_UNAVAILABLE");return;}
  if(active){end(503,"SCANNER_BUSY");return;}
  if(request.headers["content-type"]?.split(";")[0]?.trim()!=="application/json"){end(415,"CONTENT_TYPE_REQUIRED");return;}
  if(Number(request.headers["content-length"]??0)>MAX_BODY_BYTES){end(413,"SCAN_TOO_LARGE");return;}
  active=true;const timer=setTimeout(()=>request.destroy(new Error("SCAN_BODY_TIMEOUT")),5_000);timer.unref();
  try{
   const chunks:Buffer[]=[];let size=0;
   for await(const value of request){const chunk=Buffer.isBuffer(value)?value:Buffer.from(value);size+=chunk.length;if(size>MAX_BODY_BYTES){end(413,"SCAN_TOO_LARGE");return;}chunks.push(chunk);}
   clearTimeout(timer);
   let data:Record<string,unknown>;try{data=JSON.parse(Buffer.concat(chunks).toString("utf8"))as Record<string,unknown>;}catch{end(400,"INVALID_SCAN_REQUEST");return;}
   if(!data||Array.isArray(data)||data.version!==2||typeof data.sha256!=="string"||!/^[0-9a-f]{64}$/u.test(data.sha256)||typeof data.requestNonce!=="string"||!/^[a-f0-9-]{36}$/u.test(data.requestNonce)||typeof data.issuedAt!=="string"||!Number.isFinite(Date.parse(data.issuedAt))||Math.abs(now()-Date.parse(data.issuedAt))>60_000||!["application/pdf","image/jpeg","image/png","text/plain","application/json","text/csv","application/zip"].includes(String(data.mediaType))||typeof data.contentBase64!=="string"||data.contentBase64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/u.test(data.contentBase64)){end(400,"INVALID_SCAN_REQUEST");return;}
   // INSTREAM OK alone does not prove archive/encryption/limit handling.
   // No native configuration capability is currently attested by this protocol.
   if(data.mediaType==="application/zip"){end(503,"ARCHIVE_SCAN_CAPABILITY_REQUIRED");return;}
   const bytes=Buffer.from(data.contentBase64,"base64");if(bytes.length<1||bytes.length>MAX_BYTES||bytes.toString("base64")!==data.contentBase64){end(413,"SCAN_TOO_LARGE");return;}
   if(zipContainer(bytes)){end(503,"ARCHIVE_SCAN_CAPABILITY_REQUIRED");return;}
   if(createHash("sha256").update(bytes).digest("hex")!==data.sha256){end(422,"SCAN_HASH_MISMATCH");return;}
   for(const [nonce,expires]of seen)if(expires<=now())seen.delete(nonce);
   if(seen.has(data.requestNonce)){end(409,"SCAN_REQUEST_REPLAY");return;}
   if(seen.size>=5000){end(503,"SCANNER_BUSY");return;}
   seen.set(data.requestNonce,now()+120_000);
   const result=await options.scanner.scan(bytes);
   if(!["CLEAN","INFECTED"].includes(result.verdict)||!/^[A-Z][A-Z0-9_.-]{2,79}$/u.test(result.engineCode)||!result.engineVersion.trim()||result.engineVersion.length>80){end(503,"ANTIVIRUS_INVALID_RESULT");return;}
   const body=JSON.stringify({version:2,result:result.verdict,sha256:data.sha256,requestNonce:data.requestNonce,scannedAt:new Date(now()).toISOString(),engineCode:result.engineCode,engineVersion:result.engineVersion});
   response.setHeader("x-scan-signature",createHmac("sha256",options.token).update(body).digest("hex"));response.statusCode=200;response.end(body);
  }catch{if(!response.headersSent&&!response.destroyed)end(503,"ANTIVIRUS_UNAVAILABLE");}
  finally{clearTimeout(timer);active=false;}
 };
}
