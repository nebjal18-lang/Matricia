import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),assurance:vi.fn(),rpc:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.user,mfa:{getAuthenticatorAssuranceLevel:mocks.assurance}},rpc:mocks.rpc})}));
import{decideClientReferralReward,executeClientReferralReward}from"./actions";
const id=(n:number)=>`a3340000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const idle={status:"idle"}as const;
const fields={locale:"fr",sourceEventId:id(1),ruleVersionId:id(2),approvalId:id(3),decision:"APPROVED",rationale:"Source réelle vérifiée indépendamment",idempotencyKey:id(4)};
function form(values:Record<string,string>=fields){const f=new FormData();for(const[k,v]of Object.entries(values))f.set(k,v);return f;}
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({data:{user:{id:id(9)}},error:null});mocks.assurance.mockResolvedValue({data:{currentLevel:"aal2"},error:null});mocks.rpc.mockResolvedValue({data:{outcome:"REWARD_AWARD_APPROVED",approval_id:id(3),source_event_id:id(1),rule_version_id:id(2)},error:null});});
describe("independent Client referral decision and financial execution",()=>{
 it("sends the exact source and published rule to the native decision command",async()=>{
  expect(await decideClientReferralReward(idle,form())).toEqual({status:"success",kind:"decision"});
  expect(mocks.rpc).toHaveBeenCalledWith("decide_reward_award",{p_source_event_id:id(1),p_rule_version_id:id(2),p_decision:"APPROVED",p_rationale:fields.rationale,p_idempotency_key:id(4)});
 });
 it("does not take any amount, wallet or organization authority from hidden execution fields",async()=>{
  mocks.rpc.mockResolvedValue({data:{outcome:"CLIENT_REFERRAL_REWARD_EXECUTED",approval_id:id(3),reward_grant_id:id(5),quantity:"9007199254740993"},error:null});
  expect(await executeClientReferralReward(idle,form({...fields,quantity:"999",walletId:id(7),organizationId:id(8)}))).toEqual({status:"success",kind:"execution"});
  expect(mocks.rpc).toHaveBeenCalledWith("execute_client_referral_reward_v1",{p_approval_id:id(3),p_idempotency_key:id(4)});
 });
 it("does not report credit success for an approval response or a mismatched grant",async()=>{
  expect(await executeClientReferralReward(idle,form())).toEqual({status:"error",reason:"FAILED"});
  mocks.rpc.mockResolvedValue({data:{outcome:"CLIENT_REFERRAL_REWARD_EXECUTED",approval_id:id(8),reward_grant_id:id(5),quantity:"5"},error:null});
  expect(await executeClientReferralReward(idle,form())).toEqual({status:"error",reason:"FAILED"});
 });
 it("rejects an unbound decision response",async()=>{
  mocks.rpc.mockResolvedValue({data:{outcome:"REWARD_AWARD_APPROVED",approval_id:id(3),source_event_id:id(7),rule_version_id:id(2)},error:null});
  expect(await decideClientReferralReward(idle,form())).toEqual({status:"error",reason:"FAILED"});
 });
 it.each([decideClientReferralReward,executeClientReferralReward])("preserves AAL2 before calling a sensitive command",async(action)=>{
  mocks.assurance.mockResolvedValue({data:{currentLevel:"aal1"},error:null});
  expect(await action(idle,form())).toEqual({status:"error",reason:"MFA_REQUIRED"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("keeps Compliance execution refusal separate from a provider outage",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"42501",message:"REFERRAL_REWARD_EXECUTION_DENIED"}});
  expect(await executeClientReferralReward(idle,form())).toEqual({status:"error",reason:"FORBIDDEN"});
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"08006"}});
  expect(await executeClientReferralReward(idle,form())).toEqual({status:"error",reason:"FAILED"});
 });
 it("shows a native cap refusal as a business conflict without simulating success",async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{code:"23514",message:"REWARD_GLOBAL_CAP_EXCEEDED"}});
  expect(await executeClientReferralReward(idle,form())).toEqual({status:"error",reason:"CONFLICT"});
 });
 it("does not call a command with an invalid target or missing rationale",async()=>{
  expect(await decideClientReferralReward(idle,form({...fields,rationale:""}))).toEqual({status:"error",reason:"VALIDATION"});
  expect(await executeClientReferralReward(idle,form({...fields,approvalId:"other"}))).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("keeps a missing session distinct from auth unavailability",async()=>{
  mocks.user.mockResolvedValueOnce({data:{user:null},error:{name:"AuthSessionMissingError",status:400}});
  expect(await executeClientReferralReward(idle,form())).toEqual({status:"error",reason:"UNAUTHENTICATED"});
  mocks.user.mockResolvedValueOnce({data:{user:null},error:{name:"AuthRetryableFetchError",status:503}});
  expect(await executeClientReferralReward(idle,form())).toEqual({status:"error",reason:"FAILED"});expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
