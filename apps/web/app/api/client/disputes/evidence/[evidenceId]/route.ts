import{createHash}from"node:crypto";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{getSupabaseAdminClient}from"@/modules/shared/lib/supabase/admin";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store, private","referrer-policy":"no-referrer","x-content-type-options":"nosniff"};
const uuid=z.string().uuid();const maxBytes=10485760;
const grantSchema=z.object({evidence_id:uuid,bucket:z.enum(["client-compliance","provider-qualification","delivery-proofs"]),object_path:z.string().min(32).max(500).refine(value=>!/(^|\/)\.\.(\/|$)/u.test(value)),file_name:z.string().min(3).max(255).refine(value=>!/[\\/\x00-\x1f]/u.test(value)),mime_type:z.enum(["application/pdf","image/jpeg","image/png"]),size_bytes:z.string().regex(/^[1-9][0-9]{0,8}$/u).transform(Number).refine(value=>value<=maxBytes),sha256:z.string().regex(/^[a-f0-9]{64}$/u)}).strict();
function failure(status:number){return Response.json({code:status===401?"UNAUTHENTICATED":status===403?"DISPUTE_EVIDENCE_DENIED":"DISPUTE_EVIDENCE_UNAVAILABLE"},{status,headers});}
export async function GET(_request:Request,{params}:{params:Promise<{evidenceId:string}>}){
 const parsed=uuid.safeParse((await params).evidenceId);if(!parsed.success)return failure(403);
 const client=await getSupabaseServerClient();const{data}=await client.auth.getUser();if(!data.user)return failure(401);
 const authorization=await client.rpc("authorize_client_dispute_attachment_v1",{p_evidence_id:parsed.data});if(authorization.error)return failure(authorization.error.code==="42501"?403:503);
 const grant=grantSchema.safeParse(authorization.data);if(!grant.success||grant.data.evidence_id!==parsed.data)return failure(403);
 const file=await getSupabaseAdminClient().storage.from(grant.data.bucket).download(grant.data.object_path);if(file.error||!file.data)return failure(503);
 const bytes=Buffer.from(await file.data.arrayBuffer());if(bytes.length!==grant.data.size_bytes||bytes.length>maxBytes||createHash("sha256").update(bytes).digest("hex")!==grant.data.sha256)return failure(503);
 const ascii=grant.data.file_name.replace(/[^\x20-\x7e]/gu,"_").replace(/["\\]/gu,"_");
 return new Response(bytes,{headers:{...headers,"content-type":grant.data.mime_type,"content-length":String(bytes.length),"content-disposition":`attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(grant.data.file_name)}`}});
}
