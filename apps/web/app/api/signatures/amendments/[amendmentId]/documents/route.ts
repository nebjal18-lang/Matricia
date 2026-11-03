import {signatureDocumentResponse} from "@/modules/shared/lib/signature-documents/http";
export const dynamic="force-dynamic";export const runtime="nodejs";export const maxDuration=60;
export async function GET(request:Request,context:{params:Promise<{amendmentId:string}>}){const{amendmentId}=await context.params;return signatureDocumentResponse(request,{kind:"AMENDMENT",amendmentId});}
