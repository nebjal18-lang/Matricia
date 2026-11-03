import { z } from "zod";

const contentSchema=z.object({language:z.enum(["FR","AR"]),hook:z.string().max(300),body:z.string().max(6000),cta:z.string().max(300),hashtags:z.array(z.string()).max(30),landing_url:z.string().url(),media_url:z.string().url().nullable().optional()});
export const publicationJobSchema=z.object({outcome:z.literal("JOB_CLAIMED"),job_id:z.string().uuid(),lease_token:z.string().uuid(),provider_idempotency_key:z.string().min(8).max(200),attempt:z.number().int().positive(),provider:z.enum(["LINKEDIN","META"]),channel:z.enum(["LINKEDIN","FACEBOOK","INSTAGRAM","REEL"]),credential_reference:z.string().regex(/^(?:env|vault):\/\/[A-Z][A-Z0-9_]{2,99}$/),content:contentSchema});
export type PublicationJob=z.infer<typeof publicationJobSchema>;
export type PublicationResult={outcome:"PUBLISHED";providerPublicationId:string}|{outcome:"SANDBOXED"}|{outcome:"RETRYABLE_FAILURE"|"PERMANENT_FAILURE"|"RECONCILIATION_REQUIRED";errorCode:string};
type Runtime={mode:"sandbox"|"live";liveEnabled:boolean;resolveCredential:(reference:string)=>string|null|Promise<string|null>;fetch:typeof fetch};
const linkedInCredential=z.object({accessToken:z.string().min(20),authorUrn:z.string().regex(/^urn:li:(?:person|organization):[A-Za-z0-9_-]+$/),apiVersion:z.string().regex(/^20\d{4}$/)});
const metaCredential=z.object({accessToken:z.string().min(20),targetId:z.string().regex(/^\d{3,40}$/),graphVersion:z.string().regex(/^v\d{2,3}\.\d$/)});
export const PROVIDER_REQUEST_TIMEOUT_MS=20_000;
export const MAX_PUBLICATION_JOB_MS=2*PROVIDER_REQUEST_TIMEOUT_MS;

export async function publishScheduledSocial(job:PublicationJob,runtime:Runtime):Promise<PublicationResult>{
  if(runtime.mode==="sandbox")return{outcome:"SANDBOXED"};
  if(!runtime.liveEnabled)return{outcome:"PERMANENT_FAILURE",errorCode:"LIVE_PUBLISHING_DISABLED"};
  let raw:string|null;
  try{raw=await runtime.resolveCredential(job.credential_reference)}catch{return{outcome:"PERMANENT_FAILURE",errorCode:"CREDENTIAL_REFERENCE_UNRESOLVED"}}
  if(!raw)return{outcome:"PERMANENT_FAILURE",errorCode:"CREDENTIAL_REFERENCE_UNRESOLVED"};
  let credential:unknown;try{credential=JSON.parse(raw) as unknown}catch{return{outcome:"PERMANENT_FAILURE",errorCode:"INVALID_CREDENTIAL_CONFIGURATION"}}
  try{return job.provider==="LINKEDIN"?await publishLinkedIn(job,linkedInCredential.parse(credential),runtime.fetch):await publishMeta(job,metaCredential.parse(credential),runtime.fetch)}catch(error){return error instanceof z.ZodError?{outcome:"PERMANENT_FAILURE",errorCode:"INVALID_CREDENTIAL_CONFIGURATION"}:{outcome:"RECONCILIATION_REQUIRED",errorCode:"PROVIDER_RESPONSE_UNKNOWN"}}
}

export function publicationMessage(job:PublicationJob){return [job.content.hook,job.content.body,job.content.cta,job.content.landing_url,job.content.hashtags.join(" ")].filter(Boolean).join("\n\n").slice(0,6000)}
async function publishLinkedIn(job:PublicationJob,credential:z.infer<typeof linkedInCredential>,request:typeof fetch):Promise<PublicationResult>{
  if(job.channel!=="LINKEDIN")return{outcome:"PERMANENT_FAILURE",errorCode:"PROVIDER_CHANNEL_MISMATCH"};
  const response=await request("https://api.linkedin.com/rest/posts",{method:"POST",headers:{authorization:`Bearer ${credential.accessToken}`,"content-type":"application/json","linkedin-version":credential.apiVersion,"x-restli-protocol-version":"2.0.0"},body:JSON.stringify({author:credential.authorUrn,commentary:publicationMessage(job),visibility:"PUBLIC",distribution:{feedDistribution:"MAIN_FEED",targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:"PUBLISHED",isReshareDisabledByAuthor:false}),signal:AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS)});
  if(response.status===201){const id=response.headers.get("x-restli-id");return id?{outcome:"PUBLISHED",providerPublicationId:id}:{outcome:"RECONCILIATION_REQUIRED",errorCode:"PROVIDER_ID_MISSING"}}
  return providerFailure(response.status);
}
async function publishMeta(job:PublicationJob,credential:z.infer<typeof metaCredential>,request:typeof fetch):Promise<PublicationResult>{
  const base=`https://graph.facebook.com/${credential.graphVersion}/${credential.targetId}`,headers={authorization:`Bearer ${credential.accessToken}`,"content-type":"application/json"};
  if(job.channel==="FACEBOOK"){const response=await request(`${base}/feed`,{method:"POST",headers,body:JSON.stringify({message:publicationMessage(job),link:job.content.landing_url}),signal:AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS)});return jsonId(response)}
  if(job.channel!=="INSTAGRAM"&&job.channel!=="REEL")return{outcome:"PERMANENT_FAILURE",errorCode:"PROVIDER_CHANNEL_MISMATCH"};
  return {outcome:"PERMANENT_FAILURE",errorCode:"META_DURABLE_EXECUTOR_REQUIRED"};
}
async function jsonId(response:Response):Promise<PublicationResult>{if(!response.ok)return providerFailure(response.status);const parsed=z.object({id:z.string().min(1)}).safeParse(await response.json());return parsed.success?{outcome:"PUBLISHED",providerPublicationId:parsed.data.id}:{outcome:"RECONCILIATION_REQUIRED",errorCode:"PROVIDER_ID_MISSING"}}
function providerFailure(status:number):PublicationResult{return status===408||status>=500?{outcome:"RECONCILIATION_REQUIRED",errorCode:"PROVIDER_RESPONSE_UNKNOWN"}:status===425||status===429?{outcome:"RETRYABLE_FAILURE",errorCode:`PROVIDER_HTTP_${status}`}:{outcome:"PERMANENT_FAILURE",errorCode:`PROVIDER_HTTP_${status}`}}
