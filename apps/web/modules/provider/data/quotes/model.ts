import { z } from "zod";

export const quoteUuid = z.string().uuid();
export const exactMinor = z.string().regex(/^\d{1,18}$/u);
export const exactQuantity = z.string().regex(/^\d{1,14}(?:\.\d{1,4})?$/u);
export const quoteDraftInput = z.object({
  locale:z.enum(["fr","ar"]),rfqProviderId:quoteUuid,currency:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/u),solutionFr:z.string().trim().min(3).max(12000),solutionAr:z.string().trim().max(12000),deliverables:z.string().trim().min(2).max(6000),inclusions:z.string().max(6000),exclusions:z.string().max(6000),prerequisites:z.string().max(6000),warrantyFr:z.string().trim().min(3).max(2000),warrantyAr:z.string().trim().max(2000),correctionTermsFr:z.string().trim().min(3).max(2000),correctionTermsAr:z.string().trim().max(2000),proposedStartDate:z.string().date(),durationDays:z.coerce.number().int().min(1).max(3650),validUntil:z.string().datetime(),lineLabelFr:z.string().trim().min(2).max(500),lineLabelAr:z.string().trim().max(500),quantity:exactQuantity,unitCode:z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{0,31}$/u),unitPriceMinor:exactMinor,taxRuleVersionId:quoteUuid,itemKind:z.enum(["ONE_TIME","RECURRING"]),recurrenceInterval:z.enum(["","MONTH","QUARTER","YEAR"]),changeReason:z.string().trim().min(3).max(1000),idempotencyKey:quoteUuid,correlationId:quoteUuid,
}).superRefine((value,context)=>{if((value.itemKind==="RECURRING")!==(value.recurrenceInterval!==""))context.addIssue({code:"custom",path:["recurrenceInterval"],message:"RECURRENCE_MISMATCH"});if(Date.parse(value.validUntil)<=Date.now())context.addIssue({code:"custom",path:["validUntil"],message:"VALIDITY_EXPIRED"});});
export const invitationDecisionInput=z.object({locale:z.enum(["fr","ar"]),invitationId:quoteUuid,decision:z.enum(["ACCEPT","DECLINE"]),reason:z.string().trim().max(500),rowVersion:z.coerce.number().int().positive(),idempotencyKey:quoteUuid,correlationId:quoteUuid}).superRefine((v,c)=>{if(v.decision==="DECLINE"&&v.reason.length<3)c.addIssue({code:"custom",path:["reason"],message:"REASON_REQUIRED"});});
export const submitQuoteInput=z.object({locale:z.enum(["fr","ar"]),quoteId:quoteUuid,quoteVersionId:quoteUuid,idempotencyKey:quoteUuid,correlationId:quoteUuid});
export const submitQuoteIdentityInput=submitQuoteInput.extend({expectedIdentityHash:z.string().regex(/^[0-9a-f]{64}$/u),registeredAddress:z.string().trim().min(5).max(1000),confirmed:z.literal("yes")});
export const lines=(value:string)=>value.split(/\r?\n/u).map(item=>item.trim()).filter(Boolean).slice(0,100);export function formatBasisPointsExact(value:number):string{if(!Number.isInteger(value)||value<0)throw new Error("INVALID_BASIS_POINTS");const digits=String(value).padStart(3,"0"),whole=digits.slice(0,-2),fraction=digits.slice(-2).replace(/0+$/u,"");return fraction?`${whole}.${fraction}`:whole;}
export type ProviderTaxRule={id:string;category:string;rateBasisPoints:number;effectiveFrom:string;effectiveTo:string|null};
export function isTaxRuleApplicable(rule:ProviderTaxRule,effectiveOn:string):boolean{return /^\d{4}-\d{2}-\d{2}$/u.test(effectiveOn)&&rule.effectiveFrom<=effectiveOn&&(rule.effectiveTo===null||rule.effectiveTo>=effectiveOn);}
export function taxRulesForCategory(rules:ProviderTaxRule[],category:string|null):ProviderTaxRule[]{return category!==null&&/^[A-Z][A-Z0-9_]{2,79}$/u.test(category)?rules.filter(rule=>rule.category===category):[];}
export type ConsultationPackDocument = { id?: string; title: string; type?: string; size?: string };
export type ConsultationPack = {
  objective: string | null;
  scope: string[];
  deliverables: string[];
  constraints: string[];
  documents: ConsultationPackDocument[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function textList(value: unknown): string[] {
  if (typeof value === "string") return lines(value).slice(0, 20);
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    const record = asRecord(item);
    if (!record) return [];
    const label = record.title ?? record.label ?? record.name ?? record.fr ?? record.text;
    return typeof label === "string" && label.trim() ? [label.trim()] : [];
  }).slice(0, 20);
}

