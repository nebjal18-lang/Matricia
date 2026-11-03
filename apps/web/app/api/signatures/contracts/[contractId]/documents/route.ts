import {signatureDocumentResponse} from "@/modules/shared/lib/signature-documents/http";
export const dynamic="force-dynamic";export const runtime="nodejs";export const maxDuration=60;
export async function GET(request:Request,context:{params:Promise<{contractId:string}>}){const{contractId}=await context.params;const contractVersionId=new URL(request.url).searchParams.get("contractVersionId")??undefined;return signatureDocumentResponse(request,{kind:"CONTRACT",contractId,...(contractVersionId?{contractVersionId}:{})});}
