import {z} from "zod";
export const interventionMode=z.enum(["ONSITE","REMOTE","HYBRID"]);
export type InterventionMode=z.infer<typeof interventionMode>;
export const interventionDeclaration=z.object({organizationId:z.string().uuid(),modes:z.array(interventionMode).min(1).max(3),reason:z.string().trim().min(3).max(500),expectedVersion:z.coerce.number().int().min(0),idempotencyKey:z.string().uuid()});
export function interventionModeLabel(mode:InterventionMode,locale:"fr"|"ar"){return({ONSITE:["Sur site","في الموقع"],REMOTE:["À distance","عن بعد"],HYBRID:["Hybride","هجين"]}as const)[mode][locale==="ar"?1:0];}
