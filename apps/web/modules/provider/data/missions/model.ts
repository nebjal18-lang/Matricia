import type {ObligationRetirement} from "@/modules/shared/lib/contracts-missions/operational-scope";
import{formatSignedMinorLocalized}from"@/modules/shared/lib/commercial-documents/money";
import { z } from "zod";

const uuid = z.string().uuid();
const safeVersion = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const exactMinor = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)]).transform(String);
const secureLocation = z.string().trim().min(3).max(1000).refine((value) => {
  if (value.includes("..") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return false;
  if (/^https:\/\//i.test(value)) {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9/_\-.]+$/.test(value) && !value.startsWith("/");
}, "INVALID_PROOF_LOCATION");

export const deliverySubmissionSchema = z.object({
  deliverableId: uuid,
  description: z.string().trim().min(3).max(4000),
  linksText: z.string().max(6000).default(""),
  proofType: z.enum(["DOCUMENT", "IMAGE", "URL", "CHECKLIST", "OTHER"]),
  proofLocation: secureLocation,
  evidenceHash: z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/),
  proofNote: z.string().trim().max(500).default(""),
  idempotencyKey: uuid,
}).transform((value, context) => {
  const links = value.linksText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  if (links.length > 10 || links.some((item) => { try { return new URL(item).protocol !== "https:"; } catch { return true; } })) {
    context.addIssue({ code: "custom", path: ["linksText"], message: "INVALID_HTTPS_LINKS" });
    return z.NEVER;
  }
  return { ...value, links };
});

export const milestoneSubmissionSchema = z.object({
  milestoneId: uuid,
  expectedRowVersion: z.coerce.number().int().positive(),
  correctionReason: z.string().trim().max(2000).refine(value=>value===""||value.length>=3).default(""),
  idempotencyKey: uuid,
});

export const checklistCompletionSchema = z.object({
  itemId: uuid,
  expectedStatus: z.literal("PENDING"),
  proofId: z.union([uuid, z.literal("")]),
  idempotencyKey: uuid,
});

export type ProviderMissionDashboard = {
  listPage?:number;
  hasMoreMissions?:boolean;
  organizationId: string;
  organizationName: string;
  canManageAssignments?:boolean;
  canOperate?:boolean;
  counts?:{activeMissions:number|null;deliverablesDue:number|null};
  countsReadState?:"SUCCESS"|"UNAVAILABLE";
  technicianOptions?:Array<{userId:string;displayName:string}>;
  missions: Array<{
    signedScopePending?:boolean;scopeReconciliationRequired?:boolean;id: string; title?:string;canOperate?:boolean;contractId: string; status: string; startedAt: string | null; completedAt: string | null;
    assignments?:Array<{userId:string;assignedAt:string}>;
    contract: { currentVersion: number; priceMinor: string; currency: string; contentHash: string } | null;
    milestones: Array<{ retired?:boolean;id: string; key: string; title: string; status: string; dueAt: string | null; dueAtLabel?:string|null;rowVersion: number;decisions?:Array<{decision:string;reason:string;decidedAt:string}>;corrections?:Array<{reason:string;submittedAt:string}> }>;
    checklistItems: Array<{ retired?:boolean;id:string; key:string; label:string; instructions:string|null; proofRequired:boolean; allowedProofTypes:string[]; status:string; templateVersion:number|null; templateHash:string|null; proofOptions:Array<{id:string;type:string}> }>;
    deliverables: Array<{ retirement?:ObligationRetirement;contractualKey?:string;sourceContractVersionId?:string|null;scopeGeneration?:number;id:string; key:string; label:string; proofRequired:boolean; status:string; currentVersion:number; versions:Array<{id:string;version:number;description:string;submittedAt:string;contentHash:string;proofCount:number;proofScanStatus:"NONE"|"PENDING"|"CLEAN"|"INFECTED"|"ERROR";links?:string[];proofs?:Array<{id:string;type:string;scanStatus:string;label:string}>;criteria?:Array<{key:string;label?:string;status:string;comment:string|null;decidedAt:string|null}>}> }>;
  }>;
};

export const providerMissionRows = {
  membership: z.object({ organization_id: uuid, organizations: z.object({ display_name: z.string().min(1) }),organization_member_roles:z.array(z.object({role_code:z.string(),revoked_at:z.string().nullable()})).optional() }),
  mission: z.object({ id: uuid, contract_id: uuid, contract_version_id:uuid, scope_reconciliation_required:z.boolean(), status: z.string(), started_at: z.string().nullable(), completed_at: z.string().nullable() }),
  milestone: z.object({ id: uuid, mission_id: uuid, milestone_key: z.string(), title_fr: z.string(), title_ar: z.string(), status: z.string(), due_at: z.string().nullable(), row_version: z.number().int().positive() }),
  deliverable: z.object({ id: uuid, mission_id: uuid, deliverable_key: z.string(), contractual_key:z.string().nullable(), source_contract_version_id:uuid.nullable(), scope_generation:z.number().int().positive(), label_fr: z.string(), label_ar: z.string(), proof_required: z.boolean(), status: z.string(), current_version: safeVersion }),
  version: z.object({ id: uuid, deliverable_id: uuid, version: safeVersion, description: z.string(), submitted_at: z.string(), content_hash: z.string().regex(/^[0-9a-f]{64}$/), links:z.array(z.string()).default([]) }),
  proof: z.object({ id:uuid, delivery_version_id: uuid, proof_type:z.string(), scan_status: z.enum(["PENDING","CLEAN","INFECTED","ERROR"]), metadata:z.object({original_file_name:z.string().optional()}).passthrough().optional() }),
  checklist: z.object({ id:uuid, mission_id:uuid, milestone_id:uuid.nullable(), item_key:z.string(), label_fr:z.string(), label_ar:z.string(), instructions_fr:z.string().nullable(), instructions_ar:z.string().nullable(), proof_required:z.boolean(), allowed_proof_types:z.array(z.string()), status:z.string(), checklist_snapshot_id:uuid.nullable() }),
  checklistSnapshot: z.object({ id:uuid, mission_id:uuid, template_version:z.number().int().positive(), template_content_hash:z.string().regex(/^[0-9a-f]{64}$/) }),
  contract: z.object({ id: uuid, current_version: z.number().int().positive() }),
  contractVersion: z.object({ id:uuid, contract_id: uuid, version: z.number().int().positive(), price_minor: exactMinor, currency: z.string().regex(/^[A-Z]{3}$/), content_hash: z.string().regex(/^[0-9a-f]{64}$/),request_snapshot:z.record(z.string(),z.unknown()).optional() }),
};

export function formatExactMinor(value:string,currency:string,locale:"fr"|"ar"){return formatSignedMinorLocalized(value,currency,locale);}
