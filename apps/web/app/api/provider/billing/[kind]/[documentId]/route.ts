import {createHash} from "node:crypto";
import {z} from "zod";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
import {archiveProviderBillingDocument,readArchivedProviderBillingOriginal} from "@/modules/provider/data/billing/artifacts";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const noStore={"cache-control":"no-store","x-content-type-options":"nosniff"};
const failure=(code:string,status:number)=>Response.json({code},{status,headers:noStore});
export async function GET(request:Request,context:{params:Promise<{kind:string;documentId:string}>}){
 const params=await context.params;if(!["invoice","statement","credit_note"].includes(params.kind)||!z.string().uuid().safeParse(params.documentId).success)return failure("BILLING_DOCUMENT_NOT_FOUND",404);
 const kind=params.kind as"invoice"|"statement"|"credit_note",locale=new URL(request.url).searchParams.get("locale")==="ar"?"ar":"fr";
 const client=await getSupabaseServerClient(),{data:auth}=await client.auth.getUser();if(!auth.user)return failure("UNAUTHENTICATED",401);
 // Privileged access is used only after archiveProviderBillingDocument's caller-scoped source lookup.
 const originalId=new URL(request.url).searchParams.get("originalArtifactId");
 const result=originalId!==null?await readArchivedProviderBillingOriginal(client,kind,params.documentId,originalId):await archiveProviderBillingDocument(client,getSupabaseAdminClient,kind,params.documentId,locale,auth.user.id);
 if(!result.ok)return failure(result.code,result.code==="BILLING_DOCUMENT_NOT_FOUND"?404:503);
 const admin=getSupabaseAdminClient();
 const downloaded=await admin.storage.from("provider-billing").download(result.artifact.storage_path);if(downloaded.error||!downloaded.data)return failure("BILLING_DOCUMENT_UNAVAILABLE",503);
 const bytes=Buffer.from(await downloaded.data.arrayBuffer());if(bytes.length>10485760||createHash("sha256").update(bytes).digest("hex")!==result.artifact.pdf_sha256)return failure("BILLING_DOCUMENT_INTEGRITY_FAILED",503);
 return new Response(bytes,{headers:{...noStore,"content-type":"application/pdf","content-disposition":`attachment; filename="${kind}-${params.documentId}-${locale}.pdf"`,"content-length":String(bytes.length),etag:`"${result.artifact.pdf_sha256}"`}});
}
