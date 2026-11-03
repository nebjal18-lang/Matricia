import { z } from "zod";
const key=z.string().regex(/^[A-Z][A-Z0-9_-]{1,79}$/u);
const executableMissionPreparationSchema=z.object({
 contract_id:z.string().uuid(),contract_version_id:z.string().uuid(),template_hash:z.string().regex(/^[a-f0-9]{64}$/u),
 client_organization_id:z.string().uuid(),provider_organization_id:z.string().uuid(),
 deliverables:z.array(z.object({key,label_fr:z.string(),label_ar:z.string(),source_description:z.string().nullable(),required_criteria:z.array(z.object({key,label_fr:z.string(),label_ar:z.string()})).max(30).nullable().optional()})).min(1).max(500),
 criteria:z.array(z.object({key,label_fr:z.string(),label_ar:z.string(),proof_required:z.boolean()})).min(1).max(100),
});
export const missionPreparationSchema=z.union([executableMissionPreparationSchema,z.object({contract_id:z.string().uuid(),contract_version_id:z.string().uuid(),no_mission_required:z.literal(true)})]);
export type MissionPreparation=z.infer<typeof missionPreparationSchema>;
export const missionAssignmentsSchema=z.array(z.object({
 deliverable_key:key,due_at:z.union([z.literal(""),z.string().datetime()]),owner_organization_id:z.string().uuid(),criterion_keys:z.array(key).min(1).max(100),
})).min(1).max(500).superRefine((items,ctx)=>{if(new Set(items.map(i=>i.deliverable_key)).size!==items.length)ctx.addIssue({code:"custom",message:"Duplicate deliverable"});});
export function missionAssignments(form:FormData){
 const keys=form.getAll("deliverableKey").map(String);
 return missionAssignmentsSchema.safeParse(keys.map(key=>({deliverable_key:key,due_at:form.get(`dueAt:${key}`)?`${String(form.get(`dueAt:${key}`))}T23:59:00.000Z`:"",owner_organization_id:String(form.get(`owner:${key}`)??""),criterion_keys:form.getAll(`criterion:${key}`).map(String)})));
}
