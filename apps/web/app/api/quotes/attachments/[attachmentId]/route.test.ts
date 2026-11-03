import {createHash} from "node:crypto";
import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn(),admin:vi.fn(),download:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.user},rpc:mocks.rpc})}));
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:mocks.admin}));
import {GET} from "./route";
const id="f3460000-0000-4000-8000-000000000001",bytes=Buffer.from("%PDF-test original"),sha=createHash("sha256").update(bytes).digest("hex");
const grant={attachment_id:id,title:"Référence test.pdf",bucket:"provider-qualification",object_path:"test-scope/immutable-reference",sha256:sha,mime_type:"application/pdf",size_bytes:String(bytes.length)};
const request=()=>GET(new Request("https://matricia.test.invalid/api/quotes/attachments/"+id),{params:Promise.resolve({attachmentId:id})});
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({data:{user:{id:"native-user"}},error:null});mocks.rpc.mockResolvedValue({data:grant,error:null});mocks.download.mockResolvedValue({data:new Blob([bytes]),error:null});mocks.admin.mockReturnValue({storage:{from:()=>({download:mocks.download})}});});
describe("private quote original download",()=>{
 it("downloads the authorized immutable bytes with private no-store headers",async()=>{const result=await request();expect(result.status).toBe(200);expect(Buffer.from(await result.arrayBuffer())).toEqual(bytes);expect(result.headers.get("cache-control")).toBe("no-store, private");expect(result.headers.get("content-disposition")).toContain("attachment;");expect(mocks.rpc).toHaveBeenCalledWith("authorize_quote_attachment_download_v1",{p_attachment_id:id});});
 it.each(["42501","55000"])("refuses %s before any privileged Storage access",async code=>{mocks.rpc.mockResolvedValue({data:null,error:{code}});expect((await request()).status).toBe(code==="42501"?403:409);expect(mocks.admin).not.toHaveBeenCalled();});
 it("rejects a different object in an otherwise valid authorization",async()=>{mocks.rpc.mockResolvedValue({data:{...grant,attachment_id:"f3460000-0000-4000-8000-000000000002"},error:null});expect((await request()).status).toBe(503);expect(mocks.admin).not.toHaveBeenCalled();});
 it("rejects tampered Storage bytes even when their size is unchanged",async()=>{mocks.download.mockResolvedValue({data:new Blob([Buffer.alloc(bytes.length,120)]),error:null});const response=await request();expect(response.status).toBe(503);expect(await response.json()).toEqual({code:"QUOTE_ATTACHMENT_INTEGRITY_FAILED"});});
 it("separates an Auth outage from an expired session",async()=>{mocks.user.mockResolvedValue({data:{user:null},error:{status:503}});expect((await request()).status).toBe(503);expect(mocks.rpc).not.toHaveBeenCalled();});
});
