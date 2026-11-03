import {z} from "zod";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
import {getOrArchiveSignatureDocument,type SignatureDocumentInput} from "./archive";
const headers={"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
export async function signatureDocumentResponse(request:Request,input:SignatureDocumentInput){
 const url=new URL(request.url),language=url.searchParams.get("locale")??"fr";
 if(!["fr","ar"].includes(language)||Object.values(input).some((value,index)=>index>0&&!z.string().uuid().safeParse(value).success))return Response.json({code:"SIGNATURE_DOCUMENT_NOT_FOUND"},{status:404,headers});
 const client=await getSupabaseServerClient(),{data:auth,error}=await client.auth.getUser();if(error||!auth.user)return Response.json({code:"UNAUTHENTICATED"},{status:401,headers});
 const result=await getOrArchiveSignatureDocument(client,()=>getSupabaseAdminClient({timeoutMs:10000}),input,language as"fr"|"ar",auth.user.id);
 if(!result.ok)return Response.json({code:result.code},{status:result.code==="SIGNATURE_DOCUMENT_NOT_FOUND"?404:503,headers});
 return new Response(new Uint8Array(result.bytes),{headers:{...headers,"content-type":"application/pdf","content-disposition":`attachment; filename="${input.kind.toLowerCase()}-source-${result.sourceId}-${language}.pdf"`,"content-length":String(result.bytes.length),etag:`"${result.artifact.pdf_sha256}"`,"x-matricia-document-kind":"UNSIGNED_SOURCE_DOCUMENT"}});
}
