import{beforeEach,describe,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),user:vi.fn(),aal:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:m.user,mfa:{getAuthenticatorAssuranceLevel:m.aal}},rpc:m.rpc})}));
import{resumeClientCommitment}from"./resume-actions";
const id="a3330000-0000-4000-8000-000000000001";
function form(){const f=new FormData();f.set("locale","fr");f.set("approvalRequestId",id);f.set("rowVersion","2");return f;}
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue({data:{user:{id}},error:null});m.aal.mockResolvedValue({data:{currentLevel:"aal2"},error:null});m.rpc.mockResolvedValue({data:{outcome:"CLIENT_TYPED_COST_ALLOCATED",allocation_id:id},error:null});});
describe("resume exact approved command",()=>{
 it("forwards only the original approval identity and CAS, ignoring browser financial payload",async()=>{const f=form();f.set("amountMinor","1");f.set("reason","Modified browser reason");expect(await resumeClientCommitment({status:"idle"},f)).toEqual({status:"completed"});expect(m.rpc).toHaveBeenCalledWith("execute_client_approved_commitment_v1",{p_approval_request_id:id,p_expected_row_version:2});});
 it("does not treat an additional required approval as an execution",async()=>{m.rpc.mockResolvedValue({data:{outcome:"CLIENT_APPROVAL_REQUIRED",approval_request_id:id},error:null});expect(await resumeClientCommitment({status:"idle"},form())).toEqual({status:"pending"});});
 it("requires renewed MFA and never hides a changed source as success",async()=>{m.aal.mockResolvedValueOnce({data:{currentLevel:"aal1"},error:null});expect(await resumeClientCommitment({status:"idle"},form())).toEqual({status:"error",reason:"MFA_REQUIRED"});expect(m.rpc).not.toHaveBeenCalled();m.rpc.mockResolvedValueOnce({data:null,error:{code:"40001",message:"CLIENT_APPROVAL_SOURCE_CHANGED"}});expect(await resumeClientCommitment({status:"idle"},form())).toEqual({status:"error",reason:"CONFLICT"});});
 it("rejects unknown or empty acknowledgements",async()=>{m.rpc.mockResolvedValueOnce({data:{outcome:"OK"},error:null});expect(await resumeClientCommitment({status:"idle"},form())).toEqual({status:"error",reason:"FAILED"});});
});
