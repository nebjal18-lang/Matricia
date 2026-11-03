import { expect, it, vi } from "vitest";
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:vi.fn()}));
import { sha256 } from "./meta-media";
import { runMetaMediaStep } from "./meta-media-runner";
import type { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
const executionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",token="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function setup(state:string,overrides:Record<string,unknown>={},asset:unknown=null){
 const trace:string[]=[];const rpc=vi.fn<(name:string,args?:Record<string,unknown>)=>Promise<{data:unknown;error:{code:string}|null}>>(async(name,args)=>{trace.push(name==="advance_social_media_step_v1"?String(args?.p_state):"CLAIM");return name==="claim_social_media_step_v1"?{data:{outcome:"MEDIA_STEP_CLAIMED",worker_token:token,asset,execution:{id:executionId,state,account_reference:"123456",caption:"approved",public_asset_url:"https://assets.test/photo",container_id:"444444",publication_id:"555555",started_at:"2026-10-31T10:00:00Z",deadline_at:"2026-10-31T10:30:00Z",...overrides},job:{outcome:"JOB_CLAIMED",job_id:executionId,lease_token:token,provider_idempotency_key:"stable-request",attempt:1,provider:"META",channel:"INSTAGRAM",credential_reference:"env://META_TEST",content:{language:"FR",hook:"h",body:"b",cta:"c",hashtags:[],landing_url:"https://app.test/cta"}}},error:null}:{data:{outcome:"MEDIA_STEP_RECORDED"},error:null};});
 const request=vi.fn<typeof fetch>().mockImplementation(async()=>{trace.push("POST");return Response.json({id:state==="READY"?"444444":"555555"});});const resolveCredential=()=>JSON.stringify({accessToken:"test-credential-".repeat(3),targetId:"123456",graphVersion:"v23.0"});
 return {trace,rpc,request,runtime:{client:{rpc} as unknown as ReturnType<typeof getSupabaseAdminClient>,request,resolveCredential,liveEnabled:true}};
}
it.each([["READY","CREATE_STARTED","CONTAINER_CREATED"],["READY_TO_PUBLISH","PUBLISH_STARTED","VERIFYING"]])("persists %s POST start before HTTP and its exact returned identifier afterwards",async(state,start,end)=>{
 const s=setup(state);expect(await runMetaMediaStep(s.runtime)).toBe(end);expect(s.trace).toEqual(["CLAIM",start,"POST",end]);
});
it("does not call the provider when persisting a POST-start fails",async()=>{
 const s=setup("READY");const implementation=s.rpc.getMockImplementation()!;s.rpc.mockImplementation(async(name,args)=>name==="advance_social_media_step_v1"?{data:null,error:{code:"failure"}}:implementation(name,args));await expect(runMetaMediaStep(s.runtime)).rejects.toMatchObject({code:"META_STEP_PERSIST_FAILED"});expect(s.request).not.toHaveBeenCalled();
});
it("records unknown response and never retries POST",async()=>{
 const s=setup("READY_TO_PUBLISH");s.request.mockRejectedValue(new Error("socket closed"));expect(await runMetaMediaStep(s.runtime)).toBe("UNKNOWN");expect(s.trace).toEqual(["CLAIM","PUBLISH_STARTED","UNKNOWN"]);expect(s.request).toHaveBeenCalledTimes(1);
});
it("resumes ambiguous known container using GET only",async()=>{
 const s=setup("UNKNOWN",{publication_id:null});s.request.mockImplementation(async(_url,init)=>{expect(init?.method).toBe("GET");return Response.json({id:"444444",status_code:"IN_PROGRESS"});});expect(await runMetaMediaStep(s.runtime)).toBe("UNKNOWN");expect(s.request).toHaveBeenCalledTimes(1);expect(s.trace).toEqual(["CLAIM","UNKNOWN"]);
});
it("waits durably on asynchronous video processing without publish",async()=>{
 const s=setup("PROCESSING");s.request.mockResolvedValue(Response.json({id:"444444",status_code:"IN_PROGRESS"}));expect(await runMetaMediaStep(s.runtime)).toBe("PROCESSING");expect(s.request.mock.calls[0]?.[1]?.method).toBe("GET");expect(s.trace).toEqual(["CLAIM","PROCESSING"]);
});
it("refuses a different configured account before any provider call",async()=>{
 const s=setup("READY",{account_reference:"999999"});await expect(runMetaMediaStep(s.runtime)).rejects.toMatchObject({code:"META_ACCOUNT_MISMATCH"});expect(s.request).not.toHaveBeenCalled();
});

it("freezes exact approved bytes only after a durable authorization and never overwrites a public asset",async()=>{
 const bytes=new Uint8Array([255,216,255,1,2,3,4,5,6,7,8,9]);const hash=sha256(bytes);const asset={id:executionId,sha256:hash,media_type:"image/jpeg",byte_length:12,storage_path:`org/job/${hash}`};const s=setup("ASSET_REQUIRED",{},asset);
 const upload=vi.fn(async()=>{s.trace.push("PUBLIC_UPLOAD");return {error:null};});const download=vi.fn(async()=>({data:new Blob([bytes]),error:null}));const storage={from:vi.fn(()=>({download,upload,getPublicUrl:()=>({data:{publicUrl:`https://assets.test/storage/v1/object/public/marketing-media-public/${asset.storage_path}`}})}))};
 s.runtime.client={rpc:s.rpc,storage} as unknown as ReturnType<typeof getSupabaseAdminClient>;
 expect(await runMetaMediaStep(s.runtime)).toBe("READY");expect(s.trace).toEqual(["CLAIM","FREEZING","PUBLIC_UPLOAD","READY"]);expect(upload).toHaveBeenCalledWith(asset.storage_path,bytes,expect.objectContaining({upsert:false}));expect(s.request).not.toHaveBeenCalled();
});
it("rejects an altered source before any public copy or Meta call",async()=>{
 const s=setup("ASSET_REQUIRED",{},{id:executionId,sha256:"a".repeat(64),media_type:"image/jpeg",byte_length:12,storage_path:"org/job/hash"});const upload=vi.fn();s.runtime.client={rpc:s.rpc,storage:{from:()=>({download:async()=>({data:new Blob([new Uint8Array(12)]),error:null}),upload})}} as unknown as ReturnType<typeof getSupabaseAdminClient>;
 expect(await runMetaMediaStep(s.runtime)).toBe("FAILED");expect(upload).not.toHaveBeenCalled();expect(s.request).not.toHaveBeenCalled();
});
