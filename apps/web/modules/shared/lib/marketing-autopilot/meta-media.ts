import { createHash } from "node:crypto";
import { z } from "zod";
import { publicationMessage, type PublicationJob } from "./publisher";

export const metaCredentialSchema = z.object({ accessToken:z.string().min(20), targetId:z.string().regex(/^\d{3,40}$/u), graphVersion:z.string().regex(/^v\d{2,3}\.\d$/u) });
export type MetaCredential = z.infer<typeof metaCredentialSchema>;
export const META_STEP_TIMEOUT_MS = 5_000;
const idSchema=z.string().regex(/^\d{3,40}$/u);
export class MetaMediaError extends Error { constructor(readonly code:string) { super(code); } }
export function metaMediaCaption(job:PublicationJob, executionId:string) {
 const landing = new URL(job.content.landing_url);
 if(landing.protocol!=="https:"||landing.username||landing.password)throw new MetaMediaError("META_TRACKING_URL_INVALID");
 landing.searchParams.set("mref",executionId);
 const caption=publicationMessage({...job,content:{...job.content,landing_url:landing.toString()}});
 if(caption.length>2200)throw new MetaMediaError("META_CAPTION_TOO_LONG");
 return caption;
}
export function mediaBytesValid(bytes:Uint8Array,mediaType:string) {
 return mediaType==="image/jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
 mediaType==="image/png"?Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])):
 mediaType==="video/mp4"?bytes.length>12&&Buffer.from(bytes.subarray(4,8)).toString("ascii")==="ftyp":false;
}
export function sha256(bytes:Uint8Array|string){return createHash("sha256").update(bytes).digest("hex");}
async function nativeRequest(credential:MetaCredential,path:string,request:typeof fetch,body?:URLSearchParams):Promise<{data:unknown;hash:string}> {
 const response=await request(`https://graph.facebook.com/${credential.graphVersion}/${path}`,{method:body?"POST":"GET",headers:{authorization:`Bearer ${credential.accessToken}`,...(body?{"content-type":"application/x-www-form-urlencoded"}:{})},body:body?.toString(),redirect:"error",signal:AbortSignal.timeout(META_STEP_TIMEOUT_MS)});
 if(!response.ok)throw new MetaMediaError(body?"META_POST_RESULT_UNKNOWN":"META_NATIVE_LOOKUP_FAILED");
 const reader=response.body?.getReader();if(!reader)throw new MetaMediaError("META_NATIVE_RESPONSE_INVALID");
 const chunks:Uint8Array[]=[];let size=0;for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>256*1024){await reader.cancel();throw new MetaMediaError("META_NATIVE_RESPONSE_TOO_LARGE");}chunks.push(chunk.value);}
 const bytes=Buffer.concat(chunks);let data:unknown;try{data=JSON.parse(bytes.toString("utf8"));}catch{throw new MetaMediaError("META_NATIVE_RESPONSE_INVALID");}return {data,hash:sha256(bytes)};
}
export async function createMetaContainer(credential:MetaCredential,input:{channel:"INSTAGRAM"|"REEL";assetUrl:string;caption:string},request:typeof fetch) {
 const url=new URL(input.assetUrl);if(url.protocol!=="https:"||url.username||url.password)throw new MetaMediaError("META_ASSET_URL_INVALID");
 const body=new URLSearchParams({caption:input.caption,...(input.channel==="REEL"?{media_type:"REELS",video_url:url.toString()}:{image_url:url.toString()})});
 const result=await nativeRequest(credential,`${credential.targetId}/media`,request,body);const parsed=z.object({id:idSchema}).safeParse(result.data);
 if(!parsed.success)throw new MetaMediaError("META_CREATE_RESPONSE_UNKNOWN");return {containerId:parsed.data.id,responseHash:result.hash};
}
export async function inspectMetaContainer(credential:MetaCredential,containerId:string,request:typeof fetch) {
 if(!idSchema.safeParse(containerId).success)throw new MetaMediaError("META_CONTAINER_ID_INVALID");
 const result=await nativeRequest(credential,`${containerId}?fields=id,status_code,status`,request);const parsed=z.object({id:idSchema,status_code:z.enum(["IN_PROGRESS","FINISHED","ERROR","EXPIRED","PUBLISHED"])}).safeParse(result.data);
 if(!parsed.success||parsed.data.id!==containerId)throw new MetaMediaError("META_CONTAINER_PROOF_INVALID");return {...parsed.data,responseHash:result.hash};
}
export async function publishMetaContainer(credential:MetaCredential,containerId:string,request:typeof fetch) {
 if(!idSchema.safeParse(containerId).success)throw new MetaMediaError("META_CONTAINER_ID_INVALID");
 const result=await nativeRequest(credential,`${credential.targetId}/media_publish`,request,new URLSearchParams({creation_id:containerId}));const parsed=z.object({id:idSchema}).safeParse(result.data);
 if(!parsed.success)throw new MetaMediaError("META_PUBLISH_RESPONSE_UNKNOWN");return {publicationId:parsed.data.id,responseHash:result.hash};
}
const mediaSchema=z.object({id:idSchema,caption:z.string(),owner:z.union([idSchema,z.object({id:idSchema})]),timestamp:z.string().datetime({offset:true}),media_type:z.enum(["IMAGE","VIDEO","CAROUSEL_ALBUM"]),media_product_type:z.string().optional()});
export async function verifyMetaMedia(credential:MetaCredential,input:{containerId:string;publicationId:string|null;caption:string;channel:"INSTAGRAM"|"REEL";startedAt:string;deadlineAt:string},request:typeof fetch) {
 const container=await inspectMetaContainer(credential,input.containerId,request);
 if(container.status_code!=="PUBLISHED")throw new MetaMediaError("META_CONTAINER_NOT_PUBLISHED");
 const fields="id,caption,owner,timestamp,media_type,media_product_type";const hashes=[container.responseHash];let found:z.infer<typeof mediaSchema>|null=null;
 const matches=(value:unknown)=>{const parsed=mediaSchema.safeParse(value);if(!parsed.success)return null;const media=parsed.data;const owner=typeof media.owner==="string"?media.owner:media.owner.id;const time=Date.parse(media.timestamp);return owner===credential.targetId&&media.caption===input.caption&&time>=Date.parse(input.startedAt)-5000&&time<=Date.parse(input.deadlineAt)+5000&&(input.channel==="REEL"?media.media_type==="VIDEO"&&media.media_product_type==="REELS":media.media_type==="IMAGE")?media:null;};
 if(input.publicationId){if(!idSchema.safeParse(input.publicationId).success)throw new MetaMediaError("META_PUBLICATION_ID_INVALID");const result=await nativeRequest(credential,`${input.publicationId}?fields=${fields}`,request);hashes.push(result.hash);found=matches(result.data);if(found?.id!==input.publicationId)throw new MetaMediaError("META_PUBLICATION_PROOF_MISMATCH");}
 else {
  // Fixed-host cursor requests only. Never follow provider-controlled paging.next URLs.
  let after:string|undefined;let covered=false;let previousTime=Infinity;
  for(let page=0;page<3;page++){
   const params=new URLSearchParams({fields,limit:"100",...(after?{after}:{})});const result=await nativeRequest(credential,`${credential.targetId}/media?${params}`,request);hashes.push(result.hash);
   const parsed=z.object({data:z.array(z.unknown()).max(100),paging:z.object({cursors:z.object({after:z.string().min(1).max(2048)}).optional(),next:z.string().optional()}).optional()}).safeParse(result.data);if(!parsed.success)throw new MetaMediaError("META_FEED_PROOF_INVALID");
   for(const item of parsed.data.data){const row=mediaSchema.safeParse(item);if(!row.success)throw new MetaMediaError("META_FEED_PROOF_INCOMPLETE");const time=Date.parse(row.data.timestamp);if(time>previousTime)throw new MetaMediaError("META_FEED_ORDER_UNKNOWN");previousTime=time;if(time<Date.parse(input.startedAt)-5000)covered=true;const match=matches(item);if(match){if(found)throw new MetaMediaError("META_NATIVE_PROOF_AMBIGUOUS");found=match;}}
   if(!parsed.data.paging?.next){covered=true;break;}if(covered)break;after=parsed.data.paging.cursors?.after;if(!after)throw new MetaMediaError("META_FEED_PROOF_INCOMPLETE");
  }
  if(!covered)throw new MetaMediaError("META_FEED_WINDOW_INCOMPLETE");if(!found)throw new MetaMediaError("META_NATIVE_PROOF_NOT_FOUND");
 }
 if(!found)throw new MetaMediaError("META_NATIVE_PROOF_NOT_FOUND");return {publicationId:found.id,nativeCreatedAt:found.timestamp,responseHash:sha256(hashes.join(":"))};
}
