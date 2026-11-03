import {z} from "zod";
import {getSupabaseBrowserClient} from "@/modules/shared/lib/supabase/client";
import {privacyUuid} from "./model";
const reservation=z.object({upload_id:privacyUuid,version:z.number().int().positive(),bucket:z.literal("privacy-response-files"),path:z.string().regex(/^dsr-files\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/u),status:z.enum(["RESERVED","UPLOADED","CANCELLED"]),scan_status:z.enum(["PENDING","CLEAN","REJECTED","ERROR"])});
export async function uploadPreparedPrivacyFile(requestId:string,file:File,key:string):Promise<{uploadId:string;scanStatus:string}>{
 if(!privacyUuid.safeParse(requestId).success||!privacyUuid.safeParse(key).success||!file.size||file.size>10485760)throw new Error("DSR_FILE_SIZE_INVALID");
 const extension=file.name.split(".").at(-1)?.toLowerCase(),mimeByExtension:Record<string,string>={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",txt:"text/plain",json:"application/json",csv:"text/csv"};
 if(extension==="zip"||["application/zip","application/x-zip-compressed"].includes(file.type))throw new Error("ARCHIVE_SCAN_CAPABILITY_REQUIRED");
 const mime=extension?mimeByExtension[extension]:undefined;if(!mime)throw new Error("DSR_FILE_MIME_MISMATCH");
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join("");
 const client=getSupabaseBrowserClient(),reserved=await client.rpc("reserve_dsr_redacted_file_v1",{p_request_id:requestId,p_file_name:file.name,p_mime_type:mime,p_size_bytes:file.size,p_sha256:sha,p_idempotency_key:key});
 if(reserved.error)throw new Error(reserved.error.message);const parsed=reservation.parse(reserved.data);
 if(parsed.status==="CANCELLED")throw new Error("DSR_FILE_PREPARATION_CANCELLED");
 if(parsed.status==="RESERVED"){
  const uploaded=await client.storage.from(parsed.bucket).upload(parsed.path,file,{contentType:mime,upsert:false});
  if(uploaded.error&&String(uploaded.error.statusCode)!=="409"&&!/already exists|duplicate/iu.test(uploaded.error.message))throw new Error("DSR_FILE_STORAGE_UNAVAILABLE");
 }
 // This route downloads and hashes the real object before committing it. A409
 // above is never treated as proof that its bytes match this selected file.
 const response=await fetch(`/api/privacy/files/uploads/${parsed.upload_id}`,{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
 const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(z.object({code:z.string()}).safeParse(body).success?(body as {code:string}).code:"DSR_FILE_STORAGE_UNAVAILABLE");
 const committed=z.object({outcome:z.literal("DSR_REDACTED_FILE_UPLOADED"),upload_id:z.literal(parsed.upload_id),scan_status:z.enum(["PENDING","CLEAN","REJECTED","ERROR"])}).parse(body);
 return{uploadId:committed.upload_id,scanStatus:committed.scan_status};
}
