import {createHash} from "node:crypto";
export const maximumPrivacyUploadBytes=10*1024*1024;
export const maximumPrivacyDownloadBytes=32*1024*1024;
const starts=(bytes:Uint8Array,head:number[])=>head.every((value,index)=>bytes[index]===value);
export function containsUnsupportedArchive(bytes:Uint8Array):boolean{
 const buffer=Buffer.from(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 return starts(bytes,[80,75,3,4])||starts(bytes,[80,75,5,6])||starts(bytes,[80,75,7,8])||buffer.subarray(Math.max(0,buffer.length-65557)).includes(Buffer.from([80,75,5,6]));
}
export function verifiedPrivacyUploadMime(bytes:Uint8Array,declared:string):string{
 if(!bytes.length||bytes.length>maximumPrivacyUploadBytes)throw new Error("DSR_FILE_SIZE_INVALID");
 if(containsUnsupportedArchive(bytes))throw new Error("ARCHIVE_SCAN_CAPABILITY_REQUIRED");
 if(declared==="application/pdf"&&Buffer.from(bytes.subarray(0,5)).toString("ascii")==="%PDF-")return declared;
 if(declared==="image/jpeg"&&starts(bytes,[255,216,255]))return declared;
 if(declared==="image/png"&&starts(bytes,[137,80,78,71,13,10,26,10]))return declared;
 if(["text/plain","application/json","text/csv"].includes(declared)){
  let text:string;try{text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{throw new Error("DSR_FILE_UTF8_REQUIRED");}
  if(text.includes("\0"))throw new Error("DSR_FILE_UTF8_REQUIRED");
  if(declared==="application/json"){try{JSON.parse(text);}catch{throw new Error("DSR_FILE_JSON_INVALID");}}
  return declared;
 }
 throw new Error("DSR_FILE_MIME_MISMATCH");
}
export function privacyBytesSha256(bytes:Uint8Array):string{return createHash("sha256").update(bytes).digest("hex");}
export function privateFileDisposition(name:string,mime:string):string{
 const extension:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png","text/plain":"txt","application/json":"json","text/csv":"csv"};
 const sanitized=name.replace(/[\uD800-\uDFFF]/gu,"_").replace(/[\x00-\x1f\x7f/\\]/gu,"_").slice(0,200)||"privacy-document";
 const suffix=extension[mime]??"bin",safe=sanitized.toLowerCase().endsWith(`.${suffix}`)?sanitized:`${sanitized}.${suffix}`;
 const fallback=safe.replace(/[^a-zA-Z0-9._-]/gu,"_");
 return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/['()]/gu,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}
