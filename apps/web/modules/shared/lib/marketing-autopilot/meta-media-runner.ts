import { z } from "zod";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { publicationJobSchema } from "./publisher";
import { createMetaContainer, inspectMetaContainer, mediaBytesValid, metaCredentialSchema, metaMediaCaption, MetaMediaError, publishMetaContainer, sha256, verifyMetaMedia } from "./meta-media";

const executionSchema=z.object({id:z.string().uuid(),state:z.string(),account_reference:z.string(),caption:z.string().nullable(),public_asset_url:z.string().nullable(),container_id:z.string().nullable(),publication_id:z.string().nullable(),started_at:z.string(),deadline_at:z.string()});
const assetSchema=z.object({id:z.string().uuid(),sha256:z.string().regex(/^[0-9a-f]{64}$/u),media_type:z.enum(["image/jpeg","video/mp4"]),byte_length:z.number().int().max(52428800),storage_path:z.string()});
const stepSchema=z.object({outcome:z.literal("MEDIA_STEP_CLAIMED"),worker_token:z.string().uuid(),execution:executionSchema,asset:assetSchema.nullable(),job:publicationJobSchema});
type Runtime={client:ReturnType<typeof getSupabaseAdminClient>;request:typeof fetch;resolveCredential:(reference:string)=>Promise<string|null>|string|null;liveEnabled:boolean};
export async function runMetaMediaStep(runtime:Runtime,executionId?:string):Promise<string> {
 const claim=await runtime.client.rpc("claim_social_media_step_v1",{p_execution_id:executionId??null});
 if(claim.error)throw new MetaMediaError("META_STEP_CLAIM_FAILED");
 if((claim.data as {outcome?:unknown}|null)?.outcome!=="MEDIA_STEP_CLAIMED")return "NO_STEP";
 const parsed=stepSchema.safeParse(claim.data);if(!parsed.success)throw new MetaMediaError("META_STEP_CONTRACT_INVALID");
 const {execution:e,worker_token:token,job,asset}=parsed.data;
 const advance=async(state:string,evidence:Record<string,unknown>={})=>{const result=await runtime.client.rpc("advance_social_media_step_v1",{p_execution_id:e.id,p_worker_token:token,p_state:state,p_evidence:evidence});if(result.error)throw new MetaMediaError("META_STEP_PERSIST_FAILED");return state;};
 if(["ASSET_REQUIRED","FREEZING"].includes(e.state)){
  if(!asset)return advance("ASSET_REQUIRED");
  if(!runtime.liveEnabled)return advance("FAILED",{error_code:"LIVE_PUBLISHING_DISABLED"});
  await advance("FREEZING",{asset_sha256:asset.sha256});
  const source=await runtime.client.storage.from("marketing-media-source").download(asset.storage_path);if(source.error||!source.data)throw new MetaMediaError("META_SOURCE_UNAVAILABLE");
  const bytes=new Uint8Array(await source.data.arrayBuffer());if(bytes.length!==asset.byte_length||sha256(bytes)!==asset.sha256||!mediaBytesValid(bytes,asset.media_type))return advance("FAILED",{error_code:"META_ASSET_HASH_MISMATCH"});
  const target=runtime.client.storage.from("marketing-media-public");const upload=await target.upload(asset.storage_path,bytes,{contentType:asset.media_type,upsert:false,cacheControl:"31536000"});
  if(upload.error){const existing=await target.download(asset.storage_path);if(existing.error||!existing.data||sha256(new Uint8Array(await existing.data.arrayBuffer()))!==asset.sha256)throw new MetaMediaError("META_FROZEN_ASSET_CONFLICT");}
  const assetUrl=target.getPublicUrl(asset.storage_path).data.publicUrl;const caption=metaMediaCaption(job,e.id);
  return advance("READY",{asset_sha256:asset.sha256,public_asset_url:assetUrl,caption,delivery_sha256:sha256(JSON.stringify({channel:job.channel,account:e.account_reference,caption,asset_sha256:asset.sha256,asset_url:assetUrl}))});
 }
 let raw:string|null;try{raw=await runtime.resolveCredential(job.credential_reference);}catch{throw new MetaMediaError("META_CREDENTIAL_UNRESOLVED");}
 let value:unknown;try{value=JSON.parse(raw??"") as unknown;}catch{throw new MetaMediaError("META_CREDENTIAL_INVALID");}
 const credentials=metaCredentialSchema.safeParse(value);if(!credentials.success||credentials.data.targetId!==e.account_reference)throw new MetaMediaError("META_ACCOUNT_MISMATCH");const credential=credentials.data;
 if(e.state==="READY"){
  if(!runtime.liveEnabled)return advance("FAILED",{error_code:"LIVE_PUBLISHING_DISABLED"});
  if(!e.public_asset_url||!e.caption)throw new MetaMediaError("META_FROZEN_ASSET_REQUIRED");
  // Commit the POST-start before creating a container. A crash now forbids a second POST.
  await advance("CREATE_STARTED");
  try{const created=await createMetaContainer(credential,{channel:job.channel==="REEL"?"REEL":"INSTAGRAM",assetUrl:e.public_asset_url,caption:e.caption},runtime.request);return await advance("CONTAINER_CREATED",{container_id:created.containerId,response_sha256:created.responseHash});}
  catch{return advance("UNKNOWN",{error_code:"META_CREATE_RESPONSE_UNKNOWN"});}
 }
 if(["CONTAINER_CREATED","PROCESSING"].includes(e.state)){
  if(!e.container_id)throw new MetaMediaError("META_CONTAINER_REQUIRED");const inspection=await inspectMetaContainer(credential,e.container_id,runtime.request);
  return advance(inspection.status_code==="FINISHED"?"READY_TO_PUBLISH":inspection.status_code==="PUBLISHED"?"VERIFYING":["ERROR","EXPIRED"].includes(inspection.status_code)?"FAILED":"PROCESSING",{response_sha256:inspection.responseHash,...(["ERROR","EXPIRED"].includes(inspection.status_code)?{error_code:`META_CONTAINER_${inspection.status_code}`}:{})});
 }
 if(e.state==="READY_TO_PUBLISH"){
  if(!runtime.liveEnabled)return advance("FAILED",{error_code:"LIVE_PUBLISHING_DISABLED"});if(!e.container_id)throw new MetaMediaError("META_CONTAINER_REQUIRED");
  await advance("PUBLISH_STARTED");
  try{const result=await publishMetaContainer(credential,e.container_id,runtime.request);return await advance("VERIFYING",{publication_id:result.publicationId,response_sha256:result.responseHash});}
  catch{return advance("UNKNOWN",{error_code:"META_PUBLISH_RESPONSE_UNKNOWN"});}
 }
 if(["VERIFYING","UNKNOWN"].includes(e.state)&&e.container_id&&e.caption){
  try{const proof=await verifyMetaMedia(credential,{containerId:e.container_id,publicationId:e.publication_id,caption:e.caption,channel:job.channel==="REEL"?"REEL":"INSTAGRAM",startedAt:e.started_at,deadlineAt:e.deadline_at},runtime.request);return await advance("PUBLISHED",{publication_id:proof.publicationId,native_created_at:proof.nativeCreatedAt,response_sha256:proof.responseHash,container_state:"PUBLISHED"});}
  catch(error){return advance("UNKNOWN",{error_code:error instanceof MetaMediaError?error.code:"META_NATIVE_LOOKUP_UNKNOWN"});}
 }
 return advance("UNKNOWN",{error_code:"META_STEP_REQUIRES_INVESTIGATION"});
}
