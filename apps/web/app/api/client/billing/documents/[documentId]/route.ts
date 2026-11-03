import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { commercialSourceSchema } from "@/modules/client/data/billing/model";
import { archiveClientCommercialDocument } from "@/modules/client/data/billing/artifacts";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store, private","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}as const;
export async function GET(request:Request,context:{params:Promise<{documentId:string}>}){
 const id=z.string().uuid().safeParse((await context.params).documentId),locale=z.enum(["fr","ar"]).safeParse(new URL(request.url).searchParams.get("locale")??"fr");
 if(!id.success||!locale.success)return Response.json({code:"CLIENT_DOCUMENT_INVALID"},{status:400,headers});
 const client=await getSupabaseServerClient();if(!(await client.auth.getUser()).data.user)return Response.json({code:"UNAUTHENTICATED"},{status:401,headers});
 const authorized=await client.rpc("authorize_client_commercial_document_v1",{p_document_id:id.data});
 if(authorized.error)return Response.json({code:"CLIENT_BILLING_DENIED"},{status:authorized.error.code==="42501"?403:503,headers});
 const source=commercialSourceSchema.safeParse(authorized.data);if(!source.success||source.data.id!==id.data)return Response.json({code:"CLIENT_BILLING_UNAVAILABLE"},{status:503,headers});
 const result=await archiveClientCommercialDocument(source.data,getSupabaseAdminClient(),locale.data);
 if(!result.ok)return Response.json({code:result.code},{status:503,headers});
 const filename=`${source.data.snapshot.number}-${locale.data}.pdf`;
 return new Response(new Uint8Array(result.bytes),{headers:{...headers,"content-type":"application/pdf","content-disposition":`attachment; filename="${filename}"`,"content-length":String(result.bytes.length)}});
}
