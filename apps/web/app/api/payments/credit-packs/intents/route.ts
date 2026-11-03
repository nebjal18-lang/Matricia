import {randomUUID} from "node:crypto";
import {createPaymentGateway,PaymentGatewayError} from "@matricia/infrastructure";
import {z} from "zod";
import {getPaymentRuntimeConfig,getServerEnvironment} from "@/modules/shared/lib/env";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {paymentOriginAllowed,paymentResponseHeaders,readPaymentJson} from "@/modules/shared/lib/payment-http/request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const inputSchema=z.object({organizationId:z.string().uuid(),packVersionId:z.string().uuid(),idempotencyKey:z.string().uuid(),locale:z.enum(["fr","ar"])}).strict();
const captureSchema=z.object({outcome:z.literal("CREDIT_PACK_CAPTURED"),payment_intent_id:z.string().uuid()}).passthrough();
const preparedSchema=z.object({preparation_id:z.string().uuid(),amount_minor:z.string().regex(/^[1-9]\d*$/),currency:z.string().regex(/^[A-Z]{3}$/),gateway:z.enum(["PAYPAL","DEMO","CMI"]),provider_environment:z.enum(["LIVE","SANDBOX","DEMO"]),purchase_kind:z.literal("CREDIT_PACK"),pack_version_id:z.string().uuid(),create_authorized:z.boolean(),provider_intent_id:z.string().min(8).max(200).nullable().optional(),payment_intent_id:z.string().uuid().nullable().optional(),capture_result:captureSchema.nullable().optional()});
const respond=(body:unknown,status:number)=>Response.json(body,{status,headers:paymentResponseHeaders});
export async function POST(request:Request){
 let config:ReturnType<typeof getServerEnvironment>;let gateway:ReturnType<typeof createPaymentGateway>;
 try{config=getServerEnvironment();gateway=createPaymentGateway(getPaymentRuntimeConfig());}catch{return respond({error:"PAYMENT_CONFIGURATION_UNAVAILABLE"},503);}
 if(!paymentOriginAllowed(request,config.NEXT_PUBLIC_APP_URL))return respond({error:"REQUEST_ORIGIN_DENIED"},403);
 const body=await readPaymentJson(request,32768);if(!body.ok)return respond({error:body.status===413?"REQUEST_TOO_LARGE":"INVALID_REQUEST"},body.status);
 const input=inputSchema.safeParse(body.body);if(!input.success)return respond({error:"INVALID_REQUEST"},400);
 const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)return respond({error:"UNAUTHENTICATED"},401);
 const result=await client.rpc("prepare_credit_pack_payment_intent_v1",{p_organization_id:input.data.organizationId,p_pack_version_id:input.data.packVersionId,p_gateway:gateway.code,p_provider_environment:gateway.providerEnvironment,p_idempotency_key:input.data.idempotencyKey});
 if(result.error)return respond({error:result.error.message==="PAYMENT_CUSTOMER_MFA_REQUIRED"?"PAYMENT_CUSTOMER_MFA_REQUIRED":result.error.code==="42501"?"FORBIDDEN":"CREDIT_PACK_PREPARATION_UNAVAILABLE"},result.error.code==="42501"?403:409);
 const parsed=preparedSchema.safeParse(result.data);
 if(!parsed.success||parsed.data.gateway!==gateway.code||parsed.data.provider_environment!==gateway.providerEnvironment||parsed.data.pack_version_id!==input.data.packVersionId)return respond({error:"CREDIT_PACK_PREPARATION_UNAVAILABLE"},503);
 const p=parsed.data;
 if(p.capture_result){if(p.capture_result.payment_intent_id!==p.payment_intent_id)return respond({error:"CREDIT_PACK_REPLAY_INVALID"},503);return respond({paymentIntentId:p.payment_intent_id,status:"CONFIRMED",purchaseKind:"CREDIT_PACK"},200);}
 const expected={purchaseKind:"CREDIT_PACK" as const,organizationId:input.data.organizationId,packVersionId:input.data.packVersionId,amountMinor:p.amount_minor,currency:p.currency,idempotencyKey:input.data.idempotencyKey,returnUrl:new URL(`/${input.data.locale}/client/credits?payment=pending&purchase=credit-pack&organizationId=${input.data.organizationId}`,config.NEXT_PUBLIC_APP_URL).toString()};
 if(!p.create_authorized){
  if(!p.payment_intent_id||!p.provider_intent_id)return respond({error:"PAYMENT_CREATION_RECONCILIATION_REQUIRED",preparationId:p.preparation_id},409);
  if(gateway.code==="DEMO")return respond({paymentIntentId:p.payment_intent_id,providerIntentId:p.provider_intent_id,gateway:gateway.code,status:"REQUIRES_CONFIRMATION",amountMinor:p.amount_minor,currency:p.currency,confirmation:null,purchaseKind:"CREDIT_PACK"},200);
  if(gateway.code!=="PAYPAL")return respond({error:"PAYMENT_CREATION_RECONCILIATION_REQUIRED",preparationId:p.preparation_id},409);
  try{const native=await gateway.lookupOrder(p.provider_intent_id,expected);if(native.status==="VOIDED"||native.status==="COMPLETED")return respond({error:"PAYMENT_NATIVE_REVIEW_REQUIRED",preparationId:p.preparation_id},409);return respond({paymentIntentId:p.payment_intent_id,providerIntentId:native.orderId,gateway:gateway.code,status:"REQUIRES_CONFIRMATION",amountMinor:p.amount_minor,currency:native.currency,confirmation:native.confirmation,purchaseKind:"CREDIT_PACK"},200);}catch{return respond({error:"PAYMENT_NATIVE_REVIEW_UNAVAILABLE"},503);}
 }
 try{
  const intent=await gateway.createIntent(expected);
  if(intent.gateway!==gateway.code||intent.providerEnvironment!==gateway.providerEnvironment||intent.amountMinor!==p.amount_minor||intent.currency!==p.currency)return respond({error:"PAYMENT_PROVIDER_CONTEXT_MISMATCH"},502);
  const registered=await getSupabaseAdminClient({timeoutMs:5000}).rpc("register_credit_pack_payment_intent_v1",{p_preparation_id:p.preparation_id,p_provider_environment:gateway.providerEnvironment,p_provider_intent_id:intent.providerIntentId,p_amount_minor:intent.amountMinor,p_currency:intent.currency,p_correlation_id:randomUUID()});
  const id=z.object({payment_intent_id:z.string().uuid()}).safeParse(registered.data);if(registered.error||!id.success)return respond({error:"CREDIT_PACK_REGISTRATION_UNAVAILABLE"},409);
  return respond({paymentIntentId:id.data.payment_intent_id,providerIntentId:intent.providerIntentId,gateway:intent.gateway,status:intent.status,amountMinor:intent.amountMinor,currency:intent.currency,confirmation:intent.confirmation,purchaseKind:"CREDIT_PACK"},201);
 }catch(error){return respond({error:error instanceof PaymentGatewayError&&error.code==="PROVIDER_UNAVAILABLE"?"PAYMENT_PROVIDER_UNAVAILABLE":"CREDIT_PACK_INTENT_UNAVAILABLE"},error instanceof PaymentGatewayError&&error.code==="PROVIDER_UNAVAILABLE"?502:422);}
}
