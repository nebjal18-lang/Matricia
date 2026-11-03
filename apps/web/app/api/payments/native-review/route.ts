import {randomUUID} from "node:crypto";
import {createPaymentGateway} from "@matricia/infrastructure";
import {z} from "zod";
import {getPaymentRuntimeConfig,getServerEnvironment} from "@/modules/shared/lib/env";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
import {paymentOriginAllowed,paymentResponseHeaders,readPaymentJson} from "@/modules/shared/lib/payment-http/request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const inputSchema=z.object({purchaseKind:z.enum(["SUBSCRIPTION","CREDIT_PACK"]),preparationId:z.string().uuid(),providerIntentId:z.string().regex(/^[A-Z0-9-]{8,200}$/)}).strict();
const expectedSchema=z.object({preparation_id:z.string().uuid(),organization_id:z.string().uuid(),plan_version_id:z.string().uuid().optional(),pack_version_id:z.string().uuid().optional(),billing_interval:z.enum(["MONTHLY","ANNUAL"]).optional(),amount_minor:z.string().regex(/^[1-9]\d*$/),currency:z.string().regex(/^[A-Z]{3}$/),idempotency_key:z.string().uuid(),gateway:z.literal("PAYPAL"),provider_environment:z.enum(["LIVE","SANDBOX"]),provider_intent_id:z.string().nullable().optional(),payment_intent_id:z.string().uuid().nullable().optional()});
const respond=(body:unknown,status:number)=>Response.json(body,{status,headers:paymentResponseHeaders});
export async function POST(request:Request){
 let gateway:ReturnType<typeof createPaymentGateway>;let appUrl:string;try{gateway=createPaymentGateway(getPaymentRuntimeConfig());appUrl=getServerEnvironment().NEXT_PUBLIC_APP_URL;}catch{return respond({error:"PAYMENT_CONFIGURATION_UNAVAILABLE"},503);}
 if(gateway.code!=="PAYPAL")return respond({error:"PAYMENT_NATIVE_REVIEW_UNAVAILABLE"},404);
 if(!paymentOriginAllowed(request,appUrl))return respond({error:"REQUEST_ORIGIN_DENIED"},403);
 const body=await readPaymentJson(request,8192);if(!body.ok)return respond({error:body.status===413?"REQUEST_TOO_LARGE":"INVALID_REQUEST"},body.status);
 const input=inputSchema.safeParse(body.body);if(!input.success)return respond({error:"INVALID_REQUEST"},400);
 const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)return respond({error:"UNAUTHENTICATED"},401);
 const pack=input.data.purchaseKind==="CREDIT_PACK";
 const loaded=await client.rpc(pack?"prepare_credit_pack_native_order_review_v1":"prepare_subscription_native_order_review_v1",{p_preparation_id:input.data.preparationId,p_provider_environment:gateway.providerEnvironment});
 if(loaded.error)return respond({error:loaded.error.code==="42501"?"FORBIDDEN":"PAYMENT_NATIVE_REVIEW_CONTEXT_UNAVAILABLE"},loaded.error.code==="42501"?403:409);
 const parsed=expectedSchema.safeParse(loaded.data);if(!parsed.success||parsed.data.preparation_id!==input.data.preparationId||parsed.data.provider_environment!==gateway.providerEnvironment||(parsed.data.provider_intent_id&&parsed.data.provider_intent_id!==input.data.providerIntentId))return respond({error:"PAYMENT_NATIVE_REVIEW_CONTEXT_INVALID"},409);
 const p=parsed.data;
 const common={organizationId:p.organization_id,amountMinor:p.amount_minor,currency:p.currency,idempotencyKey:p.idempotency_key,returnUrl:new URL(`/fr/client/${pack?"credits":"abonnement"}?organizationId=${p.organization_id}`,appUrl).toString()};
 const source=pack&&p.pack_version_id?{...common,purchaseKind:"CREDIT_PACK" as const,packVersionId:p.pack_version_id}:!pack&&p.plan_version_id&&p.billing_interval?{...common,purchaseKind:"SUBSCRIPTION" as const,planVersionId:p.plan_version_id,billingInterval:p.billing_interval}:null;
 if(!source)return respond({error:"PAYMENT_NATIVE_REVIEW_CONTEXT_INVALID"},409);
 try{
  // Native invoice binding is checked by the port before any SQL disposition or registration.
  const native=await gateway.lookupOrder(input.data.providerIntentId,source);const admin=getSupabaseAdminClient({timeoutMs:5000});const correlation=randomUUID();
  const observation=await admin.rpc("record_verified_native_order_observation_v1",{p_purchase_kind:input.data.purchaseKind,p_preparation_id:p.preparation_id,p_provider_environment:gateway.providerEnvironment,p_provider_intent_id:native.orderId,p_native_status:native.status,p_amount_minor:native.amountMinor,p_currency:native.currency,p_capture_reference:native.capture?.captureId??null,p_paid_at:native.capture?.paidAt??null,p_response_hash:native.responseHash,p_observed_at:native.observedAt,p_correlation_id:correlation});
  if(observation.error||!z.object({outcome:z.literal("NATIVE_ORDER_OBSERVATION_RECORDED"),observation_id:z.string().uuid()}).safeParse(observation.data).success)return respond({error:"PAYMENT_NATIVE_OBSERVATION_UNAVAILABLE"},503);
  // Pack processing requires a registered source. This registration follows an exact native GET,
  // never another PSP creation; its SQL preserves already-paid facts after preparation expiry.
  if(pack&&!p.payment_intent_id){const registered=await admin.rpc("register_credit_pack_payment_intent_v1",{p_preparation_id:p.preparation_id,p_provider_environment:gateway.providerEnvironment,p_provider_intent_id:native.orderId,p_amount_minor:native.amountMinor,p_currency:native.currency,p_correlation_id:correlation});const registeredId=z.object({payment_intent_id:z.string().uuid()}).safeParse(registered.data);if(registered.error||!registeredId.success)return respond({error:"PAYMENT_NATIVE_REGISTRATION_REVIEW_REQUIRED",observationRecorded:true},503);p.payment_intent_id=registeredId.data.payment_intent_id;}
  if(native.status==="VOIDED"){
   const result=await admin.rpc(pack?"record_credit_pack_native_resolution_v1":"record_subscription_checkout_native_resolution_v1",{p_request_id:p.preparation_id,p_provider_environment:gateway.providerEnvironment,p_provider_intent_id:native.orderId,p_native_status:"VOIDED",p_response_hash:native.responseHash,p_observed_at:native.observedAt,p_correlation_id:correlation});
   if(result.error)return respond({error:"PAYMENT_NATIVE_DISPOSITION_REJECTED"},409);
   const outcome=z.object({outcome:z.string()}).safeParse(result.data);
   if(!outcome.success||!(["SUBSCRIPTION_CHECKOUT_VOID_VERIFIED","CREDIT_PACK_NATIVE_ORDER_OBSERVED"].includes(outcome.data.outcome)))return respond({error:"PAYMENT_NATIVE_DISPOSITION_UNVERIFIED"},503);
   return respond({status:"NATIVE_VOID_CONFIRMED",purchaseKind:input.data.purchaseKind,preparationId:p.preparation_id},200);
  }
  if(native.status==="COMPLETED"&&native.capture){
   const receipt=await admin.rpc(pack?"process_native_credit_pack_payment_v1":"record_native_subscription_payment_v1",{...(!pack?{p_preparation_id:p.preparation_id}:{}),p_provider_environment:gateway.providerEnvironment,p_provider_intent_id:native.orderId,p_payment_reference:native.capture.captureId,p_amount_minor:native.capture.amountMinor,p_currency:native.capture.currency,p_paid_at:native.capture.paidAt,p_response_hash:native.responseHash,p_observed_at:native.observedAt,p_correlation_id:correlation});
   if(receipt.error)return respond({error:"PAYMENT_NATIVE_CAPTURE_IMPORT_REQUIRED"},503);
   const outcome=z.object({outcome:z.enum(["CREDIT_PACK_CAPTURED","SUBSCRIPTION_CAPTURE_RECONCILIATION_REQUIRED","SUBSCRIPTION_ACTIVATED"])}).safeParse(receipt.data);
   if(!outcome.success)return respond({error:"PAYMENT_NATIVE_CAPTURE_RECEIPT_UNVERIFIED"},503);
   return respond({status:outcome.data.outcome==="SUBSCRIPTION_CAPTURE_RECONCILIATION_REQUIRED"?"RECONCILIATION_REQUIRED":"CAPTURE_RECORDED",purchaseKind:input.data.purchaseKind},202);
  }
  if(!p.payment_intent_id){
   const registered=await admin.rpc(pack?"register_credit_pack_payment_intent_v1":"register_subscription_payment_intent_v2",{p_preparation_id:p.preparation_id,p_provider_environment:gateway.providerEnvironment,p_provider_intent_id:native.orderId,p_amount_minor:native.amountMinor,p_currency:native.currency,p_correlation_id:correlation});
   const id=z.object({payment_intent_id:z.string().uuid()}).safeParse(registered.data);if(registered.error||!id.success)return respond({error:"PAYMENT_NATIVE_REGISTRATION_REVIEW_REQUIRED"},409);
   return respond({status:"NATIVE_ORDER_REGISTERED",nativeStatus:native.status,paymentIntentId:id.data.payment_intent_id,confirmation:native.confirmation,purchaseKind:input.data.purchaseKind},200);
  }
  return respond({status:"NATIVE_ORDER_PENDING",nativeStatus:native.status,paymentIntentId:p.payment_intent_id,confirmation:native.confirmation,purchaseKind:input.data.purchaseKind},200);
 }catch{return respond({error:"PAYMENT_NATIVE_REVIEW_UNAVAILABLE"},503);}
}
