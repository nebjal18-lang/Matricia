import {createPaymentGateway,PaymentGatewayError} from "@matricia/infrastructure";
import {z} from "zod";
import {getPaymentRuntimeConfig,getServerEnvironment} from "@/modules/shared/lib/env";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {paymentOriginAllowed,paymentResponseHeaders,readPaymentJson} from "@/modules/shared/lib/payment-http/request";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const inputSchema=z.object({paymentIntentId:z.string().uuid()}).strict();
const preparedSchema=z.object({payment_intent_id:z.string().uuid(),provider_intent_id:z.string().min(8).max(200),gateway:z.literal("PAYPAL"),provider_environment:z.enum(["LIVE","SANDBOX"]),replayed:z.boolean(),capture_authorized:z.boolean().optional(),capture_result:z.object({outcome:z.literal("CREDIT_PACK_CAPTURED"),payment_intent_id:z.string().uuid()}).passthrough().nullable().optional()});
const respond=(body:unknown,status:number)=>Response.json(body,{status,headers:paymentResponseHeaders});
export async function POST(request:Request){
 let gateway:ReturnType<typeof createPaymentGateway>;let appUrl:string;
 try{gateway=createPaymentGateway(getPaymentRuntimeConfig());appUrl=getServerEnvironment().NEXT_PUBLIC_APP_URL;}catch{return respond({error:"PAYMENT_CONFIGURATION_UNAVAILABLE"},503);}
 if(gateway.code!=="PAYPAL")return respond({error:"PAYMENT_PROVIDER_DISABLED"},404);
 if(!paymentOriginAllowed(request,appUrl))return respond({error:"REQUEST_ORIGIN_DENIED"},403);
 const body=await readPaymentJson(request,8192);if(!body.ok)return respond({error:body.status===413?"REQUEST_TOO_LARGE":"INVALID_REQUEST"},body.status);
 const input=inputSchema.safeParse(body.body);if(!input.success)return respond({error:"INVALID_REQUEST"},400);
 const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();if(!auth.user)return respond({error:"UNAUTHENTICATED"},401);
 const result=await client.rpc("prepare_credit_pack_payment_capture_v1",{p_payment_intent_id:input.data.paymentIntentId,p_provider_environment:gateway.providerEnvironment});
 if(result.error)return respond({error:result.error.message==="PAYMENT_CUSTOMER_MFA_REQUIRED"?"PAYMENT_CUSTOMER_MFA_REQUIRED":result.error.code==="42501"?"FORBIDDEN":"CREDIT_PACK_CAPTURE_REJECTED"},result.error.code==="42501"?403:409);
 const parsed=preparedSchema.safeParse(result.data);if(!parsed.success||parsed.data.payment_intent_id!==input.data.paymentIntentId||parsed.data.provider_environment!==gateway.providerEnvironment)return respond({error:"CREDIT_PACK_CAPTURE_REJECTED"},409);
 if(parsed.data.replayed){if(parsed.data.capture_result?.payment_intent_id!==input.data.paymentIntentId)return respond({error:"CREDIT_PACK_CAPTURE_REJECTED"},409);return respond({paymentIntentId:input.data.paymentIntentId,status:"CONFIRMED",purchaseKind:"CREDIT_PACK"},200);}
 if(parsed.data.capture_authorized!==true)return respond({paymentIntentId:input.data.paymentIntentId,status:"PENDING_NATIVE_REVIEW",purchaseKind:"CREDIT_PACK"},202);
 try{const result=await gateway.requestCapture(parsed.data.provider_intent_id,input.data.paymentIntentId);return respond({paymentIntentId:input.data.paymentIntentId,status:result.status,purchaseKind:"CREDIT_PACK"},202);}catch(error){const unavailable=error instanceof PaymentGatewayError&&error.code==="PROVIDER_UNAVAILABLE";return respond({error:unavailable?"PAYMENT_PROVIDER_UNAVAILABLE":"CREDIT_PACK_CAPTURE_REJECTED"},unavailable?502:422);}
}
