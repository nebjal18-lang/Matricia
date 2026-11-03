import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { evidenceReference } from "@/modules/franchise/data/documents/model";
export async function GET(request:Request,{params}:{params:Promise<{documentId:string}>}){
 const {documentId}=await params;const query=new URL(request.url).searchParams;const franchiseId=query.get("franchiseId");
 if(!z.string().uuid().safeParse(documentId).success||!z.string().uuid().safeParse(franchiseId).success)return new Response("INVALID_DOCUMENT_REFERENCE",{status:400});
 const client=await getSupabaseServerClient();const inline=query.get("mode")==="inline";const response=await client.rpc("franchise_document_reference",{p_franchise_id:franchiseId,p_document_id:documentId,p_action:inline?"PREVIEW":"DOWNLOAD"});const reference=evidenceReference.safeParse(response.data);
 if(response.error||!reference.success)return new Response("DOCUMENT_ACCESS_DENIED",{status:403,headers:{"Cache-Control":"private, no-store"}});
 const item=reference.data;const extension=item.mimeType==="application/pdf"?"pdf":item.mimeType==="image/png"?"png":"jpg";
 const signed=await client.storage.from(item.bucket).createSignedUrl(item.path,60,{download:inline?false:`${item.code}-v${item.version}.${extension}`});
 if(signed.error||!signed.data?.signedUrl)return new Response("DOCUMENT_UNAVAILABLE",{status:503,headers:{"Cache-Control":"private, no-store"}});
 return NextResponse.redirect(signed.data.signedUrl,{status:303,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
}
