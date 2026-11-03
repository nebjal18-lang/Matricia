import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), register:vi.fn(),create: vi.fn(),lookup:vi.fn() }));
vi.mock("@matricia/infrastructure", () => ({ createPaymentGateway: () => ({ code: "PAYPAL",providerEnvironment:"SANDBOX", createIntent: mocks.create,lookupOrder:mocks.lookup }), PaymentGatewayError: class extends Error {} }));
vi.mock("@/modules/shared/lib/env", () => ({ getServerEnvironment: () => ({ NEXT_PUBLIC_APP_URL: "https://app.example.com" }), getPaymentRuntimeConfig: () => ({}) }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } }) }, rpc: mocks.rpc }) }));
vi.mock("@/modules/shared/lib/supabase/admin",()=>({getSupabaseAdminClient:()=>({rpc:mocks.register})}));
import { POST } from "./route";
const input = { organizationId: "22222222-2222-4222-8222-222222222222", planVersionId: "33333333-3333-4333-8333-333333333333", billingInterval: "MONTHLY", idempotencyKey: "44444444-4444-4444-8444-444444444444", locale: "fr" };
const request = () => new Request("https://app.example.com/api/payments/intents", { method: "POST", headers: { origin: "https://app.example.com", "content-type": "application/json" }, body: JSON.stringify(input) });
beforeEach(() => vi.clearAllMocks());
it("refuses another organization before any external payment effect", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
  expect((await POST(request())).status).toBe(403); expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith("prepare_subscription_payment_intent_v2", expect.objectContaining({ p_organization_id: input.organizationId }));
});
it("fails closed on a malformed durable preparation", async () => {
  mocks.rpc.mockResolvedValue({ data: { amount_minor: "0" }, error: null });
  expect((await POST(request())).status).toBe(503); expect(mocks.create).not.toHaveBeenCalled();
});
it("uses only the reserved server amount and stable provider key", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { preparation_id: "55555555-5555-4555-8555-555555555555", amount_minor: "12345", currency: "EUR",create_authorized:true }, error: null });mocks.register.mockResolvedValueOnce({ data: { payment_intent_id: "66666666-6666-4666-8666-666666666666" }, error: null });
  mocks.create.mockResolvedValue({ gateway: "PAYPAL",providerEnvironment:"SANDBOX", providerIntentId: "ORDER-12345678", status: "REQUIRES_CONFIRMATION", amountMinor: "12345", currency: "EUR", confirmation: null });
  expect((await POST(request())).status).toBe(201);
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: "12345", currency: "EUR", idempotencyKey: input.idempotencyKey,returnUrl:expect.stringContaining(`organizationId=${input.organizationId}`) }));
  expect(mocks.register).toHaveBeenCalledWith("register_subscription_payment_intent_v2",expect.objectContaining({p_preparation_id:"55555555-5555-4555-8555-555555555555",p_provider_environment:"SANDBOX",p_provider_intent_id:"ORDER-12345678"}));
});

it("refuses trusted database production denial before calling a sandbox provider",async()=>{
 mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"42501",message:"PAYMENT_PRODUCTION_PROVIDER_REQUIRED"}});
 expect((await POST(request())).status).toBe(403);expect(mocks.create).not.toHaveBeenCalled();expect(mocks.register).not.toHaveBeenCalled();
 expect(mocks.rpc).toHaveBeenCalledWith("prepare_subscription_payment_intent_v2",expect.objectContaining({p_provider_environment:"SANDBOX"}));
});
it("does not register a provider response from a mismatched environment",async()=>{
 mocks.rpc.mockResolvedValueOnce({data:{preparation_id:"55555555-5555-4555-8555-555555555555",amount_minor:"12345",currency:"EUR",create_authorized:true},error:null});
 mocks.create.mockResolvedValueOnce({gateway:"PAYPAL",providerEnvironment:"LIVE",providerIntentId:"ORDER-12345678",status:"REQUIRES_CONFIRMATION",amountMinor:"12345",currency:"EUR"});
 expect((await POST(request())).status).toBe(502);expect(mocks.register).not.toHaveBeenCalled();
});

it("does not create an order for a subscription that cannot accept a new payment",async()=>{mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"55000",message:"SUBSCRIPTION_NOT_ACTIVATABLE"}});const response=await POST(request());expect(response.status).toBe(409);expect(await response.json()).toEqual({error:"SUBSCRIPTION_NOT_ACTIVATABLE"});expect(mocks.create).not.toHaveBeenCalled();expect(mocks.register).not.toHaveBeenCalled();});

