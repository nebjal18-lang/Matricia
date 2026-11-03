import {z} from "zod";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
const common={receipt_id:z.string().uuid(),gateway:z.enum(["PAYPAL","DEMO","CMI"]),provider_environment:z.enum(["LIVE","SANDBOX","DEMO"]),provider_event_id:z.string().min(8).max(200),provider_reference:z.string().min(3).max(200),payload_hash:z.string().regex(/^[a-f0-9]{64}$/),signature_fingerprint:z.string().regex(/^[a-f0-9]{64}$/),correlation_id:z.string().uuid()};
const money={amount_minor:z.string().regex(/^[1-9]\d{0,18}$/),currency:z.string().regex(/^[A-Z]{3}$/),occurred_at:z.string().datetime({offset:true})};
const storedSchema=z.discriminatedUnion("event_type",[
 z.object({...common,event_type:z.literal("PAYMENT_SUCCEEDED"),fact:z.object({...money,provider_intent_id:z.string().min(8).max(200),payment_reference:z.string().min(3).max(200)}).strict()}),
 z.object({...common,event_type:z.enum(["REFUND_SUCCEEDED","PAYMENT_REVERSED","DISPUTE_OPENED","DISPUTE_WON","DISPUTE_LOST"]),fact:z.object({...money,provider_payment_id:z.string().min(3).max(200),provider_adjustment_id:z.string().min(3).max(200),merchant_reference:z.string().max(200).nullable()}).strict()}),
]);
const targetSchema=z.object({kind:z.enum(["SUBSCRIPTION","CREDIT_PACK"]),payment_intent_id:z.string().uuid()});
export async function consumeVerifiedPaymentInbox(receiptId:string):Promise<{ok:boolean;code:string;replayed?:boolean;reconciliationRequired?:boolean}>{
 if(!z.string().uuid().safeParse(receiptId).success)return{ok:false,code:"PAYMENT_RECEIPT_INVALID"};
 const client=getSupabaseAdminClient({timeoutMs:5000});const loaded=await client.rpc("load_verified_payment_inbox_dispatch_v1",{p_receipt_id:receiptId});const stored=storedSchema.safeParse(loaded.data);
 if(loaded.error||!stored.success||stored.data.receipt_id!==receiptId)return{ok:false,code:"PAYMENT_RECEIPT_UNAVAILABLE"};
 const event=stored.data;const success=event.event_type==="PAYMENT_SUCCEEDED";
 if(event.provider_reference!==(event.event_type==="PAYMENT_SUCCEEDED"?event.fact.provider_intent_id:event.fact.provider_payment_id)||(event.gateway==="DEMO")!==(event.provider_environment==="DEMO"))return{ok:false,code:"PAYMENT_RECEIPT_CONTEXT_INVALID"};
 const finish=async(kind:"SUBSCRIPTION"|"CREDIT_PACK"|null,outcome:"DISPATCHED"|"RECONCILIATION_REQUIRED",reason:string|null)=>client.rpc("complete_verified_payment_dispatch_v1",{p_receipt_id:receiptId,p_purchase_kind:kind,p_outcome:outcome,p_reason_code:reason,p_correlation_id:event.correlation_id});
 const resolved=await client.rpc("resolve_verified_payment_kind_v1",{p_gateway:event.gateway,p_provider_environment:event.provider_environment,p_provider_intent_id:event.event_type==="PAYMENT_SUCCEEDED"?event.fact.provider_intent_id:null,p_payment_reference:event.event_type==="PAYMENT_SUCCEEDED"?null:event.fact.provider_payment_id});
 const target=targetSchema.safeParse(resolved.data);
 if(resolved.error||!target.success){await finish(null,"RECONCILIATION_REQUIRED","PAYMENT_PURPOSE_RESOLUTION_REQUIRED");return{ok:false,code:"PAYMENT_PURPOSE_RESOLUTION_REQUIRED"};}
 const kind=target.data.kind;
 const result=event.event_type==="PAYMENT_SUCCEEDED"
  ?await client.rpc(kind==="CREDIT_PACK"?"process_verified_credit_pack_payment_v1":"process_verified_subscription_payment_v2",{p_gateway:event.gateway,p_provider_environment:event.provider_environment,p_provider_event_id:event.provider_event_id,p_provider_intent_id:event.fact.provider_intent_id,p_event_type:event.event_type,p_amount_minor:event.fact.amount_minor,p_currency:event.fact.currency,p_paid_at:event.fact.occurred_at,p_payment_reference:event.fact.payment_reference,p_payload_hash:event.payload_hash,p_signature_fingerprint:event.signature_fingerprint,p_correlation_id:event.correlation_id})
  :await client.rpc(kind==="CREDIT_PACK"?"process_verified_credit_pack_adjustment_v1":"process_verified_subscription_adjustment_v2",{...(kind==="CREDIT_PACK"?{p_gateway:event.gateway}:{}),p_provider_environment:event.provider_environment,p_provider_event_id:event.provider_event_id,p_provider_payment_id:event.fact.provider_payment_id,p_provider_adjustment_id:event.fact.provider_adjustment_id,p_event_type:event.event_type,p_amount_minor:event.fact.amount_minor,p_currency:event.fact.currency,p_occurred_at:event.fact.occurred_at,p_payload_hash:event.payload_hash,p_signature_fingerprint:event.signature_fingerprint,p_merchant_reference:event.fact.merchant_reference,p_correlation_id:event.correlation_id});
 if(result.error){await finish(kind,"RECONCILIATION_REQUIRED","PAYMENT_DOMAIN_PROCESSING_REQUIRED");return{ok:false,code:success?"PAYMENT_EVENT_RECONCILIATION_REQUIRED":"PAYMENT_ADJUSTMENT_RECONCILIATION_REQUIRED"};}
 const finished=await finish(kind,"DISPATCHED",null);
 if(finished.error||!z.object({outcome:z.literal("PAYMENT_DISPATCH_RECORDED"),status:z.literal("DISPATCHED")}).safeParse(finished.data).success)return{ok:false,code:"PAYMENT_DISPATCH_ATTESTATION_REQUIRED"};
 const resultSchema=z.object({replayed:z.boolean().optional(),outcome:z.string()}).safeParse(result.data);
 return{ok:true,code:"VERIFIED_PAYMENT_DISPATCHED",replayed:resultSchema.success&&resultSchema.data.replayed===true,reconciliationRequired:resultSchema.success&&resultSchema.data.outcome==="SUBSCRIPTION_CAPTURE_RECONCILIATION_REQUIRED"};
}
