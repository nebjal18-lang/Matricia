import {z} from "zod";
import {privacyFileFailure,privacyMutationOriginAllowed,readPrivacyJsonBody,transferPrivateDsrFile} from "@/modules/shared/lib/privacy-files/server";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{uploadId:string}>}){
 if(!privacyMutationOriginAllowed(request))return privacyFileFailure("REQUEST_ORIGIN_DENIED",403);
 const {uploadId}=await params;if(!z.string().uuid().safeParse(uploadId).success)return privacyFileFailure("INVALID_UPLOAD",400);
 if(Number(request.headers.get("content-length")??0)>4096)return privacyFileFailure("INVALID_REQUEST",400);
 const body=z.object({resumePreparation:z.boolean().optional(),reason:z.string().trim().min(10).max(1000).optional()}).strict().safeParse(await readPrivacyJsonBody(request).catch(()=>null));
 if(!body.success||body.data.resumePreparation===true&&!body.data.reason)return privacyFileFailure("INVALID_REQUEST",400);
 return transferPrivateDsrFile("authorize_dsr_file_upload_commit_v1",{p_upload_id:uploadId,p_resume_preparation:body.data.resumePreparation??false,p_reason:body.data.reason??null},true);
}