it("keeps an unregistered ambiguous creation blocked even with the original key",async()=>{mocks.rpc.mockResolvedValueOnce({data:{preparation_id:"55555555-5555-4555-8555-555555555555",amount_minor:"12345",currency:"EUR",create_authorized:false},error:null});const response=await POST(request());expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:"PAYMENT_CREATION_RECONCILIATION_REQUIRED"});expect(mocks.create).not.toHaveBeenCalled();});
it("resumes a registered order by native GET, never POST create",async()=>{mocks.rpc.mockResolvedValueOnce({data:{preparation_id:"55555555-5555-4555-8555-555555555555",amount_minor:"12345",currency:"EUR",create_authorized:false,payment_intent_id:"66666666-6666-4666-8666-666666666666",provider_intent_id:"ORDER-12345678"},error:null});mocks.lookup.mockResolvedValueOnce({orderId:"ORDER-12345678",status:"CREATED",currency:"EUR",confirmation:{method:"GET",url:"https://www.sandbox.paypal.com/checkoutnow?token=ORDER-12345678"}});expect((await POST(request())).status).toBe(200);expect(mocks.lookup).toHaveBeenCalledWith("ORDER-12345678",expect.objectContaining({planVersionId:input.planVersionId,idempotencyKey:input.idempotencyKey,amountMinor:"12345"}));expect(mocks.create).not.toHaveBeenCalled();expect(mocks.register).not.toHaveBeenCalled();});
it("returns only the matching historical activation without contacting the PSP",async()=>{mocks.rpc.mockResolvedValueOnce({data:{preparation_id:"55555555-5555-4555-8555-555555555555",amount_minor:"12345",currency:"EUR",create_authorized:false,payment_intent_id:"66666666-6666-4666-8666-666666666666",payment_result:{outcome:"SUBSCRIPTION_ACTIVATED",payment_intent_id:"66666666-6666-4666-8666-666666666666"}},error:null});expect((await POST(request())).status).toBe(200);expect(mocks.create).not.toHaveBeenCalled();expect(mocks.lookup).not.toHaveBeenCalled();});

it("returns the database MFA requirement before any external creation",async()=>{mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"42501",message:"PAYMENT_CUSTOMER_MFA_REQUIRED"}});const response=await POST(request());expect(response.status).toBe(403);expect(await response.json()).toEqual({error:"PAYMENT_CUSTOMER_MFA_REQUIRED"});expect(mocks.create).not.toHaveBeenCalled();expect(mocks.register).not.toHaveBeenCalled();});

it("uses the quote-bound server target for an approved upgrade, ignoring browser plan fields",async()=>{
 const quoteId="77777777-7777-4777-8777-777777777777",target="88888888-8888-4888-8888-888888888888",hash="a".repeat(64);
 mocks.rpc.mockResolvedValueOnce({data:{preparation_id:"55555555-5555-4555-8555-555555555555",amount_minor:"24690",currency:"EUR",create_authorized:true,plan_version_id:target,billing_interval:"ANNUAL",organization_id:input.organizationId,upgrade_quote_id:quoteId,upgrade_hash:hash},error:null});
 mocks.create.mockResolvedValueOnce({gateway:"PAYPAL",providerEnvironment:"SANDBOX",providerIntentId:"UPGRADE-ORDER-123456",status:"REQUIRES_CONFIRMATION",amountMinor:"24690",currency:"EUR",confirmation:null});
 mocks.register.mockResolvedValueOnce({data:{payment_intent_id:"66666666-6666-4666-8666-666666666666"},error:null});
 const r=new Request("https://app.example.com/api/payments/intents",{method:"POST",headers:{origin:"https://app.example.com","content-type":"application/json"},body:JSON.stringify({...input,upgrade:{quoteId,acceptedHash:hash,consent:true}})});
 expect((await POST(r)).status).toBe(201);expect(mocks.rpc).toHaveBeenCalledWith("prepare_client_subscription_upgrade_payment_v1",expect.objectContaining({p_quote_id:quoteId,p_accepted_hash:hash,p_consent:true}));
 expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({planVersionId:target,billingInterval:"ANNUAL",amountMinor:"24690"}));
});
it("requires upgrade consent and a response bound to exactly the accepted quote before any PSP call",async()=>{
 const quoteId="77777777-7777-4777-8777-777777777777",hash="a".repeat(64),requestFor=(consent:boolean)=>new Request("https://app.example.com/api/payments/intents",{method:"POST",headers:{origin:"https://app.example.com","content-type":"application/json"},body:JSON.stringify({...input,upgrade:{quoteId,acceptedHash:hash,consent}})});
 expect((await POST(requestFor(false))).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
 mocks.rpc.mockResolvedValueOnce({data:{preparation_id:"55555555-5555-4555-8555-555555555555",amount_minor:"24690",currency:"EUR",create_authorized:true},error:null});
 expect((await POST(requestFor(true))).status).toBe(503);expect(mocks.create).not.toHaveBeenCalled();
});
