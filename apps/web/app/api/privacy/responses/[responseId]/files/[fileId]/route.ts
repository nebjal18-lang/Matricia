import {z} from "zod";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {privacyFileFailure,privacyFileHeaders,privacyMutationOriginAllowed,readPrivacyJsonBody,transferPrivateDsrFile} from "@/modules/shared/lib/privacy-files/server";
export const dynamic="force-dynamic";
export const maxDuration=60;
const hash=z.string().regex(/^[a-f0-9]{64}$/u);
function valid(responseId:string,fileId:string){return z.string().uuid().safeParse(responseId).success&&/^[a-f0-9]{64}$/u.test(fileId);}
export async function GET(_request:Request,{params}:{params:Promise<{responseId:string;fileId:string}>}){
 const {responseId,fileId}=await params;if(!valid(responseId,fileId))return privacyFileFailure("INVALID_FILE",400);
 return transferPrivateDsrFile("authorize_my_dsr_response_file_v1",{p_response_id:responseId,p_file_id:fileId});
}
export async function POST(request:Request,{params}:{params:Promise<{responseId:string;fileId:string}>}){
 if(!privacyMutationOriginAllowed(request))return privacyFileFailure("REQUEST_ORIGIN_DENIED",403);
 const {responseId,fileId}=await params;if(!valid(responseId,fileId)||Number(request.headers.get("content-length")??0)>4096)return privacyFileFailure("INVALID_REQUEST",400);
 const parsed=z.object({responseSha256:hash,manifestHash:hash,downloadSha256:hash,confirmed:z.literal(true)}).strict().safeParse(await readPrivacyJsonBody(request).catch(()=>null));if(!parsed.success)return privacyFileFailure("INVALID_REQUEST",400);
 const client=await getSupabaseServerClient(),{data:auth}=await client.auth.getUser();if(!auth.user)return privacyFileFailure("UNAUTHENTICATED",401);
 const result=await client.rpc("acknowledge_my_dsr_response_file_v1",{p_response_id:responseId,p_file_id:fileId,p_response_sha256:parsed.data.responseSha256,p_file_manifest_hash:parsed.data.manifestHash,p_download_sha256:parsed.data.downloadSha256,p_receipt_confirmed:true});
 if(result.error)return privacyFileFailure("DSR_EXACT_FILE_RECEIPT_REQUIRED",result.error.code==="42501"?403:result.error.code==="40001"?409:503);
 const outcome=z.object({outcome:z.literal("DSR_RESPONSE_FILE_ACKNOWLEDGED")}).safeParse(result.data);return outcome.success?Response.json({outcome:outcome.data.outcome},{headers:privacyFileHeaders}):privacyFileFailure("DSR_FILE_CONFIRMATION_INVALID");
}
