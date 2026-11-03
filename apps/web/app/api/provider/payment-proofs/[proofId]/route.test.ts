import {createHash} from "node:crypto";
import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),admin:vi.fn(),download:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},from:mocks.from})}));
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:mocks.admin}));
import {GET} from "./route";
const id="11111111-1111-4111-8111-111111111111",path=`${id}/${id}/${id}.pdf`,bytes=Buffer.from("%PDF-real-test-content");
function query(data:unknown){return {select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data,error:null})};}
const doc=()=>({id,storage_object_path:path,storage_bucket:"provider-qualification",sha256:createHash("sha256").update(bytes).digest("hex"),mime_type:"application/pdf",size_bytes:bytes.length,scan_result_id:id});
const request=()=>GET(new Request("https://app.test/api/provider/payment-proofs/"+id),{params:Promise.resolve({proofId:id})});
beforeEach(()=>{vi.resetAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id}}});mocks.admin.mockReturnValue({storage:{from:()=>({download:mocks.download})}});mocks.download.mockResolvedValue({data:new Blob([bytes]),error:null});});
describe("private payment evidence download",()=>{
 it("requires a session before any private object access",async()=>{mocks.getUser.mockResolvedValue({data:{user:null}});expect((await request()).status).toBe(401);expect(mocks.admin).not.toHaveBeenCalled();});
 it("does not escalate when source RLS hides another organization's document",async()=>{mocks.from.mockReturnValue(query(null));expect((await request()).status).toBe(404);expect(mocks.admin).not.toHaveBeenCalled();});
 it("quarantines old payment evidence without a trusted scan binding",async()=>{mocks.from.mockReturnValueOnce(query({...doc(),scan_result_id:null}));expect((await request()).status).toBe(409);expect(mocks.admin).not.toHaveBeenCalled();});
 it("returns exact bytes only with clean scan, private cache policy and attachment",async()=>{mocks.from.mockReturnValueOnce(query(doc()));const response=await request();expect(response.status).toBe(200);expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("content-disposition")).toContain("attachment");});
 it("rejects replacement bytes even after a clean scan",async()=>{mocks.from.mockReturnValueOnce(query(doc()));mocks.download.mockResolvedValue({data:new Blob([Buffer.alloc(bytes.length)]),error:null});expect((await request()).status).toBe(503);});
});
