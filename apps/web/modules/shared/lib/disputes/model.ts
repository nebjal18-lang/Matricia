import type { DisputeEvidenceContext } from "./evidence-context";
import { z } from "zod";

export const uuidSchema=z.string().uuid();
export const hashSchema=z.string().regex(/^[0-9a-f]{64}$/u);
export const statusSchema=z.enum(["WARNING_LEVEL_1","PROVIDER_RESPONDED","MEDIATION_REVIEW","DECIDED","APPEALED","CLOSED"]);
export const evidenceTypeSchema=z.enum(["DOCUMENT","IMAGE","URL","MESSAGE","DELIVERY_PROOF","OTHER"]);
export const visibilitySchema=z.enum(["BOTH_PARTIES","CLIENT_ONLY","PROVIDER_ONLY","MEDIATOR_ONLY"]);
export const outcomeSchema=z.enum(["COMPLIANT","MINOR_CORRECTION","OUT_OF_SCOPE","CLIENT_ABUSE","MUTUAL_AGREEMENT","NON_COMPLIANT_CONFIRMED"]);

export type DisputeCapabilities={open:boolean;respond:boolean;decide:boolean;appeal:boolean;propose:boolean;approve:boolean;activate:boolean};
export type MissionOption={id:string;status:string};
export type Evidence={id:string;type:z.infer<typeof evidenceTypeSchema>;statement:string|null;url:string|null;visibility:z.infer<typeof visibilitySchema>;hash:string;createdAt:string};
export type DisputeResponse={id:string;type:"ACKNOWLEDGE_AND_CORRECT"|"CONTEST"|"OUT_OF_SCOPE";statement:string;submittedAt:string};
export type DisputeDecision={id:string;number:number;outcome:z.infer<typeof outcomeSchema>;reason:string;evidenceIds:string[];ruleVersion:string;decidedAt:string};
export type DisputeAppeal={id:string;grounds:string;submittedAt:string};
export type TimelineEvent={id:string;type:string;from:string|null;to:string;createdAt:string};
export type Reassignment={id:string;key:string;status:string;originalCostMinor:string;proposedCostMinor:string|null;costDeltaMinor:string|null;currency:string;rowVersion:number};
export type ReassignmentCandidate={organizationId:string;displayName:string;qualificationStatus:string;capacityStatus:string};
export type DisputeSummary={id:string;missionId:string;obligationKey:string;description:string;urgency:"STANDARD"|"URGENT";status:z.infer<typeof statusSchema>;responseDueAt:string;reviewDueAt:string|null;appealDueAt:string|null;rowVersion:number};
export type DisputeDetail=DisputeSummary&{evidenceOptions?:DisputeEvidenceContext;evidenceOptionsUnavailable?:boolean;correctionDueAt?:string|null;businessCalendarVersion?:string|null;clientOrganizationId:string;providerOrganizationId:string;policyVersion:string;evidence:Evidence[];response:DisputeResponse|null;decisions:DisputeDecision[];appeal:DisputeAppeal|null;events:TimelineEvent[];reassignment:Reassignment|null;candidates:ReassignmentCandidate[];capabilities:DisputeCapabilities};

export function moneyToMinor(value:string):string|null{const normalized=value.trim().replace(/\s/gu,"").replace(",",".");if(!/^\d+(?:\.\d{1,2})?$/u.test(normalized))return null;const[whole,fraction=""]=normalized.split(".");return(BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,"0"))).toString();}
export function formatMinorAmount(value:string,currency:string,locale:"fr"|"ar"):string{const amount=BigInt(value),zero=BigInt(0),scale=BigInt(100),negative=amount<zero,absolute=negative?-amount:amount,whole=(absolute/scale).toString(),fraction=(absolute%scale).toString().padStart(2,"0"),separator=locale==="ar"?"٬":" ",grouped=whole.replace(/\B(?=(\d{3})+(?!\d))/gu,separator);return `${negative?"−":""}${grouped},${fraction} ${currency}`;}
export function evidenceItem(statement:string,hash:string,visibility:string,type:string="MESSAGE"){return{type:evidenceTypeSchema.parse(type),statement:statement.trim(),hash:hashSchema.parse(hash),visibility:visibilitySchema.parse(visibility),metadata:{}};}
