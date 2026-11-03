import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestCapture: vi.fn(), rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@matricia/infrastructure", () => ({
  PaymentGatewayError: class PaymentGatewayError extends Error { constructor(readonly code: string) { super(code); } },
  createPaymentGateway: () => ({ code: "PAYPAL",providerEnvironment:"SANDBOX", requestCapture: mocks.requestCapture }),
}));
vi.mock("@/modules/shared/lib/env", () => ({
  getPaymentRuntimeConfig: () => ({}),
  getServerEnvironment: () => ({ NEXT_PUBLIC_APP_URL: "https://app.matricia.test" }),
}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));

import { POST } from "./route";

describe("POST /api/payments/paypal/capture", () => {
  beforeEach(() => {
    mocks.requestCapture.mockReset().mockResolvedValue({ status: "PENDING_WEBHOOK" });
    mocks.rpc.mockReset().mockResolvedValue({ data: { provider_intent_id: "ORDER-12345678", replayed: false,capture_authorized:true }, error: null });
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("resolves the server-owned order and remains pending until webhook", async () => {
    const paymentIntentId = "11111111-1111-4111-8111-111111111111";
    const response = await POST(new Request("https://app.matricia.test/api/payments/paypal/capture", {
      method: "POST", headers: { origin: "https://app.matricia.test", "content-type": "application/json" }, body: JSON.stringify({ paymentIntentId }),
    }));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ paymentIntentId, status: "PENDING_WEBHOOK" });
    expect(mocks.rpc).toHaveBeenCalledWith("prepare_subscription_payment_capture_v2", { p_payment_intent_id: paymentIntentId,p_provider_environment:"SANDBOX" });
    expect(mocks.requestCapture).toHaveBeenCalledWith("ORDER-12345678", paymentIntentId);
  });

  it("rejects cross-origin requests before auth or provider access", async () => {
    const response = await POST(new Request("https://app.matricia.test/api/payments/paypal/capture", {
      method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: "{}",
    }));
    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.requestCapture).not.toHaveBeenCalled();
  });
});

describe("recorded capture lifecycle",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:"user-1"}}});});

it("returns only a matching recorded receipt without another provider capture",async()=>{const paymentIntentId="11111111-1111-4111-8111-111111111111";mocks.rpc.mockResolvedValueOnce({data:{provider_intent_id:"ORDER-12345678",replayed:true,activation_result:{outcome:"SUBSCRIPTION_ACTIVATED",payment_intent_id:paymentIntentId}},error:null});const response=await POST(new Request("https://app.matricia.test/api/payments/paypal/capture",{method:"POST",headers:{origin:"https://app.matricia.test","content-type":"application/json"},body:JSON.stringify({paymentIntentId})}));expect(response.status).toBe(200);expect(await response.json()).toEqual({paymentIntentId,status:"CONFIRMED"});expect(mocks.requestCapture).not.toHaveBeenCalled();});
it("does not call a provider when the recorded replay receipt is missing or unrelated",async()=>{mocks.getUser.mockResolvedValue({data:{user:{id:"user-1"}}});for(const activation_result of[undefined,{outcome:"SUBSCRIPTION_ACTIVATED",payment_intent_id:"22222222-2222-4222-8222-222222222222"}]){mocks.rpc.mockResolvedValueOnce({data:{provider_intent_id:"ORDER-12345678",replayed:true,activation_result},error:null});const response=await POST(new Request("https://app.matricia.test/api/payments/paypal/capture",{method:"POST",headers:{origin:"https://app.matricia.test","content-type":"application/json"},body:JSON.stringify({paymentIntentId:"11111111-1111-4111-8111-111111111111"})}));expect(response.status).toBe(409);}expect(mocks.requestCapture).not.toHaveBeenCalled();});
it("refuses a nonactivatable current subscription before any money request",async()=>{mocks.getUser.mockResolvedValue({data:{user:{id:"user-1"}}});mocks.rpc.mockResolvedValueOnce({data:null,error:{code:"55000",message:"SUBSCRIPTION_NOT_ACTIVATABLE"}});const response=await POST(new Request("https://app.matricia.test/api/payments/paypal/capture",{method:"POST",headers:{origin:"https://app.matricia.test","content-type":"application/json"},body:JSON.stringify({paymentIntentId:"11111111-1111-4111-8111-111111111111"})}));expect(response.status).toBe(409);expect(await response.json()).toEqual({error:"SUBSCRIPTION_NOT_ACTIVATABLE"});expect(mocks.requestCapture).not.toHaveBeenCalled();});

});

it("does not resend a capture whose first provider request has an uncertain result",async()=>{vi.clearAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:"user-1"}}});mocks.rpc.mockResolvedValueOnce({data:{provider_intent_id:"ORDER-12345678",replayed:false,capture_authorized:false},error:null});const response=await POST(new Request("https://app.matricia.test/api/payments/paypal/capture",{method:"POST",headers:{origin:"https://app.matricia.test","content-type":"application/json"},body:JSON.stringify({paymentIntentId:"11111111-1111-4111-8111-111111111111"})}));expect(response.status).toBe(202);expect(await response.json()).toMatchObject({status:"PENDING_NATIVE_REVIEW"});expect(mocks.requestCapture).not.toHaveBeenCalled();});
