"use server";
import{createHash}from"node:crypto";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{requestAdminAction,type AdminActionState}from"@/modules/admin/screens/command-center/actions";
import{bindAdminDeployment}from"@/modules/admin/screens/spaces/environment";
import{organizationIdentityContextSchema}from"./model";
export async function requestCanonicalIdentityRevision(previous:AdminActionState,form:FormData):Promise<AdminActionState>{
 const t=(key:string)=>String(form.get(key)??"").trim();
 const value=z.object({id:z.string().uuid(),hash:z.string().regex(/^[a-f0-9]{64}$/u),version:z.coerce.number().int().positive(),name:z.string().min(2).max(240),country:z.string().regex(/^[A-Z]{2}$/u),ice:z.string().regex(/^[0-9]{15}$/u),ifNumber:z.string().regex(/^[0-9]{6,20}$/u),rc:z.string().min(2).max(80).regex(/^[\p{L}\p{N}]+$/u),reason:z.string().min(10).max(2000),key:z.string().uuid(),locale:z.enum(["fr","ar"])}).safeParse({id:t("organizationId"),hash:t("identityHash"),version:t("rowVersion"),name:t("legalName"),country:t("country").toUpperCase(),ice:t("ice"),ifNumber:t("ifNumber"),rc:t("rcNumber").toUpperCase().replace(/[^\p{L}\p{N}]/gu,""),reason:t("reason"),key:t("idempotencyKey"),locale:t("locale")});
 if(!value.success||t("identityConfirmed")!=="on")return{status:"error",reason:"VALIDATION"};
 const c=await getSupabaseServerClient(),{data:auth}=await c.auth.getUser();if(!auth.user)return{status:"error",reason:"UNAUTHENTICATED"};
 const response=await c.rpc("get_admin_organization_identity_edit_context_v1",{p_organization_id:value.data.id}),context=organizationIdentityContextSchema.safeParse(response.data);if(response.error||!context.success)return{status:"error",reason:"FORBIDDEN"};
 if(context.data.identity_hash!==value.data.hash||context.data.snapshot.organization.row_version!==value.data.version)return{status:"error",reason:"CONFLICT"};
 let profile:Record<string,unknown>|null=null;
 if(context.data.snapshot.client_case?.legal_profile){
  if(value.data.rc.length<3||value.data.rc.length>32)return{status:"error",reason:"VALIDATION"};
  const input=z.object({legal_form:z.string().min(2).max(120),registered_city:z.string().min(2).max(120),line1:z.string().min(3).max(300),line2:z.string().max(300),postal_code:z.string().max(30)}).safeParse({legal_form:t("verifiedLegalForm"),registered_city:t("registeredCity"),line1:t("registeredAddress"),line2:t("registeredAddressLine2"),postal_code:t("registeredPostalCode")});if(!input.success)return{status:"error",reason:"VALIDATION"};
  profile={legal_form:input.data.legal_form,registered_city:input.data.registered_city,registered_address:{line1:input.data.line1,line2:input.data.line2,postal_code:input.data.postal_code,country_code:value.data.country}};
 }
 const summary={intent:"CHANGE_CONFIGURATION",extendedIdentity:true,expectedRowVersion:value.data.version,expectedIdentityHash:value.data.hash,expectedIce:context.data.snapshot.identifiers.ICE??"",legalName:value.data.name,country:value.data.country,ice:value.data.ice,ifNumber:value.data.ifNumber,rcNumber:value.data.rc,identityProfile:profile};
 const encoded=JSON.stringify(summary);form.set("redactedSummary",encoded);form.set("requestPayloadHash",createHash("sha256").update(encoded).digest("hex"));form.set("actionType","MANUAL_EXCEPTION");form.set("resourceType","ORGANIZATION");form.set("resourceId",value.data.id);form.set("organizationId",value.data.id);form.set("reason",value.data.reason);
 if(!await bindAdminDeployment(form))return{status:"error",reason:"FORBIDDEN"};
 return requestAdminAction(previous,form);
}
