import {z}from"zod";
export const quoteDraftFields=["paymentTerms","maintenanceTerms","solution","deliverables","inclusions","exclusions","prerequisites","warranty","correctionTerms","proposedStartDate","durationDays","validUntil","changeReason"]as const;
export const storedQuoteLine=z.object({key:z.number().int().positive(),label:z.string().max(500),quantity:z.string().max(50),unitCode:z.string().max(32),unitPrice:z.string().max(50),taxRuleVersionId:z.string().max(36),itemKind:z.enum(["ONE_TIME","RECURRING"]),recurrenceInterval:z.enum(["","MONTH","QUARTER","YEAR"])});
export type QuoteLine=z.infer<typeof storedQuoteLine>;
export const storedQuoteOption=z.object({key:z.number().int().positive(),label:z.string().max(500),price:z.string().max(50)});
export type QuoteOption=z.infer<typeof storedQuoteOption>;
export const storedQuoteAttachment=z.object({documentVersionId:z.string().uuid(),title:z.string().min(2).max(255)});
export type QuoteAttachment=z.infer<typeof storedQuoteAttachment>;
const stored=z.object({version:z.literal(3),expiresAt:z.number().finite(),baseVersionId:z.string().uuid().nullable(),fields:z.record(z.string(),z.string().max(12000)),lines:z.array(storedQuoteLine).min(1).max(50),options:z.array(storedQuoteOption).max(20).optional(),attachments:z.array(storedQuoteAttachment).max(20).optional(),operation:z.object({revision:z.string().uuid(),correlation:z.string().uuid()})});
export type StoredQuoteDraft=z.infer<typeof stored>;
/** Preserves obsolete drafts for explicit review rather than deleting them on a server revision. */
export function restoreQuoteDraft(raw:string,currentVersionId:string|null,now=Date.now()):{status:"ready"|"conflict";draft:StoredQuoteDraft}|{status:"expired"|"invalid"}{
 if(raw.length>100000)return{status:"invalid"};let value:unknown;try{value=JSON.parse(raw);}catch{return{status:"invalid"};}
 const legacy=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:null;
 const unknownBase=legacy?.version===2;const parsed=stored.safeParse(unknownBase?{...legacy,version:3,baseVersionId:null}:value);
 if(!parsed.success)return{status:"invalid"};if(parsed.data.expiresAt<=now)return{status:"expired"};
 return{status:(unknownBase&&currentVersionId!==null)||parsed.data.baseVersionId!==currentVersionId?"conflict":"ready",draft:parsed.data};
}
export function saveQuoteDraft(storage:Pick<Storage,"setItem">,key:string,draft:StoredQuoteDraft):"saved"|"failed"{try{storage.setItem(key,JSON.stringify(draft));return"saved";}catch{return"failed";}}

export function createDraftAutosaver(write:()=>void,delay=500){
 let timer:ReturnType<typeof setTimeout>|null=null;
 const cancel=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
 return{schedule:()=>{cancel();timer=setTimeout(()=>{timer=null;write();},delay);},flush:()=>{cancel();write();},cancel};
}