export function formatDeclaredBytes(bytes: number): string {
  if (!Number.isInteger(bytes) || bytes < 1) throw new Error("INVALID_DECLARED_BYTES");
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1048576) return `${Math.trunc(bytes / 1024)} Ko`;
  const whole = Math.trunc(bytes / 1048576);
  const tenth = Math.trunc(((bytes % 1048576) * 10) / 1048576);
  return tenth === 0 ? `${whole} Mo` : `${whole},${tenth} Mo`;
}

function declaredByteLabel(value: unknown): string | undefined {
  if (typeof value === "number") {
    try { return formatDeclaredBytes(value); } catch { return undefined; }
  }
  if (typeof value === "string" && /^\d{1,12}$/u.test(value)) {
    try { return formatDeclaredBytes(Number(value)); } catch { return undefined; }
  }
  return undefined;
}

function documentId(value: unknown): string | undefined {
  return typeof value === "string" && quoteUuid.safeParse(value).success ? value : undefined;
}

function documentList(value: unknown): ConsultationPackDocument[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [{ title: item.trim() }] : [];
    const record = asRecord(item);
    if (!record) return [];
    const title = record.title ?? record.name ?? record.label ?? record.filename ?? record.original_file_name;
    if (typeof title !== "string" || !title.trim()) return [];
    const type = typeof record.type === "string" ? record.type : typeof record.kind === "string" ? record.kind : typeof record.file_extension === "string" ? record.file_extension.toUpperCase() : undefined;
    const size = typeof record.size === "string"
      ? record.size
      : typeof record.sizeLabel === "string"
        ? record.sizeLabel
        : declaredByteLabel(record.size_bytes ?? record.declared_size_bytes);
    const id = documentId(record.id ?? record.document_id ?? record.documentId);
    return [{ ...(id ? { id } : {}), title: title.trim(), type, size }];
  }).slice(0, 20);
}

export function mergeConsultationDocuments(listed: ConsultationPackDocument[], shared: ConsultationPackDocument[]): ConsultationPackDocument[] {
  const byId = new Map<string, ConsultationPackDocument>();
  const untitled: ConsultationPackDocument[] = [];
  for (const document of [...listed, ...shared]) {
    if (document.id) byId.set(document.id, { ...byId.get(document.id), ...document });
    else untitled.push(document);
  }
  return [...byId.values(), ...untitled].slice(0, 20);
}

export function consultationDocumentHref(invitationId: string, documentId: string): string | null {
  if (!quoteUuid.safeParse(invitationId).success || !quoteUuid.safeParse(documentId).success) return null;
  return `/api/provider/consultations/${invitationId}/documents/${documentId}`;
}

export function consultationPackFromQuoteData(data: Record<string, unknown>): ConsultationPack {
  const objectiveRaw = data.objective ?? data.objectif ?? data.project_objective ?? data.description;
  return {
    objective: typeof objectiveRaw === "string" && objectiveRaw.trim() ? objectiveRaw.trim() : null,
    scope: textList(data.scope ?? data.perimetre ?? data.lots),
    deliverables: textList(data.deliverables ?? data.livrables),
    constraints: textList(data.constraints ?? data.contraintes),
    documents: documentList(data.documents ?? data.attachments ?? data.files ?? data.shared_documents),
  };
}

export type ProviderQuoteInvitation = {
  id: string;
  status: "INVITED" | "VIEWED" | "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "SUSPENDED";
  rowVersion: number;
  rfqId: string;
  deadline: string;
  deadlineLabels?:Record<"fr"|"ar",string>;
  requestId: string;
  description: string;
  regionCode: string;
  currency: string;
  taxCategoryCode: string | null;
  pack?: ConsultationPack;
  adminConsultation?:{subject:string;context:string;responseDeadline:string;channel:"platform"}|null;
  quote: null | { selectedVersionId?:string|null;identityAnchored?:boolean;id: string; status: string; currentVersionId: string | null; versionNumber: number | null; currency: string | null; subtotalMinor: string | null; taxMinor: string | null; totalMinor: string | null; validUntil?: string | null; createdAt?: string | null };
};

export type ProviderQuoteIdentityReview={publicationAllowed?:boolean;publicationBlockReason?:string|null;canonicalRegisteredAddress?:string|null;verified:boolean;identityHash:string;reviewId:string|null;legalName:string;ice:string|null};
export type ProviderQuoteDashboard = {
  identityReview?:ProviderQuoteIdentityReview;
  organizations: { id: string; name: string }[];
  organizationId: string;
  organizationName: string;
  canManage: boolean;
  taxRules: ProviderTaxRule[];
  invitations: ProviderQuoteInvitation[];
};
