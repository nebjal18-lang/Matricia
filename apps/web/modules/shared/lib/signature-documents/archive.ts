import {createHash} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import {signatureArchiveArtifactSchema,signatureDocumentSourceSchema,type SignatureArchiveArtifact,type SignatureDocumentSource} from "./model";
import {renderSignatureDocumentPdf,SIGNATURE_DOCUMENT_RENDER_VERSION} from "./pdf";
const BUCKET="signature-source-documents",MAX_BYTES=20*1024*1024;
export type SignatureDocumentInput={kind:"CONTRACT";contractId:string;contractVersionId?:string}|{kind:"AMENDMENT";amendmentId:string};
export type SignatureDocumentResult={ok:true;artifact:SignatureArchiveArtifact;bytes:Buffer;sourceId:string}|{ok:false;code:string};
const digest=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
const unavailable=():SignatureDocumentResult=>({ok:false,code:"SIGNATURE_DOCUMENT_UNAVAILABLE"});
function matches(artifact:SignatureArchiveArtifact,source:SignatureDocumentSource,locale:"fr"|"ar"){
 return artifact.locale===locale&&artifact.source_hash===source.source_hash&&artifact.parties_hash===source.parties_hash&&artifact.render_version===SIGNATURE_DOCUMENT_RENDER_VERSION&&artifact.storage_path===`${source.source_kind.toLowerCase()}/${source.source_id}/${source.source_hash}/${locale}/${artifact.pdf_sha256}.pdf`;
}
async function readback(admin:SupabaseClient,artifact:Pick<SignatureArchiveArtifact,"storage_path"|"pdf_sha256"|"size_bytes">):Promise<Buffer|null>{
 const downloaded=await admin.storage.from(BUCKET).download(artifact.storage_path,{}, {signal:AbortSignal.timeout(10000)});
 if(downloaded.error||!downloaded.data||downloaded.data.size!==artifact.size_bytes||downloaded.data.size>MAX_BYTES)return null;
 const bytes=Buffer.from(await downloaded.data.arrayBuffer());
 return bytes.length===artifact.size_bytes&&bytes.subarray(0,5).toString()==="%PDF-"&&digest(bytes)===artifact.pdf_sha256?bytes:null;
}
/** Read authority before creating the privileged client; archive only actual deterministic PDF bytes. */
export async function getOrArchiveSignatureDocument(client:SupabaseClient,adminFactory:()=>SupabaseClient,input:SignatureDocumentInput,locale:"fr"|"ar",actorId:string):Promise<SignatureDocumentResult>{
 try{
  const sourceResult=input.kind==="CONTRACT"?await client.rpc("get_contract_signature_document_source_v1",{p_contract_id:input.contractId,p_contract_version_id:input.contractVersionId??null}).abortSignal(AbortSignal.timeout(5000)):await client.rpc("get_amendment_signature_document_source_v1",{p_amendment_id:input.amendmentId}).abortSignal(AbortSignal.timeout(5000));
  if(sourceResult.error)return{ok:false,code:sourceResult.error.code==="42501"?"SIGNATURE_DOCUMENT_NOT_FOUND":"SIGNATURE_DOCUMENT_SOURCE_REQUIRED"};
  const parsed=signatureDocumentSourceSchema.safeParse(sourceResult.data);if(!parsed.success)return{ok:false,code:"SIGNATURE_DOCUMENT_SOURCE_REQUIRED"};const source=parsed.data;
  if(source.source_kind!==input.kind||(input.kind==="CONTRACT"&&(source.contract_id!==input.contractId||(input.contractVersionId&&source.contract_version_id!==input.contractVersionId)))||(input.kind==="AMENDMENT"&&source.source_id!==input.amendmentId))return{ok:false,code:"SIGNATURE_DOCUMENT_NOT_FOUND"};
  const prior=await Promise.all((["fr","ar"]as const).map(async language=>{
   const found=await client.rpc("get_signature_document_archive_v1",{p_source_kind:source.source_kind,p_source_id:source.source_id,p_locale:language}).abortSignal(AbortSignal.timeout(5000));
   if(found.error)throw new Error("SIGNATURE_DOCUMENT_UNAVAILABLE");if(found.data===null)return null;const artifact=signatureArchiveArtifactSchema.parse(found.data);if(!matches(artifact,source,language))throw new Error("SIGNATURE_DOCUMENT_INTEGRITY_FAILED");return artifact;
  }));
  if(prior.some(Boolean)&&prior.some(a=>a===null))return{ok:false,code:"SIGNATURE_DOCUMENT_ARCHIVE_PAIR_INCOMPLETE"};
  const admin=adminFactory();let artifacts:SignatureArchiveArtifact[];
  if(prior.every(a=>a!==null))artifacts=prior as SignatureArchiveArtifact[];
  else{
   const prepared=await Promise.all((["fr","ar"]as const).map(async language=>{
    const bytes=await renderSignatureDocumentPdf(source,language);if(bytes.length<5||bytes.length>MAX_BYTES||bytes.subarray(0,5).toString()!=="%PDF-")throw new Error("SIGNATURE_DOCUMENT_RENDER_INVALID");
    const pdfSha=digest(bytes),path=`${source.source_kind.toLowerCase()}/${source.source_id}/${source.source_hash}/${language}/${pdfSha}.pdf`;
    const upload=await admin.storage.from(BUCKET).upload(path,bytes,{contentType:"application/pdf",cacheControl:"0",upsert:false});
    if(upload.error&&String((upload.error as{statusCode?:unknown}).statusCode??"")!=="409")throw new Error("SIGNATURE_DOCUMENT_UPLOAD_FAILED");
    const candidate={locale:language,storage_path:path,pdf_sha256:pdfSha,size_bytes:bytes.length};
    if(!await readback(admin,candidate))throw new Error("SIGNATURE_DOCUMENT_READBACK_FAILED");return candidate;
   }));
   const registered=await admin.rpc("register_signature_document_archive_pair_v1",{p_source_kind:source.source_kind,p_source_id:source.source_id,p_actor_id:actorId,p_source_hash:source.source_hash,p_parties_hash:source.parties_hash,p_render_version:SIGNATURE_DOCUMENT_RENDER_VERSION,p_artifacts:prepared}).abortSignal(AbortSignal.timeout(5000));
   if(registered.error||!Array.isArray(registered.data)||registered.data.length!==2)return unavailable();
   artifacts=registered.data.map(a=>signatureArchiveArtifactSchema.parse(a));
   if(!(["fr","ar"]as const).every(language=>artifacts.some(a=>matches(a,source,language))))return unavailable();
  }
  const artifact=artifacts.find(a=>matches(a,source,locale));if(!artifact)return unavailable();
  const bytes=await readback(admin,artifact);if(!bytes)return{ok:false,code:"SIGNATURE_DOCUMENT_INTEGRITY_FAILED"};
  // Recheck the authenticated RPC after rendering/storage I/O, including revoked memberships/sessions.
  const final=await client.rpc("get_signature_document_archive_v1",{p_source_kind:source.source_kind,p_source_id:source.source_id,p_locale:locale}).abortSignal(AbortSignal.timeout(5000));
  const checked=signatureArchiveArtifactSchema.safeParse(final.data);
  if(final.error||!checked.success||checked.data.id!==artifact.id||!matches(checked.data,source,locale))return{ok:false,code:"SIGNATURE_DOCUMENT_NOT_FOUND"};
  return{ok:true,artifact,bytes,sourceId:source.source_id};
 }catch{return unavailable();}
}
