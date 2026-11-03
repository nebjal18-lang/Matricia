"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
export async function resolveCapabilityReview(_: {status:"idle"|"success"|"error"},form:FormData):Promise<{status:"idle"|"success"|"error"}>{
 const input=z.object({id:z.string().uuid(),resolution:z.enum(["REJECTED","CANONICAL_ROLE_APPLIED"]),role:z.string().max(100),reason:z.string().trim().min(3).max(500),locale:z.enum(["fr","ar"])}).safeParse({id:form.get("reviewId"),resolution:form.get("resolution"),role:form.get("canonicalRole")??"",reason:form.get("reason"),locale:form.get("locale")});
 if(!input.success)return{status:"error"};
 const r=await(await getSupabaseServerClient()).rpc("resolve_admin_capability_review_v1",{p_review_id:input.data.id,p_resolution:input.data.resolution,p_canonical_role:input.data.role||null,p_reason:input.data.reason});if(r.error)return{status:"error"};
 revalidatePath(`/${input.data.locale}/administration/revues-capacites`);revalidatePath(`/${input.data.locale}/administration/command-center`);return{status:"success"};
}
