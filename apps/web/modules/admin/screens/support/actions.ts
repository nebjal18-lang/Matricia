"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
export async function revokeSupport(_: {status:"idle"|"success"|"error"},form:FormData):Promise<{status:"idle"|"success"|"error"}>{
 const input=z.object({id:z.string().uuid(),reason:z.string().trim().min(3).max(500),locale:z.enum(["fr","ar"]),work:z.string().uuid()}).safeParse({id:form.get("grantId"),reason:form.get("reason"),locale:form.get("locale"),work:form.get("workId")});
 if(!input.success)return{status:"error"};const c=await getSupabaseServerClient();const r=await c.rpc("revoke_admin_support_access_v1",{p_grant_id:input.data.id,p_reason:input.data.reason});if(r.error)return{status:"error"};revalidatePath(`/${input.data.locale}/administration/support/${input.data.work}`);return{status:"success"};
}
