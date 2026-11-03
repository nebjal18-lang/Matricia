import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
export async function bindAdminDeployment(form: FormData): Promise<boolean> {
 const response=await (await getSupabaseServerClient()).rpc("get_admin_execution_environment_v1");
 if(response.error||!["DEVELOPMENT","STAGING","PRODUCTION"].includes(String(response.data)))return false;
 form.set("targetEnvironment",String(response.data));return true;
}
