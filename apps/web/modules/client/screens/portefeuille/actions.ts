"use server";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { code, locale, moneyToMinor, uuid } from "@/modules/client/data/portfolio/model";
import { portfolioRpc } from "@/modules/client/data/portfolio/server-repository";

export type State = { status: "idle" } | { status: "success" } | { status: "error"; reason: "VALIDATION" | "FORBIDDEN" | "UNAVAILABLE" };
const base = z.object({ locale, idempotencyKey: uuid });
const optionalUuid = z.union([z.literal(""), uuid]);
const nullable = (value: string) => value || null;
const field = (form: FormData, name: string) => String(form.get(name) ?? "");
async function execute(localeValue: "fr"|"ar", name: string, input: Record<string, unknown>): Promise<State> { const result = await portfolioRpc(name, input); if (result.status === "error") return { status: "error", reason: result.reason === "FORBIDDEN" ? "FORBIDDEN" : "UNAVAILABLE" }; revalidatePath(`/${localeValue}/client/portefeuille`); return { status: "success" }; }

const siteSchema = base.extend({
  organizationId: uuid,
  siteCode: code,
  nameFr: z.string().trim().min(2).max(160),
  nameAr: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(3).max(500),
  regionCode: z.union([z.literal(""), z.string().regex(/^[A-Z]{2}-[A-Z0-9_-]{1,37}$/u)]),
  changeReason: z.string().trim().min(3).max(500),
});
export async function createSite(_: State, form: FormData): Promise<State> {
  const p = siteSchema.safeParse(Object.fromEntries([...form.keys()].map((key) => [key, field(form, key)])));
  if (!p.success) return { status: "error", reason: "VALIDATION" };
  const address = { line: p.data.addressLine, city: p.data.city, region_code: p.data.regionCode || null, country: "MA" };
  return execute(p.data.locale, "create_client_site", {
    p_organization_id: p.data.organizationId,
    p_code: p.data.siteCode,
    p_name_fr: p.data.nameFr,
    p_name_ar: p.data.nameAr,
    p_address_snapshot: address,
    p_change_reason: p.data.changeReason,
    p_idempotency_key: p.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
}

const projectSchema = base.extend({ organizationId: uuid, projectCode: code, siteId: optionalUuid, nameFr: z.string().trim().min(2).max(200), nameAr: z.string().trim().min(2).max(200), descriptionFr: z.string().trim().min(3).max(4000), descriptionAr: z.string().trim().min(3).max(4000), startedOn: z.string(), targetEndOn: z.string(), changeReason: z.string().trim().min(3).max(500) });
export async function createProject(_: State, form: FormData): Promise<State> { const p=projectSchema.safeParse(Object.fromEntries([...form.keys()].map(key=>[key,field(form,key)]))); if(!p.success)return{status:"error",reason:"VALIDATION"}; if(p.data.startedOn&&p.data.targetEndOn&&p.data.targetEndOn<p.data.startedOn)return{status:"error",reason:"VALIDATION"}; return execute(p.data.locale,"create_client_project",{p_organization_id:p.data.organizationId,p_project_code:p.data.projectCode,p_site_id:nullable(p.data.siteId),p_name_fr:p.data.nameFr,p_name_ar:p.data.nameAr,p_description_fr:p.data.descriptionFr,p_description_ar:p.data.descriptionAr,p_objectives:[],p_scope_snapshot:{source:"CLIENT_PORTFOLIO_V1"},p_started_on:nullable(p.data.startedOn),p_target_end_on:nullable(p.data.targetEndOn),p_change_reason:p.data.changeReason,p_idempotency_key:p.data.idempotencyKey,p_correlation_id:randomUUID()}); }

const taskSchema=base.extend({projectId:uuid,taskKey:code,taskType:z.enum(["TASK","MILESTONE"]),status:z.enum(["PENDING","IN_PROGRESS","BLOCKED","SUBMITTED","ACCEPTED","CANCELLED"]),dueAt:z.string(),titleFr:z.string().trim().min(2).max(240),titleAr:z.string().trim().min(2).max(240),descriptionFr:z.string().max(4000),descriptionAr:z.string().max(4000),changeReason:z.string().trim().min(3).max(500)});
export async function saveTask(_:State,form:FormData):Promise<State>{const p=taskSchema.safeParse(Object.fromEntries([...form.keys()].map(key=>[key,field(form,key)])));if(!p.success)return{status:"error",reason:"VALIDATION"};return execute(p.data.locale,"save_client_project_task",{p_project_id:p.data.projectId,p_task_key:p.data.taskKey,p_task_type:p.data.taskType,p_status:p.data.status,p_due_at:nullable(p.data.dueAt),p_assignee_user_id:null,p_title_fr:p.data.titleFr,p_title_ar:p.data.titleAr,p_description_fr:p.data.descriptionFr||null,p_description_ar:p.data.descriptionAr||null,p_acceptance_criteria:[],p_change_reason:p.data.changeReason,p_expected_row_version:0,p_idempotency_key:p.data.idempotencyKey,p_correlation_id:randomUUID()});}

const budgetSchema=base.extend({organizationId:uuid,fiscalYear:z.coerce.number().int().min(2000).max(2200),currency:z.string().regex(/^[A-Z]{3}$/u),libraryId:optionalUuid,siteId:optionalUuid,projectId:optionalUuid,amount:z.string().trim().min(1).max(30),rationale:z.string().trim().min(3).max(2000),approve:z.enum(["yes","no"])});
export async function saveBudget(_:State,form:FormData):Promise<State>{const p=budgetSchema.safeParse(Object.fromEntries([...form.keys()].map(key=>[key,field(form,key)])));if(!p.success||(!p.data.libraryId&&!p.data.siteId&&!p.data.projectId))return{status:"error",reason:"VALIDATION"};const amount=moneyToMinor(p.data.amount);if(amount===null)return{status:"error",reason:"VALIDATION"};return execute(p.data.locale,"save_client_annual_budget",{p_organization_id:p.data.organizationId,p_fiscal_year:p.data.fiscalYear,p_currency:p.data.currency,p_library_id:nullable(p.data.libraryId),p_site_id:nullable(p.data.siteId),p_project_id:nullable(p.data.projectId),p_amount_minor:amount,p_rationale:p.data.rationale,p_assumptions:{source:"CLIENT_PORTFOLIO_V1"},p_approve:p.data.approve==="yes",p_idempotency_key:p.data.idempotencyKey,p_correlation_id:randomUUID()});}

const centerSchema=base.extend({organizationId:uuid,centerCode:code,nameFr:z.string().trim().min(2).max(160),nameAr:z.string().trim().min(2).max(160),changeReason:z.string().trim().min(3).max(500)});
export async function createCostCenter(_:State,form:FormData):Promise<State>{const p=centerSchema.safeParse(Object.fromEntries([...form.keys()].map(key=>[key,field(form,key)])));if(!p.success)return{status:"error",reason:"VALIDATION"};return execute(p.data.locale,"create_client_cost_center",{p_organization_id:p.data.organizationId,p_code:p.data.centerCode,p_name_fr:p.data.nameFr,p_name_ar:p.data.nameAr,p_manager_user_id:null,p_allocation_policy_snapshot:{version:"1.0",source:"CLIENT_PORTFOLIO_V1"},p_change_reason:p.data.changeReason,p_idempotency_key:p.data.idempotencyKey,p_correlation_id:randomUUID()});}

const allocationSchema = base.extend({
  organizationId: uuid, costCenterId: uuid, budgetId: uuid, projectId: optionalUuid,
  allocationType: z.enum(["COMMITMENT", "ACTUAL", "RELEASE"]),
  referenceChoice: z.union([z.literal("MANUAL"), z.string().regex(/^(PROJECT|PROJECT_TASK|CONTRACT|MISSION|MISSION_MILESTONE|INVOICE|DOCUMENT|RFQ):[0-9a-f-]{36}$/iu)]),
  amount: z.string().trim().min(1).max(30),
});

/** Evidence is hashed on the server; this action does not publish or archive the file. */
async function evidenceFingerprint(entry: FormDataEntryValue | null): Promise<string | null> {
  if (!(entry instanceof File) || entry.size < 1 || entry.size > 10 * 1024 * 1024) return null;
  if (!["application/pdf", "image/png", "image/jpeg"].includes(entry.type)) return null;
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const valid = entry.type === "application/pdf" ? new TextDecoder().decode(bytes.subarray(0, 5)) === "%PDF-"
    : entry.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  return valid ? createHash("sha256").update(bytes).digest("hex") : null;
}

export async function recordAllocation(_: State, form: FormData): Promise<State> {
  const p = allocationSchema.safeParse(Object.fromEntries([...form.keys()].map(key => [key, field(form, key)])));
  if (!p.success) return { status: "error", reason: "VALIDATION" };
  const [referenceType, referenceId = ""] = p.data.referenceChoice.split(":");
  if (referenceType !== "MANUAL" && !uuid.safeParse(referenceId).success) return { status: "error", reason: "VALIDATION" };
  const amount = moneyToMinor(p.data.amount);
  if (amount === null || BigInt(amount) <= BigInt(0)) return { status: "error", reason: "VALIDATION" };
  const evidenceHash = await evidenceFingerprint(form.get("evidenceFile"));
  if (!evidenceHash) return { status: "error", reason: "VALIDATION" };
  // The transactional RPC independently checks capabilities, organisation, and referenced object.
  return execute(p.data.locale, "record_client_typed_cost_allocation", {
    p_organization_id: p.data.organizationId, p_cost_center_id: p.data.costCenterId,
    p_budget_id: p.data.budgetId, p_project_id: nullable(p.data.projectId),
    p_allocation_type: p.data.allocationType, p_amount_minor: amount,
    p_reference_type: referenceType, p_reference_id: nullable(referenceId),
    p_evidence_hash: evidenceHash, p_idempotency_key: p.data.idempotencyKey, p_correlation_id: randomUUID(),
  });
}

const eventSchema=base.extend({organizationId:uuid,projectId:optionalUuid,eventType:z.enum(["CUSTOM","PROJECT_DEADLINE","APPROVAL","DOCUMENT","INVOICE","MISSION","RFQ"]),titleFr:z.string().trim().min(2).max(240),titleAr:z.string().trim().min(2).max(240),startsAt:z.string().datetime({local:true}),endsAt:z.string()});
export async function scheduleEvent(_:State,form:FormData):Promise<State>{const p=eventSchema.safeParse(Object.fromEntries([...form.keys()].map(key=>[key,field(form,key)])));if(!p.success||p.data.endsAt&&p.data.endsAt<p.data.startsAt)return{status:"error",reason:"VALIDATION"};return execute(p.data.locale,"schedule_client_calendar_event",{p_organization_id:p.data.organizationId,p_project_id:nullable(p.data.projectId),p_event_type:p.data.eventType,p_title_fr:p.data.titleFr,p_title_ar:p.data.titleAr,p_starts_at:new Date(p.data.startsAt).toISOString(),p_ends_at:p.data.endsAt?new Date(p.data.endsAt).toISOString():null,p_source_type:null,p_source_id:null,p_idempotency_key:p.data.idempotencyKey,p_correlation_id:randomUUID()});}

const contractLinkSchema=base.extend({projectId:uuid,contractId:uuid});
export async function linkContract(_:State,form:FormData):Promise<State>{const p=contractLinkSchema.safeParse(Object.fromEntries([...form.keys()].map(key=>[key,field(form,key)])));if(!p.success)return{status:"error",reason:"VALIDATION"};return execute(p.data.locale,"link_contract_to_client_project",{p_project_id:p.data.projectId,p_contract_id:p.data.contractId,p_idempotency_key:p.data.idempotencyKey,p_correlation_id:randomUUID()});}
