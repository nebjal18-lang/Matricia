import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
import{revalidateProviderIdentity}from"./actions";
const id="11111111-1111-4111-8111-111111111111",hash="a".repeat(64);
function form(){const f=new FormData();Object.entries({organizationId:id,organizationVersion:"2",profileVersion:"3",identityHash:hash,decisionId:id,reason:"Revue contradictoire des trois pièces actuelles",idempotencyKey:id,confirmed:"yes",locale:"fr"}).forEach(([k,v])=>f.set(k,v));return f;}
beforeEach(()=>{mocks.getUser.mockReset().mockResolvedValue({data:{user:{id}}});mocks.rpc.mockReset().mockResolvedValue({data:{outcome:"PROVIDER_IDENTITY_VERIFIED",identity_hash:hash,identity_review_id:id},error:null});});
describe("current Provider identity review",()=>{
 it("requires an explicit human document confirmation",async()=>{const f=form();f.delete("confirmed");expect(await revalidateProviderIdentity({status:"idle"},f)).toEqual({status:"error",reason:"VALIDATION"});expect(mocks.rpc).not.toHaveBeenCalled();});
 it("binds the review to the displayed identity and optimistic versions",async()=>{expect(await revalidateProviderIdentity({status:"idle"},form())).toEqual({status:"success"});expect(mocks.rpc).toHaveBeenCalledWith("revalidate_provider_identity_v1",expect.objectContaining({p_expected_identity_hash:hash,p_expected_organization_row_version:2,p_expected_profile_row_version:3,p_expected_company_decision_id:id}));});
 it("never reports a stale or mismatching identity as verified",async()=>{mocks.rpc.mockResolvedValueOnce({error:{code:"40001"}});expect(await revalidateProviderIdentity({status:"idle"},form())).toEqual({status:"error",reason:"STALE"});mocks.rpc.mockResolvedValueOnce({data:{outcome:"PROVIDER_IDENTITY_VERIFIED",identity_hash:"b".repeat(64),identity_review_id:id},error:null});expect(await revalidateProviderIdentity({status:"idle"},form())).toEqual({status:"error",reason:"FAILED"});});
});
