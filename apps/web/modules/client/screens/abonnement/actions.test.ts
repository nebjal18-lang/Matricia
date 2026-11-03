import {beforeEach,describe,expect,it,vi}from"vitest";
const f=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn(),revalidate:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:f.revalidate}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:f.getUser},rpc:f.rpc})}));
import {changePlanAction}from"./actions";
function form(){const data=new FormData();for(const[k,v]of Object.entries({locale:"ar",organizationId:"a2460000-0000-4000-8000-000000000001",subscriptionId:"a2460000-0000-4000-8000-000000000002",targetPlanVersionId:"a2460000-0000-4000-8000-000000000003",changeMode:"UPGRADE_IMMEDIATE",idempotencyKey:"a2460000-0000-4000-8000-000000000004"}))data.set(k,v);return data;}
beforeEach(()=>{vi.clearAllMocks();f.getUser.mockResolvedValue({data:{user:{id:"owner"}}});});
describe("subscription paid upgrade feedback",()=>{
 it("returns the specific configuration requirement without announcing success",async()=>{f.rpc.mockResolvedValue({error:{code:"55000",message:"SUBSCRIPTION_UPGRADE_CHECKOUT_REQUIRED"}});expect(await changePlanAction({status:"idle"},form())).toEqual({status:"error",reason:"CHECKOUT_REQUIRED"});expect(f.revalidate).not.toHaveBeenCalled();});
 it("does not submit a request from an expired session",async()=>{f.getUser.mockResolvedValue({data:{user:null}});expect(await changePlanAction({status:"idle"},form())).toEqual({status:"error",reason:"UNAUTHENTICATED"});expect(f.rpc).not.toHaveBeenCalled();});
 it("retains the actual scheduled downgrade command",async()=>{f.rpc.mockResolvedValue({error:null});const data=form();data.set("changeMode","DOWNGRADE_NEXT_CYCLE");expect(await changePlanAction({status:"idle"},data)).toEqual({status:"success"});expect(f.rpc).toHaveBeenCalledWith("change_subscription_plan",expect.objectContaining({p_change_mode:"DOWNGRADE_NEXT_CYCLE"}));expect(f.revalidate).toHaveBeenCalledWith("/ar/client/abonnement");});
});
