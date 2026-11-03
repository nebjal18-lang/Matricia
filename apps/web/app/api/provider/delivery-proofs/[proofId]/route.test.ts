import { beforeEach,describe,expect,it,vi } from "vitest";
const mock=vi.hoisted(()=>({user:vi.fn(),from:vi.fn(),sign:vi.fn(),single:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mock.user},from:mock.from,storage:{from:()=>({createSignedUrl:mock.sign})}})}));
import { GET } from "./route";
const id="a1000000-0000-4000-8000-000000000001",params={params:Promise.resolve({proofId:id})},request=new Request(`https://matricia.test.invalid/api/provider/delivery-proofs/${id}`);
beforeEach(()=>{vi.clearAllMocks();mock.user.mockResolvedValue({data:{user:{id}}});const chain={select:()=>chain,eq:()=>chain,maybeSingle:mock.single};mock.from.mockReturnValue(chain);mock.single.mockResolvedValue({data:{storage_bucket:"delivery-proofs",storage_path:"private/report.pdf",scan_status:"CLEAN",url:null},error:null});mock.sign.mockResolvedValue({data:{signedUrl:"https://storage.test.invalid/private/report.pdf?signed=test"},error:null})});
describe("private delivery proof download",()=>{
 it("uses the user-bound client and a short-lived original private file",async()=>{const response=await GET(request,params);expect(response.status).toBe(303);expect(response.headers.get("Cache-Control")).toBe("private, no-store");expect(mock.sign).toHaveBeenCalledWith("private/report.pdf",60,{download:true})});
 it("refuses an unauthenticated download before any object lookup",async()=>{mock.user.mockResolvedValue({data:{user:null}});expect((await GET(request,params)).status).toBe(401);expect(mock.from).not.toHaveBeenCalled()});
 it("does not disclose an unknown, foreign or unassigned object",async()=>{mock.single.mockResolvedValue({data:null,error:null});expect((await GET(request,params)).status).toBe(404);expect(mock.sign).not.toHaveBeenCalled()});
 it("never signs a quarantined original",async()=>{mock.single.mockResolvedValue({data:{storage_bucket:"delivery-proofs",storage_path:"private/report.pdf",scan_status:"PENDING",url:null},error:null});expect((await GET(request,params)).status).toBe(409);expect(mock.sign).not.toHaveBeenCalled()});
 it("separates a technical read outage from absence of an authorized object",async()=>{mock.single.mockResolvedValue({data:null,error:{code:"08006"}});expect((await GET(request,params)).status).toBe(503);expect(mock.sign).not.toHaveBeenCalled()});
});
