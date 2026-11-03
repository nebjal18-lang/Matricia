import { createHash } from "node:crypto";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
const failure=(code:string,status:number)=>Response.json({code},{status,headers});
const proof=z.object({id:z.string().uuid(),storage_bucket:z.literal("provider-qualification"),storage_object_path:z.string().min(40).max(400).refine(v=>!/(^|\/)\.\.(\/|$)/.test(v)),sha256:z.string().regex(/^[0-9a-f]{64}$/),mime_type:z.enum(["application/pdf","image/jpeg","image/png"]),size_bytes:z.coerce.number().int().min(1).max(10485760),scan_result_id:z.string().uuid().nullable()});
export async function GET(_request:Request,context:{params:Promise<{proofId:string}>}){
 const {proofId}=await context.params;if(!z.string().uuid().safeParse(proofId).success)return failure("RECEIPT_PROOF_NOT_FOUND",404);
 const client=await getSupabaseServerClient(),{data:auth}=await client.auth.getUser();if(!auth.user)return failure("UNAUTHENTICATED",401);
 // Receipt-proof RLS checks billing access; a proof is immutable and bound by the trusted CLEAN command.
 const result=await client.from("provider_payable_event_proofs").select("id,storage_bucket,storage_object_path,sha256,mime_type,size_bytes::text,scan_result_id").eq("id",proofId).maybeSingle();
 if(result.error)return failure("RECEIPT_PROOF_UNAVAILABLE",503);const parsed=proof.safeParse(result.data);if(!parsed.success)return failure("RECEIPT_PROOF_NOT_FOUND",404);
 if(!parsed.data.scan_result_id)return failure("RECEIPT_PROOF_QUARANTINED",409);
 const downloaded=await getSupabaseAdminClient().storage.from(parsed.data.storage_bucket).download(parsed.data.storage_object_path);
 if(downloaded.error||!downloaded.data)return failure("RECEIPT_PROOF_UNAVAILABLE",503);
 const bytes=Buffer.from(await downloaded.data.arrayBuffer());if(bytes.byteLength!==parsed.data.size_bytes||createHash("sha256").update(bytes).digest("hex")!==parsed.data.sha256)return failure("RECEIPT_PROOF_INTEGRITY_FAILED",503);
 const mime=parsed.data.mime_type,extension=mime==="application/pdf"?"pdf":mime==="image/png"?"png":"jpg";
 return new Response(bytes,{headers:{...headers,"content-type":mime,"content-length":String(bytes.length),"content-disposition":`attachment; filename="receipt-proof-${proofId}.${extension}"`}});
}
