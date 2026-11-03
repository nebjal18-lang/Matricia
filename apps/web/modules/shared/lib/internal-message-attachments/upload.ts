import {z} from "zod";
import type {SupabaseClient} from "@supabase/supabase-js";
const reservation=z.object({outcome:z.literal("INTERNAL_MESSAGE_ATTACHMENT_RESERVED"),upload_id:z.string().uuid(),file_id:z.string().uuid(),row_version:z.number().int().positive(),storage_bucket:z.literal("private-message-attachments"),storage_path:z.string().min(1)});
export async function uploadInternalMessageAttachment(client:SupabaseClient,input:{draftId:string;expectedRowVersion:number;file:File;idempotencyKey:string;fileId?:string}):Promise<{ok:true;rowVersion:number;uploadId:string;fileId:string}|{ok:false;code:string}>{
 const {file}=input;if(file.size<1||file.size>10485760||!["application/pdf","image/jpeg","image/png","text/plain"].includes(file.type))return{ok:false,code:"INVALID_FILE"};
 try{
  const sha=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer()))).map(b=>b.toString(16).padStart(2,"0")).join("");
  const response=await client.rpc("reserve_internal_message_attachment_v1",{p_draft_id:input.draftId,p_expected_row_version:input.expectedRowVersion,p_name:file.name,p_media_type:file.type,p_size_bytes:file.size,p_sha256:sha,p_idempotency_key:input.idempotencyKey,p_file_id:input.fileId??null}),parsed=reservation.safeParse(response.data);
  if(response.error||!parsed.success)return{ok:false,code:response.error?.code==="40001"?"CONFLICT":"RESERVATION_FAILED"};
  const slot=parsed.data,result=await client.storage.from(slot.storage_bucket).upload(slot.storage_path,file,{contentType:file.type,upsert:false,cacheControl:"0"});
  if(result.error&&String((result.error as{statusCode?:unknown}).statusCode??"")!=="409")return{ok:false,code:"UPLOAD_FAILED"};
  const committed=await client.rpc("commit_internal_message_attachment_upload_v1",{p_upload_id:slot.upload_id});
  if(committed.error||committed.data?.outcome!=="INTERNAL_MESSAGE_ATTACHMENT_UPLOAD_COMMITTED")return{ok:false,code:"UPLOAD_UNCONFIRMED"};
  return{ok:true,rowVersion:slot.row_version,uploadId:slot.upload_id,fileId:slot.file_id};
 }catch{return{ok:false,code:"CONNECTION_INTERRUPTED"};}
}
