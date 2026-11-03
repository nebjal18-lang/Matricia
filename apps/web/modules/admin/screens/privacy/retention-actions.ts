"use server";
import {createHash,randomUUID}from"node:crypto";
import{z}from"zod";
import{revalidatePath}from"next/cache";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{requestAdminAction,type AdminActionState}from"@/modules/admin/screens/command-center/actions";
import{bindAdminDeployment}from"@/modules/admin/screens/spaces/environment";
export async function requestBoundedRetention(previous:AdminActionState,form:FormData):Promise<AdminActionState>{
 const t=(key:string)=>String(form.get(key)??"").trim();const locale=z.enum(["fr","ar"]).safeParse(t("locale"));if(!locale.success)return{status:"error",reason:"VALIDATION"};
 const intent=t("intent");let payload:Record<string,string>;let org:string;let resource:string;let resourceId:string;
 const client=await getSupabaseServerClient();
 if(intent==="policy"){
  const input=z.object({policyId:z.string().uuid(),policyHash:z.string().regex(/^[a-f0-9]{64}$/u),legalApprovalReference:z.string().min(8).max(500)}).safeParse({policyId:t("policyId"),policyHash:t("policyHash"),legalApprovalReference:t("legalApprovalReference")});if(!input.success)return{status:"error",reason:"VALIDATION"};
  const policy=await client.from("retention_policies").select("organization_id").eq("id",input.data.policyId).maybeSingle();if(policy.error||!policy.data)return{status:"error",reason:"FORBIDDEN"};
  org=String(policy.data.organization_id);resource="PRIVACY_RETENTION_POLICY";resourceId=input.data.policyId;payload=input.data;
 }else if(intent==="execute"){
  const input=z.object({actionId:z.string().uuid(),policyApprovalId:z.string().uuid(),dsrId:z.string().uuid(),subjectUserId:z.string().uuid()}).safeParse({actionId:t("actionId"),policyApprovalId:t("policyApprovalId"),dsrId:t("dsrId"),subjectUserId:t("subjectUserId")});if(!input.success)return{status:"error",reason:"VALIDATION"};
  const action=await client.from("privacy_retention_actions").select("organization_id").eq("id",input.data.actionId).maybeSingle();if(action.error||!action.data)return{status:"error",reason:"FORBIDDEN"};
  org=String(action.data.organization_id);resource="PRIVACY_RETENTION_ACTION";resourceId=input.data.actionId;payload=input.data;
 }else return{status:"error",reason:"VALIDATION"};
 const command=new FormData();for(const[k,v]of Object.entries({locale:locale.data,organizationId:org,actionType:"MANUAL_EXCEPTION",resourceType:resource,resourceId,reason:t("reason"),idempotencyKey:t("idempotencyKey")||randomUUID(),redactedSummary:JSON.stringify(payload),requestPayloadHash:createHash("sha256").update(JSON.stringify(payload)).digest("hex")}))command.set(k,v);
 if(!await bindAdminDeployment(command))return{status:"error",reason:"FORBIDDEN"};
 if(command.get("targetEnvironment")==="PRODUCTION")command.set("productionAuthorizationReference",t("productionAuthorizationReference"));
 const result=await requestAdminAction(previous,command);if(result.status==="success")revalidatePath(`/${locale.data}/administration/confidentialite`);return result;
}
