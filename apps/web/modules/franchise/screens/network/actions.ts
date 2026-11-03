"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prospectSchema } from "@/modules/franchise/data/crm/model";
import { parseFranchiseProviderCsv } from "@/modules/franchise/data/network/csv";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type FranchiseInviteState =
  | { status: "idle" }
  | { status: "success"; outcome: string; created: number }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "FAILED" };

const outcome = z.object({ outcome: z.string().min(3), prospect_id: z.string().uuid().optional() }).passthrough();
const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const iso = (value: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
};

async function rpc(name: string, args: Record<string, unknown>) {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error" as const, reason: "UNAUTHENTICATED" as const };
  const result = await client.rpc(name, args);
  if (result.error) {
    if (result.error.code === "42501") return { status: "error" as const, reason: "FORBIDDEN" as const };
    if (["40001", "23505", "23514"].includes(result.error.code ?? "") || /STALE|IDEMPOTENCY|TRANSITION/i.test(result.error.message ?? "")) {
      return { status: "error" as const, reason: "CONFLICT" as const };
    }
    return { status: "error" as const, reason: "FAILED" as const };
  }
  const parsed = outcome.safeParse(result.data);
  return parsed.success ? { status: "success" as const, data: parsed.data } : { status: "error" as const, reason: "FAILED" as const };
}

function localeValid(form: FormData) {
  return isLocale(text(form, "locale"));
}

function refresh(locale: string, organizationId: string) {
  const query = organizationId ? `?organizationId=${organizationId}` : "";
  revalidatePath(`/${locale}/franchise/fournisseurs`);
  revalidatePath(`/${locale}/franchise/reseau`);
  revalidatePath(`/${locale}/franchise/fournisseurs/inviter`);
  revalidatePath(`/${locale}/franchise/clients/inviter`);
  revalidatePath(`/${locale}/franchise/demandes`);
  revalidatePath(`/${locale}/franchise/documents`);
  revalidatePath(`/${locale}/franchise/messages`);
  revalidatePath(`/${locale}/franchise/notifications`);
  return query;
}

async function saveProspect(input: {
  locale: string;
  franchiseId: string;
  territoryVersionId: string;
  prospectType: "CLIENT" | "PROVIDER";
  displayName: string;
  contactEmail: string;
  organizationName: string;
  sourceCode: string;
  nextFollowupAt: string;
  ownerUserId: string;
  idempotencyKey: string;
}) {
  const saved = await rpc("save_franchise_prospect", {
    p_franchise_id: input.franchiseId,
    p_prospect_id: null,
    p_territory_version_id: input.territoryVersionId,
    p_prospect_type: input.prospectType,
    p_display_name: input.displayName,
    p_contact_email: input.contactEmail,
    p_organization_name: input.organizationName || null,
    p_source_code: input.sourceCode,
    p_next_followup_at: input.nextFollowupAt || null,
    p_owner_user_id: input.ownerUserId,
    p_expected_row_version: 0,
    p_idempotency_key: input.idempotencyKey,
  });
  if (saved.status !== "success" || !saved.data.prospect_id) return saved;
  const activity = await rpc("record_franchise_activity", {
    p_prospect_id: saved.data.prospect_id,
    p_activity_type: "INVITATION",
    p_occurred_at: new Date().toISOString(),
    p_summary: input.locale === "ar"
      ? (input.prospectType === "CLIENT" ? `تم إرسال دعوة عميل إلى ${input.contactEmail}` : `تم إرسال دعوة إلى ${input.contactEmail}`)
      : (input.prospectType === "CLIENT" ? `Invitation client envoyée à ${input.contactEmail}` : `Invitation envoyée à ${input.contactEmail}`),
    p_evidence_refs: [],
    p_next_followup_at: input.nextFollowupAt || null,
    p_idempotency_key: randomUUID(),
  });
  if (activity.status === "error" && activity.reason !== "CONFLICT") return activity;
  return saved;
}

function prospectType(form: FormData): "CLIENT" | "PROVIDER" {
  return text(form, "prospectType") === "CLIENT" ? "CLIENT" : "PROVIDER";
}

