import "server-only";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {refundPageSchema} from "./model";
export async function loadBenefitRefunds(organizationId:string|null,page:number){
 const c=await getSupabaseServerClient(),r=await c.rpc("list_benefit_refunds_v1",{p_organization_id:organizationId,p_page:page}),parsed=refundPageSchema.safeParse(r.data);
 return r.error||!parsed.success?null:parsed.data;
}
