import {createHash,generateKeyPairSync} from "node:crypto";
import {describe,it,expect,vi,afterEach} from "vitest";
import {DemoPaymentGateway} from "./demo-gateway";
import {FetchPayPalOrderClient,PayPalPaymentGateway} from "./paypal-gateway";
import type {PaymentIntentRequest} from "./contracts";
const request:PaymentIntentRequest={organizationId:"11111111-1111-4111-8111-111111111111",planVersionId:"22222222-2222-4222-8222-222222222222",billingInterval:"MONTHLY",amountMinor:"12345",currency:"EUR",idempotencyKey:"33333333-3333-4333-8333-333333333333",returnUrl:"https://app.example.com/fr/client/abonnement"};
const pack:PaymentIntentRequest={organizationId:request.organizationId,purchaseKind:"CREDIT_PACK",packVersionId:request.planVersionId,amountMinor:request.amountMinor,currency:request.currency,idempotencyKey:request.idempotencyKey,returnUrl:request.returnUrl};
const {publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const config={environment:"sandbox" as const,webhookId:"webhook-native-test",certificatePem:publicKey.export({type:"spki",format:"pem"}).toString(),certificateUrl:"https://api-m.sandbox.paypal.com/v1/notifications/certs/NATIVE",allowedCurrencies:new Set(["EUR"])};
const hash=(text:string)=>createHash("sha256").update(text).digest("hex");
const invoice=`matricia-${hash(`paypal:${request.organizationId}:${request.planVersionId}:${request.idempotencyKey}`).slice(0,32)}`;
const order=(status="VOIDED")=>({id:"ORDER-12345678",intent:"CAPTURE",status,purchase_units:[{invoice_id:invoice,amount:{value:"123.45",currency_code:"EUR"}}]});
function gateway(response:unknown){const lookupOrder=vi.fn().mockResolvedValue(response);return {lookupOrder,port:new PayPalPaymentGateway({createOrder:vi.fn(),captureOrder:vi.fn(),lookupOrder},config)};}
afterEach(()=>vi.unstubAllGlobals());
describe("native PayPal order verification",()=>{
 it("binds a voided OAuth/TLS order to the exact subscription invoice and amount",async()=>{const response=order();const {port,lookupOrder}=gateway(response);const actual=await port.lookupOrder(response.id,request);expect(lookupOrder).toHaveBeenCalledWith(response.id);expect(actual).toMatchObject({orderId:response.id,status:"VOIDED",capture:null,verificationMethod:"API_OAUTH2_TLS",responseHash:hash(JSON.stringify(response)),amountMinor:"12345",currency:"EUR"});expect(Date.now()-Date.parse(actual.observedAt)).toBeLessThan(1000);expect(actual).not.toHaveProperty("signatureFingerprint");});
 it("returns a completed native capture with its real reference and date",async()=>{const response={...order("COMPLETED"),purchase_units:[{...order().purchase_units[0],payments:{captures:[{id:"CAPTURE-12345678",status:"COMPLETED",amount:{value:"123.45",currency_code:"EUR"},create_time:"2026-01-01T00:00:00Z"}]}}]};expect(await gateway(response).port.lookupOrder(response.id,request)).toMatchObject({status:"COMPLETED",capture:{captureId:"CAPTURE-12345678",amountMinor:"12345",currency:"EUR",paidAt:"2026-01-01T00:00:00.000Z"}});});
 it.each([
  {...order(),id:"ORDER-ANOTHER"},
  {...order(),intent:"AUTHORIZE"},
  {...order(),purchase_units:[]},
  {...order(),purchase_units:[...order().purchase_units,...order().purchase_units]},
  {...order(),purchase_units:[{...order().purchase_units[0],invoice_id:"foreign-invoice"}]},
  {...order(),purchase_units:[{...order().purchase_units[0],amount:{value:"999.99",currency_code:"EUR"}}]},
  {...order(),purchase_units:[{...order().purchase_units[0],amount:{value:"123.45",currency_code:"USD"}}]},
  order("COMPLETED"),
  {...order(),purchase_units:[{...order().purchase_units[0],payments:{captures:[{id:"CAPTURE-12345678",status:"COMPLETED"}]}}]},
 ])("refuses mismatched or ambiguous native evidence %#",async(response)=>{await expect(gateway(response).port.lookupOrder("ORDER-12345678",request)).rejects.toMatchObject({code:"INVALID_EVENT"});});
 it("does not accept a subscription invoice as proof for a credit pack with the same UUIDs",async()=>{await expect(gateway(order()).port.lookupOrder("ORDER-12345678",pack)).rejects.toMatchObject({code:"INVALID_EVENT"});});
 it("namespaces credit-pack orders while keeping historical subscription keys unchanged",async()=>{const createOrder=vi.fn().mockResolvedValue({id:"ORDER-12345678",links:[{rel:"approve",href:"https://www.sandbox.paypal.com/checkoutnow?token=ORDER-12345678"}]});const port=new PayPalPaymentGateway({createOrder,captureOrder:vi.fn()},config);await port.createIntent(request);await port.createIntent(pack);await port.createIntent(pack);expect(createOrder.mock.calls[0]![0]).toMatchObject({requestId:request.idempotencyKey,invoiceId:invoice});expect(createOrder.mock.calls[1]![0].requestId).not.toBe(request.idempotencyKey);expect(createOrder.mock.calls[1]![0].requestId.length).toBeLessThanOrEqual(38);expect(createOrder.mock.calls[1]![0].invoiceId).not.toBe(invoice);expect(createOrder.mock.calls[1]![0]).toEqual(createOrder.mock.calls[2]![0]);const demo=new DemoPaymentGateway();expect((await demo.createIntent(request)).providerIntentId).not.toBe((await demo.createIntent(pack)).providerIntentId);});
 it("uses only the configured native API host without following redirects",async()=>{const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:"native-oauth-test"}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify(order()),{status:200}));vi.stubGlobal("fetch",fetchMock);const port=new FetchPayPalOrderClient("sandbox","test-client-id","test-client-secret");expect(await port.lookupOrder("ORDER-12345678")).toEqual(order());expect(fetchMock.mock.calls[1]![0]).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-12345678");expect(fetchMock.mock.calls[1]![1]).toMatchObject({redirect:"error",cache:"no-store",headers:{authorization:"Bearer native-oauth-test"}});});
 it("aborts the response stream before allocating an oversized native JSON response",async()=>{const cancelled=vi.fn();const stream=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(262145));},cancel:cancelled});vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({access_token:"native-oauth-test"}),{status:200})).mockResolvedValueOnce(new Response(stream,{status:200})));await expect(new FetchPayPalOrderClient("sandbox","test-client-id","test-client-secret").lookupOrder("ORDER-12345678")).rejects.toMatchObject({code:"PROVIDER_UNAVAILABLE"});expect(cancelled).toHaveBeenCalled();});
});
