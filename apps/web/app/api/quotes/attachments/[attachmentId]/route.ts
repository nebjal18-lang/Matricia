import {createHash} from "node:crypto";
import {z} from "zod";
import {classifyAuthReadFailure} from "@/modules/shared/lib/auth/read-failure";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const source=z.object({attachment_id:z.string().uuid(),title:z.string().min(2).max(255),bucket:z.literal("provider-qualification"),object_path:z.string().min(10).max(1000).refine(value=>!/(^|\/)\.\.(\/|$)/u.test(value)),sha256:z.string().regex(/^[a-f0-9]{64}$/u),mime_type:z.enum(["application/pdf","image/png","image/jpeg"]),size_bytes:z.string().regex(/^\d{1,8}$/u).transform(Number).pipe(z.number().int().positive().max(10485760))});
export async function GET(_request:Request,{params}:{params:Promise<{attachmentId:string}>}) {
 const {attachmentId}=await params;
 if(!z.string().uuid().safeParse(attachmentId).success)return Response.json({code:"QUOTE_ATTACHMENT_NOT_FOUND"},{status:404,headers});
 const client=await getSupabaseServerClient(),{data:auth,error}=await client.auth.getUser();
 const authFailure=classifyAuthReadFailure(error);
 if(authFailure||!auth.user)return Response.json({code:authFailure==="UNAVAILABLE"?"QUOTE_ATTACHMENT_UNAVAILABLE":"UNAUTHENTICATED"},{status:authFailure==="UNAVAILABLE"?503:401,headers});
 const authorized=await client.rpc("authorize_quote_attachment_download_v1",{p_attachment_id:attachmentId});
 if(authorized.error)return Response.json({code:authorized.error.code==="42501"?"QUOTE_ATTACHMENT_DENIED":authorized.error.code==="55000"?"QUOTE_ATTACHMENT_QUARANTINED":"QUOTE_ATTACHMENT_UNAVAILABLE"},{status:authorized.error.code==="42501"?403:authorized.error.code==="55000"?409:503,headers});
 const parsed=source.safeParse(authorized.data);if(!parsed.success||parsed.data.attachment_id!==attachmentId)return Response.json({code:"QUOTE_ATTACHMENT_UNAVAILABLE"},{status:503,headers});
 const file=await getSupabaseAdminClient().storage.from(parsed.data.bucket).download(parsed.data.object_path);
 if(file.error||!file.data)return Response.json({code:"QUOTE_ATTACHMENT_UNAVAILABLE"},{status:503,headers});
 const bytes=Buffer.from(await file.data.arrayBuffer());
 if(bytes.length!==parsed.data.size_bytes||createHash("sha256").update(bytes).digest("hex")!==parsed.data.sha256)return Response.json({code:"QUOTE_ATTACHMENT_INTEGRITY_FAILED"},{status:503,headers});
 const extension=parsed.data.mime_type==="application/pdf"?"pdf":parsed.data.mime_type==="image/png"?"png":"jpg";
 return new Response(new Uint8Array(bytes),{headers:{...headers,"content-type":parsed.data.mime_type,"content-length":String(bytes.length),"content-disposition":`attachment; filename="piece-devis-${attachmentId}.${extension}"`}});
}
