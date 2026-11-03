import{beforeEach,describe,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({rpc:vi.fn(),user:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:m.user},rpc:m.rpc})}));
import{claimReferral}from"./actions";
const org="a3270000-0000-4000-8000-000000000001";
function form(){const f=new FormData();for(const[k,v]of Object.entries({locale:"fr",referralCode:"CLIENTTEST123",organizationId:org,consent:"on",idempotencyKey:"a3270000-0000-4000-8000-000000000002"}))f.set(k,v);return f;}
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue({data:{user:{id:org}},error:null});m.rpc.mockResolvedValue({data:{outcome:"REFERRAL_REGISTERED",referral_conversion_id:org},error:null});});
describe("consented referral claim",()=>{
 it("requires explicit consent before calling a mutation",async()=>{const f=form();f.delete("consent");expect(await claimReferral({status:"idle"},f)).toEqual({status:"error",reason:"VALIDATION"});expect(m.rpc).not.toHaveBeenCalled();});
 it("binds the selected organization without sending any message",async()=>{expect(await claimReferral({status:"idle"},form())).toEqual({status:"success"});expect(m.rpc).toHaveBeenCalledWith("claim_client_referral_v1",expect.objectContaining({p_target_organization_id:org,p_consent:true}));});
 it("does not claim success for forbidden or malformed provider results",async()=>{m.rpc.mockResolvedValueOnce({data:null,error:{code:"42501"}});expect(await claimReferral({status:"idle"},form())).toEqual({status:"error",reason:"DENIED"});m.rpc.mockResolvedValueOnce({data:{},error:null});expect(await claimReferral({status:"idle"},form())).toEqual({status:"error",reason:"UNAVAILABLE"});});
});