export async function inviteFranchiseProvider(_: FranchiseInviteState, form: FormData): Promise<FranchiseInviteState> {
  if (!localeValid(form)) return { status: "error", reason: "VALIDATION" };
  const type = prospectType(form);
  const parsed = prospectSchema.safeParse({
    franchiseId: text(form, "franchiseId"),
    territoryVersionId: text(form, "territoryVersionId"),
    prospectType: type,
    displayName: text(form, "displayName"),
    contactEmail: text(form, "contactEmail"),
    organizationName: text(form, "organizationName"),
    sourceCode: text(form, "sourceCode") || "INVITE",
    nextFollowupAt: iso(text(form, "nextFollowupAt")),
    ownerUserId: text(form, "ownerUserId"),
    idempotencyKey: text(form, "idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const saved = await saveProspect({ ...parsed.data, locale: text(form, "locale") });
  if (saved.status !== "success") return { status: "error", reason: saved.reason };
  refresh(text(form, "locale"), text(form, "organizationId"));
  return { status: "success", outcome: saved.data.outcome, created: 1 };
}

export async function importFranchiseProviders(_: FranchiseInviteState, form: FormData): Promise<FranchiseInviteState> {
  if (!localeValid(form)) return { status: "error", reason: "VALIDATION" };
  const type = prospectType(form);
  const identity = {
    franchiseId: text(form, "franchiseId"),
    territoryVersionId: text(form, "territoryVersionId"),
    ownerUserId: text(form, "ownerUserId"),
  };
  if (!z.string().uuid().safeParse(identity.franchiseId).success || !z.string().uuid().safeParse(identity.territoryVersionId).success || !z.string().uuid().safeParse(identity.ownerUserId).success) {
    return { status: "error", reason: "VALIDATION" };
  }
  const parsed = parseFranchiseProviderCsv(text(form, "csvText"));
  if (parsed.status !== "ok") return { status: "error", reason: "VALIDATION" };
  let created = 0;
  let lastOutcome = "FRANCHISE_PROSPECT_SAVED";
  for (const row of parsed.rows) {
    const saved = await saveProspect({
      locale: text(form, "locale"),
      ...identity,
      prospectType: type,
      displayName: row.displayName,
      contactEmail: row.contactEmail,
      organizationName: row.organizationName,
      sourceCode: "CSV_IMPORT",
      nextFollowupAt: "",
      idempotencyKey: randomUUID(),
    });
    if (saved.status === "error" && saved.reason === "CONFLICT") continue;
    if (saved.status !== "success") return { status: "error", reason: saved.reason };
    created += 1;
    lastOutcome = saved.data.outcome;
  }
  refresh(text(form, "locale"), text(form, "organizationId"));
  return { status: "success", outcome: lastOutcome, created };
}

export async function recordFranchiseFolderActivity(_: FranchiseInviteState, form: FormData): Promise<FranchiseInviteState> {
  if (!localeValid(form)) return { status: "error", reason: "VALIDATION" };
  const parsed = z.object({
    prospectId: z.string().uuid(),
    activityType: z.enum(["CALL", "EMAIL", "MEETING", "NOTE", "FOLLOW_UP", "INVITATION"]),
    occurredAt: z.string().datetime({ offset: true }),
    summary: z.string().trim().min(3).max(2000),
    evidenceReference: z.string().trim().max(500),
    nextFollowupAt: z.string().datetime({ offset: true }).or(z.literal("")),
    idempotencyKey: z.string().uuid(),
  }).safeParse({
    prospectId: text(form, "prospectId"),
    activityType: text(form, "activityType"),
    occurredAt: iso(text(form, "occurredAt")),
    summary: text(form, "summary"),
    evidenceReference: text(form, "evidenceReference"),
    nextFollowupAt: iso(text(form, "nextFollowupAt")),
    idempotencyKey: text(form, "idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const recorded = await rpc("record_franchise_activity", {
    p_prospect_id: parsed.data.prospectId,
    p_activity_type: parsed.data.activityType,
    p_occurred_at: parsed.data.occurredAt,
    p_summary: parsed.data.summary,
    p_evidence_refs: parsed.data.evidenceReference ? [{ reference: parsed.data.evidenceReference }] : [],
    p_next_followup_at: parsed.data.nextFollowupAt || null,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (recorded.status !== "success") return { status: "error", reason: recorded.reason };
  refresh(text(form, "locale"), text(form, "organizationId"));
  return { status: "success", outcome: recorded.data.outcome, created: 1 };
}

export async function advanceFranchiseFolderPipeline(_: FranchiseInviteState, form: FormData): Promise<FranchiseInviteState> {
  if (!localeValid(form)) return { status: "error", reason: "VALIDATION" };
  const parsed = z.object({
    prospectId: z.string().uuid(),
    toStage: z.enum(["SENT", "OPENED", "REGISTERED", "PROFILE_STARTED", "VERIFIED", "DIAGNOSTIC_STARTED", "OPPORTUNITY_CREATED", "RFQ_STARTED", "CONTRACT_SIGNED"]),
    reasonCode: z.string().trim().min(3).max(80).regex(/^[A-Z0-9_]+$/u),
    rowVersion: z.coerce.number().int().positive(),
    evidenceReference: z.string().trim().max(500),
    idempotencyKey: z.string().uuid(),
  }).safeParse({
    prospectId: text(form, "prospectId"),
    toStage: text(form, "toStage"),
    reasonCode: text(form, "reasonCode"),
    rowVersion: text(form, "rowVersion"),
    evidenceReference: text(form, "evidenceReference"),
    idempotencyKey: text(form, "idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const advanced = await rpc("advance_franchise_pipeline", {
    p_prospect_id: parsed.data.prospectId,
    p_to_stage: parsed.data.toStage,
    p_reason_code: parsed.data.reasonCode,
    p_evidence_refs: parsed.data.evidenceReference ? [{ reference: parsed.data.evidenceReference }] : [],
    p_expected_row_version: parsed.data.rowVersion,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (advanced.status !== "success") return { status: "error", reason: advanced.reason };
  refresh(text(form, "locale"), text(form, "organizationId"));
  return { status: "success", outcome: advanced.data.outcome, created: 1 };
}

export async function linkFranchiseProviderOrganization(_:FranchiseInviteState,form:FormData):Promise<FranchiseInviteState>{
 const input=z.object({locale:z.enum(["fr","ar"]),prospectId:z.string().uuid(),providerOrganizationId:z.string().uuid(),rowVersion:z.coerce.number().int().positive(),reason:z.string().trim().min(3).max(500),idempotencyKey:z.string().uuid()}).safeParse(Object.fromEntries(form));
 if(!input.success)return{status:"error",reason:"VALIDATION"};
 const v=input.data;const saved=await rpc("link_franchise_provider_organization",{p_prospect_id:v.prospectId,p_provider_organization_id:v.providerOrganizationId,p_expected_row_version:v.rowVersion,p_reason:v.reason,p_idempotency_key:v.idempotencyKey});
 if(saved.status!=="success")return{status:"error",reason:saved.reason};
 refresh(v.locale,text(form,"organizationId"));revalidatePath(`/${v.locale}/franchise/fournisseurs/${v.prospectId}`);
 return{status:"success",outcome:saved.data.outcome,created:0};
}
