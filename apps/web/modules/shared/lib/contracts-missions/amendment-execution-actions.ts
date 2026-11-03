"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { casablancaLocalToIso } from "@/modules/shared/lib/geo/casablanca-time";
export type AmendmentExecutionState={status:"idle"}|{status:"success"}|{status:"error";reason:"VALIDATION"|"MFA"|"FORBIDDEN"|"CONFLICT"|"UNAVAILABLE"};
export async function executeMissionAmendment(_:AmendmentExecutionState,form:FormData):Promise<AmendmentExecutionState>{
 const parsed=z.object({locale:z.enum(["fr","ar"]),amendmentId:z.string().uuid(),preparationHash:z.string().regex(/^[0-9a-f]{64}$/u),scheduleConfirmed:z.literal("yes"),idempotencyKey:z.string().uuid()}).safeParse(Object.fromEntries(form));
 const keys=z.array(z.string().regex(/^[A-Z][A-Z0-9_-]{1,79}$/u)).max(50).safeParse(form.getAll("deliverableKey"));if(!parsed.success||!keys.success||new Set(keys.data).size!==keys.data.length)return{status:"error",reason:"VALIDATION"};
 const assignments=keys.data.map(key=>({deliverable_key:key,due_at:casablancaLocalToIso(String(form.get(`dueAt:${key}`)??""))}));if(assignments.some(item=>item.due_at===null))return{status:"error",reason:"VALIDATION"};
 const c=await getSupabaseServerClient(),auth=await c.auth.getUser();if(classifyAuthReadFailure(auth.error)==="UNAVAILABLE")return{status:"error",reason:"UNAVAILABLE"};if(!auth.data.user)return{status:"error",reason:"FORBIDDEN"};const aal=await c.auth.mfa.getAuthenticatorAssuranceLevel();if(aal.error)return{status:"error",reason:"UNAVAILABLE"};if(aal.data?.currentLevel!=="aal2")return{status:"error",reason:"MFA"};const p=parsed.data;
 const result=await c.rpc("execute_signed_mission_amendment_v1",{p_amendment_id:p.amendmentId,p_expected_preparation_hash:p.preparationHash,p_assignments:assignments,p_schedule_confirmed:true,p_idempotency_key:p.idempotencyKey});
 if(result.error)return{status:"error",reason:result.error.code==="42501"?"FORBIDDEN":["40001","55000","23505"].includes(result.error.code??"")?"CONFLICT":"UNAVAILABLE"};
 const response=z.object({outcome:z.literal("MISSION_AMENDMENT_EXECUTED"),amendment_id:z.literal(p.amendmentId),created_deliverables:z.number().int().nonnegative(),retired_deliverables:z.number().int().nonnegative().optional()}).refine(result=>result.created_deliverables+(result.retired_deliverables??0)>0).safeParse(result.data);if(!response.success)return{status:"error",reason:"UNAVAILABLE"};
 for(const locale of["fr","ar"]){for(const role of["client","sous-traitant"]){revalidatePath(`/${locale}/${role}/contrats`);revalidatePath(`/${locale}/${role}/missions`);revalidatePath(`/${locale}/${role}/missions/[missionId]`,"page")}revalidatePath(`/${locale}/sous-traitant/planning`)}
 return{status:"success"};
}
