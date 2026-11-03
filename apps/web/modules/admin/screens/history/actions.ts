"use server";
import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import{adminHistoryPageSchema,type AdminHistoryPage}from"./model";
export async function loadAdminHistoryPage(resourceId:string,organizationId?:string|null,before?:string|null):Promise<{status:"success";page:AdminHistoryPage}|{status:"error"}>{
 const input=z.object({resourceId:z.string().min(1).max(200),organizationId:z.string().uuid().nullish(),before:z.string().regex(/^\d{1,19}$/).nullish()}).safeParse({resourceId,organizationId,before});if(!input.success)return{status:"error"};
 const c=await getSupabaseServerClient();const r=await c.rpc("get_admin_resource_history_page_v1",{p_resource_id:input.data.resourceId,p_organization_id:input.data.organizationId??null,p_before_id:input.data.before??null,p_limit:100});const p=adminHistoryPageSchema.safeParse(r.data);return!r.error&&p.success?{status:"success",page:p.data}:{status:"error"};
}
