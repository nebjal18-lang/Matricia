import { beforeEach,describe,expect,it,vi } from "vitest";
import { source } from "@/modules/client/data/billing/__fixtures__/source";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),admin:vi.fn(),archive:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:mocks.admin}));
vi.mock("@/modules/client/data/billing/artifacts",()=>({archiveClientCommercialDocument:mocks.archive}));
import { GET } from "./route";
const params=()=>({params:Promise.resolve({documentId:source.id})});
const request=()=>new Request(`https://test.invalid/api/client/billing/documents/${source.id}?locale=ar`);
describe("Client commercial PDF download",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:"actor"}}});mocks.rpc.mockResolvedValue({data:source,error:null});mocks.admin.mockReturnValue({});mocks.archive.mockResolvedValue({ok:true,bytes:Buffer.from("%PDF-client-finance"),artifact:{}});});
 it("does not reach privileged Storage without authentication",async()=>{mocks.getUser.mockResolvedValue({data:{user:null}});expect((await GET(request(),params())).status).toBe(401);expect(mocks.admin).not.toHaveBeenCalled();});
 it("refuses another organization before accessing Storage",async()=>{mocks.rpc.mockResolvedValue({data:null,error:{code:"42501"}});expect((await GET(request(),params())).status).toBe(403);expect(mocks.admin).not.toHaveBeenCalled();});
 it("returns the authorized translation privately",async()=>{const response=await GET(request(),params());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store, private");expect(response.headers.get("content-disposition")).toContain("-ar.pdf");expect(mocks.archive).toHaveBeenCalledWith(source,expect.anything(),"ar");});
 it("keeps an unavailable archive in an error state",async()=>{mocks.archive.mockResolvedValue({ok:false,code:"CLIENT_BILLING_UNAVAILABLE"});const response=await GET(request(),params());expect(response.status).toBe(503);expect(await response.json()).toEqual({code:"CLIENT_BILLING_UNAVAILABLE"});});
});
