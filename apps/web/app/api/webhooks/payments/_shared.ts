import {randomUUID} from "node:crypto";
import {PaymentGatewayError,type PaymentWebhookVerifier} from "@matricia/infrastructure";
import {z} from "zod";
import {consumeVerifiedPaymentInbox} from "@/modules/shared/lib/payment-dispatch/consumer";
import {getSupabaseAdminClient} from "@/modules/shared/lib/supabase/admin";
import {paymentResponseHeaders} from "@/modules/shared/lib/payment-http/request";
const maximumBodyBytes=1_048_576;
const receiptSchema=z.object({outcome:z.literal("VERIFIED_PAYMENT_RECEIPT_RECORDED"),receipt_id:z.string().uuid(),correlation_id:z.string().uuid()});
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:paymentResponseHeaders});
export async function processPaymentWebhook(request:Request,verifier:PaymentWebhookVerifier,headers:Readonly<Record<string,string|undefined>>,expectedMediaType:string){
 const declared=request.headers.get("content-length");if(declared!==null){const length=Number(declared);if(!Number.isSafeInteger(length)||length<0||length>maximumBodyBytes)return respond({error:"PAYLOAD_TOO_LARGE"},413);}
 if(request.headers.get("content-type")?.split(";",1)[0]?.trim().toLowerCase()!==expectedMediaType)return respond({error:"INVALID_PAYLOAD"},415);
 if(!request.body)return respond({error:"INVALID_PAYLOAD"},400);
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximumBodyBytes){await reader.cancel();return respond({error:"PAYLOAD_TOO_LARGE"},413);}chunks.push(value);}}catch{return respond({error:"INVALID_PAYLOAD"},400);}finally{reader.releaseLock();}
 if(size===0)return respond({error:"INVALID_PAYLOAD"},400);
 let event;try{event=await verifier.verifyWebhook(Buffer.concat(chunks),headers);}catch(error){const badSignature=error instanceof PaymentGatewayError&&error.code==="INVALID_SIGNATURE";return respond({error:badSignature?"INVALID_SIGNATURE":"INVALID_EVENT"},badSignature?401:400);}
 if(event.providerEnvironment!==verifier.providerEnvironment||event.providerEnvironment==="UNVERIFIED")return respond({error:"PAYMENT_PROVIDER_ENVIRONMENT_UNVERIFIED"},409);
 const client=getSupabaseAdminClient({timeoutMs:5000});
 const fact=event.eventType==="PAYMENT_SUCCEEDED"?{provider_intent_id:event.providerIntentId,payment_reference:event.paymentReference,amount_minor:event.amountMinor,currency:event.currency,occurred_at:event.paidAt}:{provider_payment_id:event.providerPaymentId,provider_adjustment_id:event.providerAdjustmentId,merchant_reference:event.merchantReference??null,amount_minor:event.amountMinor,currency:event.currency,occurred_at:event.occurredAt};
 // Persist verified cash facts before resolving their domain. Never trust a purchase kind from the body.
 const stored=await client.rpc("record_verified_payment_inbox_v1",{p_gateway:event.gateway,p_provider_environment:event.providerEnvironment,p_provider_event_id:event.providerEventId,p_event_type:event.eventType,p_provider_reference:event.eventType==="PAYMENT_SUCCEEDED"?event.providerIntentId:event.providerPaymentId,p_fact:fact,p_payload_hash:event.payloadHash,p_signature_fingerprint:event.signatureFingerprint,p_correlation_id:randomUUID()});
 const receipt=receiptSchema.safeParse(stored.data);
 if(stored.error||!receipt.success)return respond({error:"PAYMENT_RECEIPT_UNAVAILABLE"},503);
 const result=await consumeVerifiedPaymentInbox(receipt.data.receipt_id);
 if(!result.ok)return respond({error:result.code,receiptRecorded:true},503);
 return respond({received:true,replayed:result.replayed===true,...(result.reconciliationRequired?{reconciliationRequired:true}:{})},result.reconciliationRequired?202:200);
}
