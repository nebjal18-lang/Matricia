import { beforeEach, expect, it, vi } from "vitest";
const {rpc,getUser}=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser},rpc})}));
import { readSubscriptionPaymentStatus } from "../abonnement/payment-status";
const org="ba301000-0000-4000-8000-000000000001",intent="da301000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.resetAllMocks();getUser.mockResolvedValue({data:{user:{id:"actor"}}});rpc.mockResolvedValue({data:{paymentIntentId:intent,status:"CONFIRMED"},error:null});});
it("refreshes the existing pack operation through its separate guarded reader",async()=>{
 expect(await readSubscriptionPaymentStatus(org,intent,"CREDIT_PACK")).toEqual({paymentIntentId:intent,status:"CONFIRMED"});
 expect(rpc).toHaveBeenCalledWith("get_client_credit_pack_payment_status_v1",{p_organization_id:org,p_payment_intent_id:intent});
});
it("retains the subscription reader by default",async()=>{
 await readSubscriptionPaymentStatus(org,intent);expect(rpc).toHaveBeenCalledWith("get_client_subscription_payment_status_v1",expect.anything());
});
it("does not announce confirmation for a different operation or a failed reader",async()=>{
 rpc.mockResolvedValueOnce({data:{paymentIntentId:org,status:"CONFIRMED"},error:null});
 expect(await readSubscriptionPaymentStatus(org,intent,"CREDIT_PACK")).toBe(null);
 rpc.mockResolvedValueOnce({data:null,error:{code:"42501"}});expect(await readSubscriptionPaymentStatus(org,intent,"CREDIT_PACK")).toBe(null);
});
it("never queries from an invalid or unauthenticated context",async()=>{
 expect(await readSubscriptionPaymentStatus("bad",intent,"CREDIT_PACK")).toBe(null);
 getUser.mockResolvedValue({data:{user:null}});expect(await readSubscriptionPaymentStatus(org,intent,"CREDIT_PACK")).toBe(null);expect(rpc).not.toHaveBeenCalled();
});
