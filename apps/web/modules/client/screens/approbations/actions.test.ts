import{beforeEach,describe,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),user:vi.fn(),mfa:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:m.user,mfa:{getAuthenticatorAssuranceLevel:m.mfa}},rpc:m.rpc})}));
import{decideClientApproval}from"./actions";
const requestId="a3270000-0000-4000-8000-000000000001";
function form(){const f=new FormData();for(const[k,v]of Object.entries({locale:"ar",approvalRequestId:requestId,rowVersion:"1",decision:"APPROVE",reason:"Validation indépendante du dossier",idempotencyKey:"a3270000-0000-4000-8000-000000000002"}))f.set(k,v);return f;}
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue({data:{user:{id:requestId}},error:null});m.mfa.mockResolvedValue({data:{currentLevel:"aal2"},error:null});m.rpc.mockResolvedValue({data:{outcome:"BUSINESS_APPROVAL_APPROVED",approval_request_id:requestId,row_version:2},error:null});});
describe("independent Client approval decision",()=>{
 it("requires step-up before submitting a decision",async()=>{m.mfa.mockResolvedValue({data:{currentLevel:"aal1"},error:null});expect(await decideClientApproval({status:"idle"},form())).toEqual({status:"error",reason:"MFA_REQUIRED"});expect(m.rpc).not.toHaveBeenCalled();});
 it("passes exact request, CAS and reason to the governed server command",async()=>{expect(await decideClientApproval({status:"idle"},form())).toEqual({status:"success"});expect(m.rpc).toHaveBeenCalledWith("decide_business_approval",expect.objectContaining({p_approval_request_id:requestId,p_expected_row_version:1,p_reason:"Validation indépendante du dossier"}));});
 it("never acknowledges an empty or different request response",async()=>{m.rpc.mockResolvedValueOnce({data:{},error:null});expect(await decideClientApproval({status:"idle"},form())).toEqual({status:"error",reason:"FAILED"});m.rpc.mockResolvedValueOnce({data:{outcome:"BUSINESS_APPROVAL_APPROVED",approval_request_id:"a3270000-0000-4000-8000-000000000003",row_version:2},error:null});expect(await decideClientApproval({status:"idle"},form())).toEqual({status:"error",reason:"FAILED"});});
 it("keeps authorization refusal and concurrent change distinct",async()=>{m.rpc.mockResolvedValueOnce({data:null,error:{code:"42501"}});expect(await decideClientApproval({status:"idle"},form())).toEqual({status:"error",reason:"FORBIDDEN"});m.rpc.mockResolvedValueOnce({data:null,error:{code:"40001"}});expect(await decideClientApproval({status:"idle"},form())).toEqual({status:"error",reason:"CONFLICT"});});
});
