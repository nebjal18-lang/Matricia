import {createHash} from "node:crypto";
import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn(),admin:vi.fn(),download:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.user},rpc:mocks.rpc})}));
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:mocks.admin}));
import {GET} from "./route";
const id="11111111-1111-4111-8111-111111111111",bytes=Buffer.from("%PDF-TEST private"),hash=createHash("sha256").update(bytes).digest("hex");
const request=()=>GET(new Request("https://app.test/api/internal-messages/attachments/"+id),{params:Promise.resolve({attachmentId:id})});
beforeEach(()=>{vi.resetAllMocks();mocks.user.mockResolvedValue({data:{user:{id}}});mocks.rpc.mockResolvedValue({data:{bucket:"private-message-attachments",path:`internal-messages/${id}/${id}/${id}`,sha256:hash,mime_type:"application/pdf",size_bytes:bytes.length,name:'preuve اسم "test".pdf'},error:null});mocks.download.mockResolvedValue({data:new Blob([bytes]),error:null});mocks.admin.mockReturnValue({storage:{from:()=>({download:mocks.download})}});});
describe("private message attachment bytes",()=>{
 it("requires authentication before using any privileged download",async()=>{mocks.user.mockResolvedValue({data:{user:null}});expect((await request()).status).toBe(401);expect(mocks.admin).not.toHaveBeenCalled();});
 it("does not escalate a cross-tenant, quarantined, or preselection attachment denied by SQL",async()=>{mocks.rpc.mockResolvedValue({data:null,error:{code:"42501"}});expect((await request()).status).toBe(404);expect(mocks.admin).not.toHaveBeenCalled();});
 it("refuses a storage bucket or path outside the authorized archive contract",async()=>{mocks.rpc.mockResolvedValue({data:{bucket:"public",path:"https://foreign.test",sha256:hash,mime_type:"application/pdf",size_bytes:bytes.length,name:"fake.pdf"},error:null});expect((await request()).status).toBe(503);expect(mocks.admin).not.toHaveBeenCalled();});
 it("returns exact archived bytes privately with a safe download name",async()=>{const r=await request();expect(r.status).toBe(200);expect(Buffer.from(await r.arrayBuffer())).toEqual(bytes);expect(r.headers.get("cache-control")).toBe("no-store");expect(r.headers.get("content-disposition")).toContain("filename*=UTF-8''");expect(r.headers.get("x-content-type-options")).toBe("nosniff");});
 it("refuses substituted bytes even with the same length",async()=>{mocks.download.mockResolvedValue({data:new Blob([Buffer.alloc(bytes.length)]),error:null});expect((await request()).status).toBe(503);});
 it("refuses a truncated or oversized response before returning private bytes",async()=>{mocks.download.mockResolvedValue({data:new Blob([bytes,bytes]),error:null});expect((await request()).status).toBe(503);});
 it("reports a storage outage without returning private bytes or claiming availability",async()=>{mocks.download.mockRejectedValue(new Error("unavailable"));expect((await request()).status).toBe(503);});
});
