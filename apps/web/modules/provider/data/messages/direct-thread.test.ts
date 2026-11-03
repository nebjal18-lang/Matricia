import{beforeEach,describe,expect,it,vi}from"vitest";
const mock=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mock.user},rpc:mock.rpc})}));
import{findProviderObjectThread}from"./direct-thread";
const id="fa352000-0000-4000-8000-000000000001",org="fb352000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.clearAllMocks();mock.user.mockResolvedValue({data:{user:{id}},error:null});mock.rpc.mockResolvedValue({data:id,error:null});});
describe("Direct Provider dossier message continuation",()=>{
 it("resumes an authorized thread by object and organization beyond inbox pagination",async()=>{expect(await findProviderObjectThread(id,org)).toEqual({status:"success",value:id});expect(mock.rpc).toHaveBeenCalledWith("find_provider_rfq_message_thread_v1",{p_rfq_id:id,p_organization_id:org});});
 it("does not confuse a read failure with an absent conversation",async()=>{mock.rpc.mockResolvedValue({data:null,error:{code:"503"}});expect(await findProviderObjectThread(id,org)).toEqual({status:"error",reason:"UNAVAILABLE"});});
 it("accepts a genuine successful absence without inventing a thread",async()=>{mock.rpc.mockResolvedValue({data:null,error:null});expect(await findProviderObjectThread(id,org)).toEqual({status:"success",value:null});});
 it("rejects an invalid object or organization before reading the database",async()=>{expect(await findProviderObjectThread("invalid",org)).toEqual({status:"error",reason:"INVALID_RESPONSE"});expect(mock.rpc).not.toHaveBeenCalled();});
});
