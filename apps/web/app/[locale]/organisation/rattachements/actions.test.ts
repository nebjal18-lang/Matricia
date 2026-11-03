import{beforeEach,describe,expect,it,vi}from"vitest";
const mock=vi.hoisted(()=>({rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({rpc:mock.rpc})}));
vi.mock("next/cache",()=>({revalidatePath:mock.revalidate}));
import{requestJoin,decideJoin}from"./actions";
const id="a2110000-0000-4000-8000-000000000001";
function form(fields:Record<string,string>){const f=new FormData();for(const[k,v]of Object.entries({locale:"fr",key:id,...fields}))f.set(k,v);return f;}
beforeEach(()=>{vi.clearAllMocks();});
describe("organization join commands",()=>{
 it("requests only an explicit read role with no owner or organization name",async()=>{mock.rpc.mockResolvedValue({data:{outcome:"JOIN_REQUEST_RECORDED",receipt_id:id},error:null});expect(await requestJoin({status:"idle"},form({ice:"211000000000001",role:"CLIENT_VIEWER",message:"Demande professionnelle explicite"}))).toEqual({status:"success",outcome:"JOIN_REQUEST_RECORDED"});expect(mock.rpc).toHaveBeenCalledWith("request_organization_join_v1",{p_ice:"211000000000001",p_requested_role_code:"CLIENT_VIEWER",p_message:"Demande professionnelle explicite",p_idempotency_key:id});});
 it("rejects owner privileges before RPC",async()=>{expect(await requestJoin({status:"idle"},form({ice:"211000000000001",role:"CLIENT_OWNER",message:"Demande de contrôle non autorisée"}))).toEqual({status:"error",reason:"VALIDATION"});expect(mock.rpc).not.toHaveBeenCalled();});
 it("requires the reviewed version/hash and refuses unknown success",async()=>{const fields={id,accept:"yes",version:"2",hash:"a".repeat(64),reason:"Examen humain de la demande"};mock.rpc.mockResolvedValue({data:{outcome:"OK"},error:null});expect(await decideJoin({status:"idle"},form(fields))).toEqual({status:"error",reason:"UNAVAILABLE"});expect(mock.rpc).toHaveBeenCalledWith("decide_organization_join_v1",expect.objectContaining({p_expected_row_version:2,p_expected_request_hash:"a".repeat(64)}));});
 it.each([["42501","FORBIDDEN"],["40001","CONFLICT"],["54000","RATE_LIMIT"]])("keeps failed writes explicit for %s",async(code,reason)=>{mock.rpc.mockResolvedValue({data:null,error:{code}});expect(await requestJoin({status:"idle"},form({ice:"211000000000001",role:"PROVIDER_VIEWER",message:"Demande professionnelle explicite"}))).toEqual({status:"error",reason});});
});
