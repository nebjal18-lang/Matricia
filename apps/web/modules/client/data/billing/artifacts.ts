import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderBillingPdf } from "@/modules/shared/lib/commercial-documents/pdf";
import { commercialArtifactSchema, clientBillingPdfSnapshot, type CommercialArtifact, type CommercialSource } from "./model";
const bucket="client-billing-documents";
export type ArchiveResult={ok:true;artifact:CommercialArtifact;bytes:Buffer}|{ok:false;code:"CLIENT_BILLING_UNAVAILABLE"|"CLIENT_BILLING_CORRUPTED"};
const digest=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
function validPdf(bytes:Buffer){return bytes.length>=100&&bytes.length<=5242880&&bytes.subarray(0,5).toString("ascii")==="%PDF-";}
async function download(admin:SupabaseClient,path:string){const result=await admin.storage.from(bucket).download(path);return result.error||!result.data?null:Buffer.from(await result.data.arrayBuffer());}
/** The source must come from caller authorization or the service-only archive RPC. */
export async function archiveClientCommercialDocument(source:CommercialSource,admin:SupabaseClient,locale:"fr"|"ar"):Promise<ArchiveResult>{
 try{
  const existing=source.artifacts.find(artifact=>artifact.locale===locale);
  if(existing){const bytes=await download(admin,existing.storage_path);if(!bytes)return{ok:false,code:"CLIENT_BILLING_UNAVAILABLE"};return validPdf(bytes)&&bytes.length===existing.size_bytes&&digest(bytes)===existing.pdf_sha256?{ok:true,artifact:existing,bytes}:{ok:false,code:"CLIENT_BILLING_CORRUPTED"};}
  const bytes=await renderBillingPdf(clientBillingPdfSnapshot(source,locale),locale);if(!validPdf(bytes))return{ok:false,code:"CLIENT_BILLING_CORRUPTED"};
  const sha=digest(bytes),path=`${source.organization_id}/${source.id}/${locale}/${source.source_hash}.pdf`;
  const uploaded=await admin.storage.from(bucket).upload(path,bytes,{contentType:"application/pdf",upsert:false,cacheControl:"0"});
  // A retry may observe a previously committed upload even when its response was lost.
  if(uploaded.error){const actual=await download(admin,path);if(!actual||!validPdf(actual)||actual.length!==bytes.length||digest(actual)!==sha)return{ok:false,code:"CLIENT_BILLING_UNAVAILABLE"};}
  const recorded=await admin.rpc("record_client_commercial_artifact_v1",{p_document_id:source.id,p_locale:locale,p_source_hash:source.source_hash,p_pdf_sha256:sha,p_size_bytes:bytes.length});
  const artifact=commercialArtifactSchema.safeParse(recorded.data);
  if(recorded.error||!artifact.success||artifact.data.document_id!==source.id||artifact.data.locale!==locale||artifact.data.source_hash!==source.source_hash||artifact.data.pdf_sha256!==sha||artifact.data.storage_path!==path)return{ok:false,code:"CLIENT_BILLING_UNAVAILABLE"};
  return{ok:true,artifact:artifact.data,bytes};
 }catch{return{ok:false,code:"CLIENT_BILLING_UNAVAILABLE"};}
}
