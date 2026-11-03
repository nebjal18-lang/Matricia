import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({access:vi.fn(),rpc:vi.fn(),adminRpc:vi.fn(),signed:vi.fn(),download:vi.fn()}));
vi.mock("@/modules/shared/lib/account-security/platform-access",()=>({loadMyPlatformAccess:mocks.access,hasPlatformRole:(roles:Set<string>,allowed:string[])=>allowed.some(role=>roles.has(role))}));
vi.mock("@/modules/shared/lib/marketing-autopilot/meta-admin-client",()=>({getMetaAdminClient:()=>({rpc:mocks.adminRpc,storage:{from:()=>({createSignedUploadUrl:mocks.signed,download:mocks.download})}})}));
import { POST } from "./route";
import { sha256 } from "@/modules/shared/lib/marketing-autopilot/meta-media";
const bytes=new Uint8Array([255,216,255,1,2,3,4,5,6,7,8,9]);
const metadata={action:"reserve",jobId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",sha256:sha256(bytes),mediaType:"image/jpeg",byteLength:bytes.length,publicUseApproved:true};
const req=(body:unknown=metadata,origin="https://app.test")=>new Request("https://app.test/api/marketing/media-assets",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mocks.access.mockResolvedValue({status:"ok",requirementSatisfied:true,roles:new Set(["SUPER_ADMIN"]),client:{rpc:mocks.rpc}});mocks.rpc.mockResolvedValue({data:{asset_id:metadata.jobId,storage_path:"org/job/hash",uploaded:false},error:null});mocks.signed.mockResolvedValue({data:{token:"ephemeral-upload-token"},error:null});mocks.download.mockResolvedValue({data:new Blob([bytes]),error:null});mocks.adminRpc.mockResolvedValue({error:null});});
it("authorizes AAL2 platform actor before reserving or issuing a private upload capability",async()=>{
 mocks.access.mockResolvedValue({status:"error"});expect((await POST(req())).status).toBe(403);expect(mocks.rpc).not.toHaveBeenCalled();expect(mocks.signed).not.toHaveBeenCalled();
});
it("requires same origin and explicit public-use approval",async()=>{
 expect((await POST(req(metadata,"https://attacker.test"))).status).toBe(403);expect((await POST(req({...metadata,publicUseApproved:false}))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
});
it("persists exact hash and approval before issuing a non-overwriting signed source upload",async()=>{
 const response=await POST(req());expect(response.status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith("reserve_social_media_asset_v1",expect.objectContaining({p_sha256:sha256(bytes),p_public_use_approved:true}));expect(mocks.signed).toHaveBeenCalledWith("org/job/hash",{upsert:false});expect(await response.json()).toMatchObject({code:"MEDIA_UPLOAD_RESERVED"});expect(mocks.adminRpc).not.toHaveBeenCalled();
});
it("only records the registration after reading and hashing actual source bytes",async()=>{
 expect((await POST(req({...metadata,action:"finalize"}))).status).toBe(200);expect(mocks.adminRpc).toHaveBeenCalledWith("complete_social_media_asset_v1",{p_asset_id:metadata.jobId,p_sha256:sha256(bytes)});
});
it("rejects changed source bytes and forged MIME before any registration",async()=>{
 mocks.download.mockResolvedValue({data:new Blob([new Uint8Array(12)]),error:null});expect((await POST(req({...metadata,action:"finalize"}))).status).toBe(422);expect(mocks.adminRpc).not.toHaveBeenCalled();
});
it("refuses oversized metadata bodies",async()=>{expect((await POST(req({...metadata,extra:"a".repeat(5000)}))).status).toBe(413);expect(mocks.rpc).not.toHaveBeenCalled();});
