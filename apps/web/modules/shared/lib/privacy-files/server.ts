import {z} from "zod";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
import {containsUnsupportedArchive,maximumPrivacyDownloadBytes,privacyBytesSha256,privateFileDisposition,verifiedPrivacyUploadMime} from "./bytes";
export const privacyFileHeaders={"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer","content-security-policy":"default-src 'none'; sandbox"};
const hash=z.string().regex(/^[a-f0-9]{64}$/u);
const sourceSchema=z.object({kind:z.enum(["UPLOAD_COMMIT","SOURCE_REVIEW","REDACTED_REVIEW","RESPONSE_FILE"]),content_kind:z.enum(["STORAGE","INLINE"]).optional(),bucket:z.enum(["client-compliance","provider-qualification","delivery-proofs","private-message-attachments","provider-billing","client-billing-documents","signature-source-documents","privacy-response-files"]).optional(),path:z.string().min(1).max(2000).refine(path=>!path.startsWith("/")&&!path.split("/").includes("..")&&!/[\x00-\x1f\\]/u.test(path)).optional(),content:z.string().max(maximumPrivacyDownloadBytes).optional(),sha256:hash,size_bytes:z.string().regex(/^\d{1,10}$/u).transform(Number).refine(n=>n>=1&&n<=maximumPrivacyDownloadBytes),mime_type:z.string().min(1).max(100),file_name:z.string().min(1).max(255)});
const ticketSchema=z.object({ticket_id:z.string().uuid()});
export function privacyFileFailure(code:string,status=503):Response{return Response.json({code},{status,headers:privacyFileHeaders});}
function rpcStatus(code:string|undefined):number{return code==="42501"?403:code==="40001"?409:code==="54000"?429:code==="22023"?400:503;}
async function deadline<T>(promise:Promise<T>,ms:number):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("DSR_FILE_STORAGE_TIMEOUT")),ms);})]);}finally{clearTimeout(timer);}}
export async function transferPrivateDsrFile(authorizeName:"authorize_dsr_file_review_v1"|"authorize_my_dsr_response_file_v1"|"authorize_dsr_file_upload_commit_v1",args:Record<string,unknown>,commit=false):Promise<Response>{
 try{
  const client=await getSupabaseServerClient(),{data:auth}=await deadline(client.auth.getUser(),5000);if(!auth.user)return privacyFileFailure("UNAUTHENTICATED",401);
  const authorization=await deadline(Promise.resolve(client.rpc(authorizeName,args)),5000);if(authorization.error)return privacyFileFailure("DSR_FILE_AUTHORIZATION_FAILED",rpcStatus(authorization.error.code));
  const ticket=ticketSchema.safeParse(authorization.data);if(!ticket.success)return privacyFileFailure("DSR_FILE_AUTHORIZATION_INVALID");
  // Service credentials are used only after a guarded, native-session authorization.
  const admin=getSupabaseAdminClient(),result=await deadline(Promise.resolve(admin.rpc("get_dsr_file_transfer_source_v1",{p_ticket_id:ticket.data.ticket_id,p_actor_user_id:auth.user.id})),5000);
  const parsed=sourceSchema.safeParse(result.data);if(result.error||!parsed.success)return privacyFileFailure("DSR_FILE_UNAVAILABLE",rpcStatus(result.error?.code));
  const source=parsed.data;if(commit!==(source.kind==="UPLOAD_COMMIT"))return privacyFileFailure("DSR_FILE_TRANSFER_INVALID");
  let bytes:Buffer;
  if(source.content_kind==="INLINE"){
   if(source.content===undefined)return privacyFileFailure("DSR_FILE_SOURCE_INVALID");bytes=Buffer.from(source.content,"utf8");
  }else{
   if(!source.bucket||!source.path)return privacyFileFailure("DSR_FILE_SOURCE_INVALID");
   const downloaded=await deadline(admin.storage.from(source.bucket).download(source.path),10000);
   if(downloaded.error||!downloaded.data||downloaded.data.size!==source.size_bytes)return privacyFileFailure("DSR_FILE_STORAGE_UNAVAILABLE");
   bytes=Buffer.from(await downloaded.data.arrayBuffer());
  }
  if(bytes.length!==source.size_bytes||privacyBytesSha256(bytes)!==source.sha256)return privacyFileFailure("DSR_FILE_INTEGRITY_ERROR");
  if(containsUnsupportedArchive(bytes))return privacyFileFailure("ARCHIVE_SCAN_CAPABILITY_REQUIRED",422);
  const mime=commit?verifiedPrivacyUploadMime(bytes,source.mime_type):source.mime_type;
  const confirmation=await deadline(Promise.resolve(admin.rpc(commit?"commit_dsr_redacted_file_bytes_v1":"record_dsr_file_transfer_access_v1",commit?{p_ticket_id:ticket.data.ticket_id,p_computed_sha256:source.sha256,p_detected_mime_type:mime,p_size_bytes:bytes.length}:{p_ticket_id:ticket.data.ticket_id,p_sha256:source.sha256,p_size_bytes:bytes.length})),5000);
  if(confirmation.error)return privacyFileFailure("DSR_FILE_CONFIRMATION_FAILED",rpcStatus(confirmation.error.code));
  const outcome=z.object({outcome:z.literal(commit?"DSR_REDACTED_FILE_UPLOADED":"DSR_FILE_ACCESS_RECORDED")}).safeParse(confirmation.data);if(!outcome.success)return privacyFileFailure("DSR_FILE_CONFIRMATION_INVALID");
  if(commit){const response=z.object({outcome:z.literal("DSR_REDACTED_FILE_UPLOADED"),upload_id:z.string().uuid(),scan_status:z.enum(["PENDING","CLEAN","REJECTED","ERROR"])}).safeParse(confirmation.data);return response.success?Response.json(response.data,{headers:privacyFileHeaders}):privacyFileFailure("DSR_FILE_CONFIRMATION_INVALID");}
  return new Response(new Uint8Array(bytes),{headers:{...privacyFileHeaders,"content-type":mime,"content-length":String(bytes.length),"content-disposition":privateFileDisposition(source.file_name,mime),"x-matricia-file-sha256":source.sha256}});
 }catch(error){const code=error instanceof Error&&/^(ARCHIVE_SCAN_CAPABILITY_REQUIRED|DSR_FILE_(SIZE_INVALID|UTF8_REQUIRED|JSON_INVALID|MIME_MISMATCH))$/u.test(error.message)?error.message:"DSR_FILE_UNAVAILABLE";return privacyFileFailure(code,code==="DSR_FILE_UNAVAILABLE"?503:422);}
}

export function privacyMutationOriginAllowed(request:Request):boolean{
 try{const configured=process.env.NEXT_PUBLIC_APP_URL,origin=request.headers.get("origin");return !!configured&&!!origin&&["http:","https:"].includes(new URL(configured).protocol)&&new URL(configured).origin===new URL(origin).origin&&request.headers.get("sec-fetch-site")!=="cross-site"&&request.headers.get("content-type")?.split(";",1)[0]?.trim().toLowerCase()==="application/json";}catch{return false;}
}
export async function readPrivacyJsonBody(request:Request):Promise<unknown>{
 const size=Number(request.headers.get("content-length")??0);if(!Number.isSafeInteger(size)||size<0||size>4096||!request.body)throw new Error("INVALID_REQUEST");
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await deadline(reader.read(),5000);if(done)break;length+=value.byteLength;if(length>4096)throw new Error("INVALID_REQUEST");chunks.push(value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}
 finally{void reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
