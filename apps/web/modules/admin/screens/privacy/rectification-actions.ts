"use server";
import{createHash,randomUUID}from"node:crypto";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{requestAdminAction,type AdminActionState}from"@/modules/admin/screens/command-center/actions";
import{bindAdminDeployment}from"@/modules/admin/screens/spaces/environment";
export async function requestDsrRectification(previous:AdminActionState,form:FormData):Promise<AdminActionState>{
 const t=(key:string)=>String(form.get(key)??"").trim();const p=z.object({requestId:z.string().uuid(),displayName:z.string().min(2).max(120),preferredLocale:z.enum(["fr-MA","ar-MA"]),expectedProfileVersion:z.coerce.number().int().positive(),locale:z.enum(["fr","ar"]),reason:z.string().min(10).max(2000),key:z.string().uuid()}).safeParse({requestId:t("requestId"),displayName:t("displayName"),preferredLocale:t("preferredLocale"),expectedProfileVersion:t("profileVersion"),locale:t("locale"),reason:t("reason"),key:t("idempotencyKey")});if(!p.success)return{status:"error",reason:"VALIDATION"};
 const c=await getSupabaseServerClient();const d=await c.from("data_subject_requests").select("organization_id").eq("id",p.data.requestId).maybeSingle();if(d.error||!d.data)return{status:"error",reason:"FORBIDDEN"};
 const payload={displayName:p.data.displayName,preferredLocale:p.data.preferredLocale,expectedProfileVersion:p.data.expectedProfileVersion,scope:"DISPLAY_NAME_AND_LOCALE"};const command=new FormData();for(const[k,v]of Object.entries({locale:p.data.locale,organizationId:String(d.data.organization_id),actionType:"MANUAL_EXCEPTION",resourceType:"PRIVACY_DSR_RECTIFICATION",resourceId:p.data.requestId,reason:p.data.reason,idempotencyKey:p.data.key||randomUUID(),redactedSummary:JSON.stringify(payload),requestPayloadHash:createHash("sha256").update(JSON.stringify(payload)).digest("hex")}))command.set(k,v);if(!await bindAdminDeployment(command))return{status:"error",reason:"FORBIDDEN"};if(command.get("targetEnvironment")==="PRODUCTION")command.set("productionAuthorizationReference",t("productionAuthorizationReference"));return requestAdminAction(previous,command);
}
