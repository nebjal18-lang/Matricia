import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));vi.mock("@/modules/shared/lib/supabase/server",()=>({getSupabaseServerClient:async()=>({auth:{getUser:mocks.getUser},rpc:mocks.rpc})}));
import{manageClientBilling}from"./actions";
const id="11111111-1111-4111-8111-111111111111";
beforeEach(()=>{mocks.getUser.mockResolvedValue({data:{user:{id}}});mocks.rpc.mockReset().mockResolvedValue({data:{outcome:"CLIENT_BILLING_POLICY_CREATED"},error:null});});
describe("configuration fiscale contrôlée",()=>{
 it("conserve les compteurs au-delà de 2^53 et transforme le taux décimal exactement",async()=>{
  const form=new FormData();for(const[key,value]of Object.entries({locale:"fr",intent:"create",idempotencyKey:id,seriesKey:"FIXTURE_SERIES",version:"1",currency:"MAD",taxRate:"20,00",taxLabelFr:"TVA fixture",taxLabelAr:"ضريبة اختبار",jurisdiction:"MA fixture",issuerName:"Émetteur fictif de test",issuerLegalForm:"SARL fixture",issuerAddress:"Adresse fictive de test",issuerIce:"000000000000001",issuerIf:"000001",issuerRc:"TEST-RC",issuerEmail:"fixture@example.invalid",invoicePrefix:"FACTEST",creditPrefix:"AVTEST",invoiceStart:"9007199254740993",creditStart:"9007199254740994",validFrom:"2026-10-31",serviceLabelFr:"Service de test",serviceLabelAr:"خدمة اختبار",approvalReference:"fixture-legal-approval"}))form.set(key,value);
  expect(await manageClientBilling({status:"idle"},form)).toMatchObject({status:"success"});
  expect(mocks.rpc).toHaveBeenCalledWith("create_client_billing_policy_v1",expect.objectContaining({p_payload:expect.objectContaining({tax_rate_bps:2000,invoice_start_number:"9007199254740993",credit_start_number:"9007199254740994"})}));
 });
 it("ne transforme pas une auto-approbation refusée en succès",async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"42501",message:"FOUR_EYES_REQUIRED"}});const f=new FormData();for(const[k,v]of Object.entries({locale:"fr",intent:"approve",idempotencyKey:id,policyId:id,approve:"true",reason:"Décision motivée de test"}))f.set(k,v);
  expect(await manageClientBilling({status:"idle"},f)).toEqual({status:"error",reason:"FOUR_EYES_REQUIRED"});
 });
});
