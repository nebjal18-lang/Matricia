import { describe, expect, it } from "vitest";
import { parsePayPalCaptureReturn, parsePaymentIntent, parsePaymentCapture, parseConfirmedPayment, paymentNeedsReconciliation, paymentRequiresMfa } from "./payment-confirmation";

const intent = {
  paymentIntentId: "11111111-1111-4111-8111-111111111111",
  providerIntentId: "ORDER-12345678",
  gateway: "PAYPAL",
  status: "REQUIRES_CONFIRMATION",
  confirmation: { method: "GET", url: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-12345678" },
};

describe("payment confirmation UI contract", () => {
  it("accepts a safe PayPal approval and binds the return token to stored order", () => {
    expect(parsePaymentIntent(intent)).not.toBeNull();
    expect(parsePayPalCaptureReturn("?payment=pending&token=ORDER-12345678&PayerID=PAYER-1", JSON.stringify(intent)))
      .toEqual({ paymentIntentId: intent.paymentIntentId });
  });

  it("rejects tampered return tokens and unsafe confirmation URLs", () => {
    expect(parsePayPalCaptureReturn("?payment=pending&token=OTHER&PayerID=PAYER-1", JSON.stringify(intent))).toBeNull();
    expect(parsePaymentIntent({ ...intent, confirmation: { method: "GET", url: "javascript:alert(1)" } })).toBeNull();
  });

  it("accepts only bounded string fields for CMI POST", () => {
    expect(parsePaymentIntent({ ...intent, gateway: "CMI", providerIntentId: "matricia-order", confirmation: { method: "POST", url: "https://testpayment.cmi.co.ma/gate", fields: { oid: "matricia-order", hash: "signed" } } })).not.toBeNull();
    expect(parsePaymentIntent({ ...intent, gateway: "CMI", confirmation: { method: "POST", url: "https://testpayment.cmi.co.ma/gate", fields: { "bad name": "value" } } })).toBeNull();
  });
});


describe("pending payment truthfulness",()=>{
 it.each(["PENDING_WEBHOOK","PENDING_NATIVE_REVIEW"])("preserves %s instead of confirming any 202 response",status=>{expect(parsePaymentCapture({paymentIntentId:intent.paymentIntentId,status},intent.paymentIntentId)).toBe(status);expect(parseConfirmedPayment({paymentIntentId:intent.paymentIntentId,status})).toBeNull();});
 it("rejects a receipt for a different payment or an unknown capture state",()=>{expect(parsePaymentCapture({paymentIntentId:"different",status:"CONFIRMED"},intent.paymentIntentId)).toBeNull();expect(parsePaymentCapture({paymentIntentId:intent.paymentIntentId,status:"SUCCESS"},intent.paymentIntentId)).toBeNull();expect(parseConfirmedPayment({status:"CONFIRMED"})).toBeNull();});
 it("binds capture returns to the organization that initiated the order",()=>{const stored=JSON.stringify({...intent,organizationId:"organization-a"});const search="?payment=pending&token=ORDER-12345678&PayerID=PAYER-1";expect(parsePayPalCaptureReturn(search,stored,"organization-b")).toBeNull();expect(parsePayPalCaptureReturn(search,stored,"organization-a")).toEqual({paymentIntentId:intent.paymentIntentId});expect(parsePayPalCaptureReturn(search,JSON.stringify(intent),"organization-a")).toBeNull();});
 it.each(["SUBSCRIPTION_CHECKOUT_ALREADY_PENDING","SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED","SUBSCRIPTION_LEGACY_CHECKOUT_RECONCILIATION_REQUIRED","PAYMENT_CREATION_RECONCILIATION_REQUIRED","PAYMENT_NATIVE_REVIEW_REQUIRED"])("does not invite another charge after %s",error=>{expect(paymentNeedsReconciliation({error})).toBe(true);});
 it("rejects mismatched provider confirmation methods instead of announcing an intention",()=>{expect(parsePaymentIntent({...intent,confirmation:null})).toBeNull();expect(parsePaymentIntent({...intent,gateway:"CMI"})).toBeNull();expect(parsePaymentIntent({...intent,confirmation:{method:"POST",url:"https://www.paypal.com",fields:{}}})).toBeNull();});
});

it("identifies a verified step-up requirement without treating it as a payment confirmation",()=>{expect(paymentRequiresMfa({error:"PAYMENT_CUSTOMER_MFA_REQUIRED"})).toBe(true);expect(parseConfirmedPayment({error:"PAYMENT_CUSTOMER_MFA_REQUIRED"})).toBeNull();});
