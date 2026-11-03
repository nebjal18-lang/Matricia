import {z} from "zod";
import {loadProviderQuotes} from "@/modules/provider/data/quotes/repository";
import {loadQuotePrefills} from "@/modules/provider/screens/devis/prefill";
import {renderProviderQuoteDraftPdf} from "@/modules/provider/data/quotes/draft-pdf";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"cache-control":"no-store, private","x-content-type-options":"nosniff","referrer-policy":"no-referrer"};
export async function GET(request:Request,{params}:{params:Promise<{quoteId:string}>}) {
 const {quoteId}=await params,url=new URL(request.url),input=z.object({quoteId:z.string().uuid(),organizationId:z.string().uuid(),locale:z.enum(["fr","ar"])}).safeParse({quoteId,organizationId:url.searchParams.get("organizationId"),locale:url.searchParams.get("locale")});
 if(!input.success)return Response.json({code:"QUOTE_DRAFT_INVALID"},{status:400,headers});
 const result=await loadProviderQuotes(input.data.organizationId,{quoteId});
 if(result.status==="error")return Response.json({code:result.reason==="UNAUTHENTICATED"?"UNAUTHENTICATED":result.reason==="NO_ORGANIZATION"?"QUOTE_DRAFT_DENIED":"QUOTE_DRAFT_UNAVAILABLE"},{status:result.reason==="UNAUTHENTICATED"?401:result.reason==="NO_ORGANIZATION"?403:503,headers});
 const invitation=result.dashboard.invitations[0],versionId=invitation?.quote?.currentVersionId;
 if(!invitation||invitation.quote?.id!==quoteId||!versionId)return Response.json({code:"QUOTE_DRAFT_NOT_FOUND"},{status:404,headers});
 const prefills=await loadQuotePrefills(input.data.organizationId,[{invitationId:invitation.id,versionId}],input.data.locale),prefill=prefills?.[invitation.id];
 if(!prefill)return Response.json({code:"QUOTE_DRAFT_UNAVAILABLE"},{status:503,headers});
 try {
  const bytes=await renderProviderQuoteDraftPdf({invitation,prefill,organizationName:result.dashboard.organizationName},input.data.locale);
  return new Response(new Uint8Array(bytes),{headers:{...headers,"content-type":"application/pdf","content-length":String(bytes.length),"content-disposition":`attachment; filename="devis-brouillon-${quoteId}-${input.data.locale}.pdf"`}});
 }catch{return Response.json({code:"QUOTE_DRAFT_UNAVAILABLE"},{status:503,headers});}
}
