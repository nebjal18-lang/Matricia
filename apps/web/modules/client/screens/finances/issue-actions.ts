"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
export type IssueState = { status: "idle" } | { status: "success"; number: string } | { status: "error"; code: "UNAVAILABLE" | "POLICY" | "IDENTITY" | "MFA" | "SIMULATION" };
const input = z.object({locale:z.enum(["fr","ar"]),organizationId:z.string().uuid(),paymentEventId:z.string().regex(/^[1-9]\d{0,18}$/u),adjustmentId:z.string().uuid().nullable(),idempotencyKey:z.string().uuid()});
const outcome = z.object({outcome:z.enum(["CLIENT_DOCUMENT_ISSUED","CLIENT_DOCUMENT_ALREADY_ISSUED"]),document_id:z.string().uuid(),document_number:z.string().min(8),kind:z.enum(["INVOICE","CREDIT_NOTE"])});
export async function issueClientDocument(_:IssueState,form:FormData):Promise<IssueState>{
 const parsed=input.safeParse({locale:form.get("locale"),organizationId:form.get("organizationId"),paymentEventId:form.get("paymentEventId"),adjustmentId:form.get("adjustmentId")||null,idempotencyKey:form.get("idempotencyKey")});
 if(!parsed.success)return {status:"error",code:"UNAVAILABLE"};
 try{
  const client=await getSupabaseServerClient();const auth=await client.auth.getUser();if(auth.error||!auth.data.user)return{status:"error",code:"UNAVAILABLE"};
  const assurance=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(assurance.error||assurance.data?.currentLevel!=="aal2")return{status:"error",code:"MFA"};
  const p=parsed.data,result=await client.rpc("issue_scoped_client_commercial_document_v1",{p_organization_id:p.organizationId,p_payment_event_id:p.paymentEventId,p_adjustment_id:p.adjustmentId,p_idempotency_key:p.idempotencyKey,p_correlation_id:randomUUID()});
  if(result.error){const message=result.error.message;return{status:"error",code:message.includes("BILLING_POLICY_REQUIRED")?"POLICY":message.includes("CLIENT_BILLING_IDENTITY_REQUIRED")?"IDENTITY":message.includes("SIMULATED_PAYMENT_NOT_INVOICEABLE")?"SIMULATION":"UNAVAILABLE"};}
  const data=outcome.safeParse(result.data);if(!data.success)return{status:"error",code:"UNAVAILABLE"};
  revalidatePath(`/${p.locale}/client/finances`);return{status:"success",number:data.data.document_number};
 }catch{return{status:"error",code:"UNAVAILABLE"};}
}
