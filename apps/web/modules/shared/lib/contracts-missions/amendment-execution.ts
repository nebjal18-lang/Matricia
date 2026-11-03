import { z } from "zod";
export const amendmentExecutionSchema=z.object({
 amendment_id:z.string().uuid(),status:z.enum(["NO_MISSION","AWAITING_SIGNATURE","MISSION_CANCELLED","SIGNATURE_NOT_EFFECTIVE","MISSING_SIGNED_CRITERIA","READY","APPLIED","NO_ADDITIONAL_WORK","SCOPE_RECONCILIATION_REQUIRED","PREVIOUS_AMENDMENT_REQUIRED"]),
 no_mission_required:z.boolean().optional(),previous_amendment_id:z.string().uuid().nullable().optional(),
 mission_id:z.string().uuid().optional(),contract_version_id:z.string().uuid().optional(),contract_hash:z.string().regex(/^[0-9a-f]{64}$/u).optional(),preparation_hash:z.string().regex(/^[0-9a-f]{64}$/u).optional(),deadline_delta_days:z.number().int().optional(),can_apply:z.boolean(),
 removals:z.array(z.object({key:z.string(),label_fr:z.string(),label_ar:z.string(),operation:z.enum(["REMOVE","REPLACE"]),previous_deliverable_id:z.string().uuid()})).max(50).optional(),
 items:z.array(z.object({operation:z.enum(["ADD","REPLACE"]).optional(),key:z.string(),label_fr:z.string(),label_ar:z.string(),criteria:z.array(z.object({key:z.string(),label_fr:z.string(),label_ar:z.string()})).nullable().optional()})).max(50),
}).superRefine((value,ctx)=>{if(value.no_mission_required&&(value.status!=="NO_ADDITIONAL_WORK"||value.mission_id||value.items.length||value.removals?.length))ctx.addIssue({code:"custom",message:"Inconsistent absence of operational work"});if(value.status==="PREVIOUS_AMENDMENT_REQUIRED"&&!value.previous_amendment_id)ctx.addIssue({code:"custom",message:"Previous signed amendment missing"});if(value.status==="READY"&&(!value.mission_id||!value.contract_version_id||!value.preparation_hash||(!value.items.length&&!value.removals?.length)||value.items.some(item=>!item.criteria?.length)))ctx.addIssue({code:"custom",message:"Incomplete signed preparation"})});
export type AmendmentExecution=z.infer<typeof amendmentExecutionSchema>;
export async function readAmendmentExecutions(ids:string[],read:(ids:string[])=>PromiseLike<{data:unknown;error:unknown}>){
 const output=new Map<string,AmendmentExecution>();
 for(let from=0;from<ids.length;from+=100){const batch=ids.slice(from,from+100);try{const result=await read(batch),parsed=z.array(amendmentExecutionSchema).max(100).safeParse(result.data);if(!result.error&&parsed.success&&parsed.data.every(row=>batch.includes(row.amendment_id)))for(const row of parsed.data)output.set(row.amendment_id,row)}catch{/* Missing execution state remains unavailable, never inferred as applied. */}}
 return output;
}
