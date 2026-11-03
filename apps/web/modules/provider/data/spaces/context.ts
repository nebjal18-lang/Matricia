import {z}from"zod";
import {readAllPages}from"@/modules/shared/lib/data/read-pages";
import {getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import type{Locale}from"@/modules/shared/lib/i18n/locale";
import {selectProviderMembership}from"./organization-context";
import {classifyAuthReadFailure}from"@/modules/shared/lib/auth/read-failure";
export async function resolveProviderSpace(input:{locale:Locale;organizationId?:string}){
 const client=await getSupabaseServerClient(),{data:auth,error:authError}=await client.auth.getUser();
 const authFailure=classifyAuthReadFailure(authError);
 if(authFailure==="UNAVAILABLE")return{status:"success"as const,readError:"AUTH_QUERY_FAILED"as const,locale:input.locale,userEmail:null,selectedOrganizationId:null,selectedQuery:"",organizationName:null,organizations:[]};
 if(authFailure==="UNAUTHENTICATED"||!auth.user)return{status:"unauthenticated"as const};
 const result=await readAllPages((from,to)=>client.from("organization_memberships").select("organization_id,organizations!inner(display_name,status),organization_member_roles!inner(role_code,revoked_at)").eq("user_id",auth.user.id).eq("status","ACTIVE").is("organization_member_roles.revoked_at",null).in("organization_member_roles.role_code",["PROVIDER_OWNER","PROVIDER_MANAGER","PROVIDER_ACCOUNTING","PROVIDER_SALES","PROVIDER_TECHNICIAN","PROVIDER_VIEWER"]).in("organizations.status",["ACTIVE","PENDING"]).order("organization_id").range(from,to));
 const parsed=z.array(z.object({organization_id:z.string().uuid(),organizations:z.object({display_name:z.string(),status:z.string()})})).safeParse(result.data);
 const memberships=!result.error&&parsed.success?parsed.data:[],selected=selectProviderMembership(memberships,input.organizationId);
 const organizations=[...new Map(memberships.map(item=>[item.organization_id,{id:item.organization_id,name:item.organizations.display_name}])).values()];
 const selectedOrganizationId=selected?.organization_id??null,selectedQuery=selectedOrganizationId?`?organizationId=${encodeURIComponent(selectedOrganizationId)}`:"";
 return{status:"success"as const,readError:result.error?"QUERY_FAILED"as const:!parsed.success?"INVALID_RESPONSE"as const:null,locale:input.locale,userEmail:auth.user.email??null,selectedOrganizationId,selectedQuery,organizationName:selected?.organizations.display_name??null,organizations};
}
