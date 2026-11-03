import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const failure=(code:string,status:number)=>Response.json({code},{status,headers});
const document=z.object({id:z.string().uuid(),storage_object_path:z.string().min(40).max(400).refine(v=>!/(^|\/)\.\.(\/|$)/.test(v)),content_hash:z.string().regex(/^[0-9a-f]{64}$/),metadata:z.object({declared_mime_type:z.enum(["application/pdf","image/jpeg","image/png"]),declared_size_bytes:z.coerce.number().int().min(1).max(10485760)})});
export async function GET(_request:Request,context:{params:Promise<{documentId:string}>}){
 const {documentId}=await context.params;if(!z.string().uuid().safeParse(documentId).success)return failure("DOCUMENT_NOT_FOUND",404);
 const client=await getSupabaseServerClient(),{data:auth}=await client.auth.getUser();if(!auth.user)return failure("UNAUTHENTICATED",401);
 // This immutable source lookup runs with the caller's RLS before any privileged Storage access.
 const result=await client.from("provider_document_versions").select("id,storage_object_path,content_hash,metadata").eq("id",documentId).maybeSingle();
 if(result.error)return failure("DOCUMENT_UNAVAILABLE",503);const parsed=document.safeParse(result.data);if(!parsed.success)return failure("DOCUMENT_NOT_FOUND",404);
 const scan=await client.from("provider_document_scan_jobs").select("scan_status").eq("storage_object_path",parsed.data.storage_object_path).maybeSingle();
 if(scan.error)return failure("DOCUMENT_UNAVAILABLE",503);if(scan.data?.scan_status!=="CLEAN")return failure("DOCUMENT_QUARANTINED",409);
 const downloaded=await getSupabaseAdminClient().storage.from("provider-qualification").download(parsed.data.storage_object_path);
 if(downloaded.error||!downloaded.data)return failure("DOCUMENT_UNAVAILABLE",503);
 const bytes=Buffer.from(await downloaded.data.arrayBuffer());if(bytes.byteLength!==parsed.data.metadata.declared_size_bytes||createHash("sha256").update(bytes).digest("hex")!==parsed.data.content_hash)return failure("DOCUMENT_INTEGRITY_FAILED",503);
 const mime=parsed.data.metadata.declared_mime_type,extension=mime==="application/pdf"?"pdf":mime==="image/png"?"png":"jpg";
 return new Response(bytes,{headers:{...headers,"content-type":mime,"content-length":String(bytes.length),"content-disposition":`attachment; filename="document-${documentId}.${extension}"`}});
}
