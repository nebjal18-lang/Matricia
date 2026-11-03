import {z} from "zod";
const id=z.string().uuid();
export const obligationRetirementRow=z.object({deliverable_id:id,mission_id:id,amendment_id:id,contract_version_id:id,operation:z.enum(["REMOVE","REPLACE"]),replacement_deliverable_id:id.nullable(),retired_at:z.string()});
export const milestoneRetirementRow=z.object({milestone_id:id,mission_id:id,amendment_id:id,contract_version_id:id,retired_at:z.string()});
export const retirementColumns="deliverable_id,mission_id,amendment_id,contract_version_id,operation,replacement_deliverable_id,retired_at";
export const milestoneRetirementColumns="milestone_id,mission_id,amendment_id,contract_version_id,retired_at";
export type ObligationRetirement={operation:"REMOVE"|"REPLACE";amendmentId:string;contractVersionId:string;replacementDeliverableId:string|null;retiredAt:string};
export function projectRetirement(value:z.infer<typeof obligationRetirementRow>|undefined):ObligationRetirement|undefined{return value?{operation:value.operation,amendmentId:value.amendment_id,contractVersionId:value.contract_version_id,replacementDeliverableId:value.replacement_deliverable_id,retiredAt:value.retired_at}:undefined}
