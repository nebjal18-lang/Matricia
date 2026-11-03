import { randomUUID } from "node:crypto";
import { createPaymentGateway, PaymentGatewayError } from "@matricia/infrastructure";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaymentRuntimeConfig, getServerEnvironment } from "@/modules/shared/lib/env";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { paymentOriginAllowed, readPaymentJson } from "@/modules/shared/lib/payment-http/request";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const inputSchema=z.object({organizationId:z.string().uuid(),planVersionId:z.string().uuid(),billingInterval:z.enum(["MONTHLY","ANNUAL"]),idempotencyKey:z.string().uuid(),locale:z.enum(["fr","ar"]),upgrade:z.object({quoteId:z.string().uuid(),acceptedHash:z.string().regex(/^[a-f0-9]{64}$/u),consent:z.literal(true)}).optional()});
const maximumBodyBytes=32_768;

export async function POST(request:Request){
  let environment: ReturnType<typeof getServerEnvironment>;
  let gateway: ReturnType<typeof createPaymentGateway>;
  try {
    environment=getServerEnvironment();
    gateway=createPaymentGateway(getPaymentRuntimeConfig());
  } catch {
    return NextResponse.json({error:"PAYMENT_CONFIGURATION_UNAVAILABLE"},{status:503});
  }
  if(!paymentOriginAllowed(request,environment.NEXT_PUBLIC_APP_URL))return NextResponse.json({error:"REQUEST_ORIGIN_DENIED"},{status:403});
  const body=await readPaymentJson(request,maximumBodyBytes);if(!body.ok)return NextResponse.json({error:body.status===413?"REQUEST_TOO_LARGE":"INVALID_REQUEST"},{status:body.status});
  const parsed=inputSchema.safeParse(body.body);if(!parsed.success)return NextResponse.json({error:"INVALID_REQUEST"},{status:400});
  const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)return NextResponse.json({error:"UNAUTHENTICATED"},{status:401});
  const preparation = parsed.data.upgrade ? await client.rpc("prepare_client_subscription_upgrade_payment_v1",{p_organization_id:parsed.data.organizationId,p_quote_id:parsed.data.upgrade.quoteId,p_accepted_hash:parsed.data.upgrade.acceptedHash,p_consent:true,p_gateway:gateway.code,p_provider_environment:gateway.providerEnvironment,p_idempotency_key:parsed.data.idempotencyKey}) : await client.rpc("prepare_subscription_payment_intent_v2", {
    p_organization_id: parsed.data.organizationId, p_plan_version_id: parsed.data.planVersionId,
    p_billing_interval: parsed.data.billingInterval, p_gateway: gateway.code,p_provider_environment:gateway.providerEnvironment, p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (preparation.error) return NextResponse.json({ error: preparation.error.message==="PAYMENT_CUSTOMER_MFA_REQUIRED"?"PAYMENT_CUSTOMER_MFA_REQUIRED":preparation.error.code === "42501" ? "FORBIDDEN" : ["SUBSCRIPTION_NOT_ACTIVATABLE","SUBSCRIPTION_FINANCIAL_HOLD","CLIENT_IDENTITY_REVIEW_REQUIRED","SUBSCRIPTION_CHECKOUT_ALREADY_PENDING","SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED","SUBSCRIPTION_LEGACY_CHECKOUT_RECONCILIATION_REQUIRED","PAYMENT_POSTING_CONFIGURATION_REQUIRED","UPGRADE_TERMS_CONSENT_REQUIRED","APPROVED_UPGRADE_POLICY_REQUIRED","UPGRADE_OPERATION_RESTRICTED","STALE_UPGRADE_QUOTE","UPGRADE_CHECKOUT_ALREADY_PREPARED"].includes(preparation.error.message)?preparation.error.message:"PAYMENT_PREPARATION_UNAVAILABLE" }, { status: preparation.error.code === "42501" ? 403 : 409 });
  const prepared = z.object({ preparation_id: z.string().uuid(), amount_minor: z.string().regex(/^[1-9]\d*$/u), currency: z.string().regex(/^[A-Z]{3}$/u),create_authorized:z.boolean(),plan_version_id:z.string().uuid().optional(),billing_interval:z.enum(["MONTHLY","ANNUAL"]).optional(),organization_id:z.string().uuid().optional(),upgrade_quote_id:z.string().uuid().optional(),upgrade_hash:z.string().regex(/^[a-f0-9]{64}$/u).optional(),payment_intent_id:z.string().uuid().nullable().optional(),provider_intent_id:z.string().min(8).max(200).nullable().optional(),payment_result:z.object({outcome:z.literal("SUBSCRIPTION_ACTIVATED"),payment_intent_id:z.string().uuid()}).passthrough().nullable().optional() }).safeParse(preparation.data);
  if (!prepared.success) return NextResponse.json({ error: "PAYMENT_PREPARATION_UNAVAILABLE" }, { status: 503 });
  if(parsed.data.upgrade && (prepared.data.upgrade_quote_id !== parsed.data.upgrade.quoteId || prepared.data.upgrade_hash !== parsed.data.upgrade.acceptedHash || prepared.data.organization_id !== parsed.data.organizationId || !prepared.data.plan_version_id || !prepared.data.billing_interval)) return NextResponse.json({error:"PAYMENT_PREPARATION_UNAVAILABLE"},{status:503});
  const amountMinor = prepared.data.amount_minor;
  const expected={organizationId:parsed.data.organizationId,planVersionId:parsed.data.upgrade?prepared.data.plan_version_id!:parsed.data.planVersionId,billingInterval:parsed.data.upgrade?prepared.data.billing_interval!:parsed.data.billingInterval,amountMinor,currency:prepared.data.currency,idempotencyKey:parsed.data.idempotencyKey,returnUrl:new URL(`/${parsed.data.locale}/client/abonnement?payment=pending&organizationId=${parsed.data.organizationId}`,environment.NEXT_PUBLIC_APP_URL).toString()};
  if(prepared.data.payment_result){
    if(prepared.data.payment_result.payment_intent_id!==prepared.data.payment_intent_id)return NextResponse.json({error:"PAYMENT_PREPARATION_UNAVAILABLE"},{status:503});
    return NextResponse.json({paymentIntentId:prepared.data.payment_intent_id,status:"CONFIRMED"},{status:200});
  }
  if(!prepared.data.create_authorized){
    if(!prepared.data.payment_intent_id||!prepared.data.provider_intent_id)return NextResponse.json({error:"PAYMENT_CREATION_RECONCILIATION_REQUIRED",preparationId:prepared.data.preparation_id},{status:409});
    if(gateway.code==="DEMO")return NextResponse.json({paymentIntentId:prepared.data.payment_intent_id,providerIntentId:prepared.data.provider_intent_id,gateway:gateway.code,status:"REQUIRES_CONFIRMATION",amountMinor,currency:prepared.data.currency,confirmation:null},{status:200});
    if(gateway.code!=="PAYPAL")return NextResponse.json({error:"PAYMENT_CREATION_RECONCILIATION_REQUIRED",preparationId:prepared.data.preparation_id},{status:409});
    try{
      const native=await gateway.lookupOrder(prepared.data.provider_intent_id,expected);
      if(native.status==="VOIDED"||native.status==="COMPLETED")return NextResponse.json({error:"PAYMENT_NATIVE_REVIEW_REQUIRED",preparationId:prepared.data.preparation_id},{status:409});
      return NextResponse.json({paymentIntentId:prepared.data.payment_intent_id,providerIntentId:native.orderId,gateway:gateway.code,status:"REQUIRES_CONFIRMATION",amountMinor,currency:native.currency,confirmation:native.confirmation},{status:200});
    }catch{return NextResponse.json({error:"PAYMENT_NATIVE_REVIEW_UNAVAILABLE"},{status:503});}
  }
  try{
    const intent=await gateway.createIntent(expected);
    if(intent.providerEnvironment!==gateway.providerEnvironment||intent.gateway!==gateway.code)return NextResponse.json({error:"PAYMENT_PROVIDER_CONTEXT_MISMATCH"},{status:502});
    const{data,error}=await getSupabaseAdminClient().rpc("register_subscription_payment_intent_v2",{p_preparation_id:prepared.data.preparation_id,p_provider_environment:gateway.providerEnvironment,p_provider_intent_id:intent.providerIntentId,p_amount_minor:intent.amountMinor,p_currency:intent.currency,p_correlation_id:randomUUID()});
    if(error)return NextResponse.json({error:error.code==="42501"?"FORBIDDEN":"PAYMENT_INTENT_UNAVAILABLE"},{status:error.code==="42501"?403:409});
    const paymentIntentId=isRecord(data)&&typeof data.payment_intent_id==="string"?data.payment_intent_id:null;
    if(!paymentIntentId)return NextResponse.json({error:"PAYMENT_INTENT_UNAVAILABLE"},{status:502});
    return NextResponse.json({paymentIntentId,providerIntentId:intent.providerIntentId,gateway:intent.gateway,status:intent.status,amountMinor:intent.amountMinor,currency:intent.currency,confirmation:intent.confirmation},{status:201});
  }catch(error){
    if(error instanceof PaymentGatewayError&&error.code==="PROVIDER_UNAVAILABLE")return NextResponse.json({error:"PAYMENT_PROVIDER_UNAVAILABLE"},{status:502});
    return NextResponse.json({error:error instanceof PaymentGatewayError?"PAYMENT_REQUEST_REJECTED":"PAYMENT_INTENT_UNAVAILABLE"},{status:422});
  }
}
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value)}
