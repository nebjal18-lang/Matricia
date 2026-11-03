"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decideFranchiseMandate } from "@/modules/franchise/data/candidature/mandate-decision";
import { parseMoneyToMinor } from "@/modules/provider/screens/devis/money";
import { moroccoRegions } from "@/modules/shared/lib/geo/morocco-regions";
import { deliverNotification } from "@/modules/shared/lib/notification-delivery/adapter";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const uuid = z.string().uuid();
export type FranchiseApplicationReviewState =
  | { status: "idle" }
  | { status: "success"; mailed?: boolean }
  | { status: "error"; reason: "VALIDATION" | "DENIED" | "CONFLICT" | "MFA_REQUIRED" | "UNAVAILABLE" };

function reason(message: string): "VALIDATION" | "DENIED" | "CONFLICT" | "UNAVAILABLE" {
  if (message.includes("DENIED") || message.includes("42501")) return "DENIED";
  if (message.includes("STALE") || message.includes("40001") || message.includes("TRANSITION") || message.includes("NOT_PENDING")) return "CONFLICT";
  if (message.includes("INVALID") || message.includes("22023")) return "VALIDATION";
  return "UNAVAILABLE";
}
function refresh(locale: "fr" | "ar") {
  revalidatePath(`/${locale}/administration/candidatures-franchise`);
}

const applicationContactSchema = z.object({ reply_email: z.string().email(), locale: z.enum(["fr", "ar"]), territory_code: z.string() });

async function loadApplicationContact(applicationId: string) {
  const result = await (await getSupabaseServerClient()).from("franchise_applications").select("reply_email,locale,territory_code").eq("id", applicationId).maybeSingle();
  const parsed = applicationContactSchema.safeParse(result.data);
  return result.error || !parsed.success ? null : parsed.data;
}

function invitationCode() {
  const code = randomBytes(32).toString("base64url");
  return { code, hash: createHash("sha256").update(code, "utf8").digest("hex") };
}

async function mailInvitationCode(input: { applicationId: string; invitationId: string; code: string; reference: string; kind: "PROPOSED" | "ROTATED" | "APPROVED" }) {
  const contact = await loadApplicationContact(input.applicationId);
  if (!contact) return false;
  const ar = contact.locale === "ar";
  const path = `/${contact.locale}/franchise/invitations/${input.invitationId}`;
  const body = input.kind === "APPROVED"
    ? (ar
      ? `تمت الموافقة على تفويض الامتياز للملف ${input.reference}. سجّلوا الدخول بهذا العنوان لتفعيله باستعمال الرمز الخاص الذي توصلتم به.`
      : `Le mandat de franchise du dossier ${input.reference} est approuvé. Connectez-vous avec cette adresse pour l’activer avec le code privé déjà reçu.`)
    : (ar
      ? `اقترحت ماتريسيا تفويض امتياز للملف ${input.reference}. الرمز الخاص للتفعيل: ${input.code}\nيصبح التفعيل ممكناً بعد الموافقة المركزية. لا تشاركوا هذا الرمز.`
      : `Matricia vous propose un mandat de franchise pour le dossier ${input.reference}. Code privé d’activation : ${input.code}\nL’activation devient possible après l’approbation centrale. Ne partagez pas ce code.`);
  const delivery = await deliverNotification({
    deliveryId: randomUUID(),
    channel: "EMAIL",
    recipientEmail: contact.reply_email,
    locale: ar ? "ar-MA" : "fr-MA",
    subject: ar ? `تفويض امتياز ماتريسيا ${input.reference}` : `Mandat de franchise Matricia ${input.reference}`,
    body,
    ctaPath: path,
    providerIdempotencyKey: `franchise-invitation:${input.kind}:${input.invitationId}:${createHash("sha256").update(input.code || input.kind).digest("hex").slice(0, 16)}`,
  }, { env: process.env, fetch });
  return delivery.outcome === "SENT" || delivery.outcome === "DELIVERED";
}

export async function reviewFranchiseApplication(_: FranchiseApplicationReviewState, formData: FormData): Promise<FranchiseApplicationReviewState> {
  const parsed = z.object({
    locale: z.enum(["fr", "ar"]),
    applicationId: uuid,
    toStatus: z.enum(["COMPANY_REVIEW", "DOCUMENT_REVIEW", "CLOSED"]),
    reason: z.string().trim().min(3).max(1000),
    rowVersion: z.coerce.number().int().positive(),
  }).safeParse({
    locale: formData.get("locale"),
    applicationId: formData.get("applicationId"),
    toStatus: formData.get("toStatus"),
    reason: formData.get("reason"),
    rowVersion: formData.get("rowVersion"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const result = await client.rpc("review_franchise_application", {
    p_application_id: parsed.data.applicationId,
    p_to_status: parsed.data.toStatus,
    p_reason: parsed.data.reason,
    p_expected_row_version: parsed.data.rowVersion,
    p_idempotency_key: randomUUID(),
  });
  if (result.error) return { status: "error", reason: reason(result.error.message) };
  refresh(parsed.data.locale);
  return { status: "success" };
}

export async function linkFranchiseApplicationOrganization(_: FranchiseApplicationReviewState, formData: FormData): Promise<FranchiseApplicationReviewState> {
  const parsed = z.object({
    locale: z.enum(["fr", "ar"]),
    applicationId: uuid,
    organizationId: uuid,
    reason: z.string().trim().min(3).max(1000),
    rowVersion: z.coerce.number().int().positive(),
  }).safeParse({
    locale: formData.get("locale"),
    applicationId: formData.get("applicationId"),
    organizationId: formData.get("organizationId"),
    reason: formData.get("reason"),
    rowVersion: formData.get("rowVersion"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const result = await client.rpc("link_franchise_application_organization", {
    p_application_id: parsed.data.applicationId,
    p_organization_id: parsed.data.organizationId,
    p_reason: parsed.data.reason,
    p_expected_row_version: parsed.data.rowVersion,
    p_idempotency_key: randomUUID(),
  });
  if (result.error) return { status: "error", reason: reason(result.error.message) };
  refresh(parsed.data.locale);
  return { status: "success" };
}

export async function bindFranchiseApplicationMandate(_: FranchiseApplicationReviewState, formData: FormData): Promise<FranchiseApplicationReviewState> {
  const parsed = z.object({
    locale: z.enum(["fr", "ar"]),
    applicationId: uuid,
    franchiseId: uuid,
    reason: z.string().trim().min(3).max(1000),
    rowVersion: z.coerce.number().int().positive(),
  }).safeParse({
    locale: formData.get("locale"),
    applicationId: formData.get("applicationId"),
    franchiseId: formData.get("franchiseId"),
    reason: formData.get("reason"),
    rowVersion: formData.get("rowVersion"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const client = await getSupabaseServerClient();
  const result = await client.rpc("bind_franchise_application_mandate", {
    p_application_id: parsed.data.applicationId,
    p_franchise_id: parsed.data.franchiseId,
    p_reason: parsed.data.reason,
    p_expected_row_version: parsed.data.rowVersion,
    p_idempotency_key: randomUUID(),
  });
  if (result.error) return { status: "error", reason: reason(result.error.message) };
  refresh(parsed.data.locale);
  return { status: "success" };
}

const proposalSchema = z.object({
  locale: z.enum(["fr", "ar"]),
  applicationId: uuid,
  rowVersion: z.coerce.number().int().positive(),
  entryFee: z.string().trim().max(32),
  entryFeeMode: z.enum(["UPFRONT", "INSTALLMENT", "REVENUE_WITHHOLDING", "EXEMPT"]),
  entryFeeTermMonths: z.coerce.number().int().min(0).max(6),
  mandateTermMonths: z.coerce.number().int().min(12).max(120),
  specialConditions: z.string().trim().max(2000),
  reason: z.string().trim().min(3).max(1000),
  idempotencyKey: uuid,
});

export async function proposeFranchiseFromApplication(_: FranchiseApplicationReviewState, formData: FormData): Promise<FranchiseApplicationReviewState> {
  const parsed = proposalSchema.safeParse({
    locale: formData.get("locale"),
    applicationId: formData.get("applicationId"),
    rowVersion: formData.get("rowVersion"),
    entryFee: formData.get("entryFee") ?? "0",
    entryFeeMode: formData.get("entryFeeMode"),
    entryFeeTermMonths: formData.get("entryFeeTermMonths") ?? "0",
    mandateTermMonths: formData.get("mandateTermMonths"),
    specialConditions: formData.get("specialConditions") ?? "",
    reason: formData.get("reason"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const value = parsed.data;
  const feeMinor = value.entryFeeMode === "EXEMPT" ? "0" : parseMoneyToMinor(value.entryFee, "MAD");
  if (feeMinor === null) return { status: "error", reason: "VALIDATION" };
  const contact = await loadApplicationContact(value.applicationId);
  const region = contact ? moroccoRegions.find((item) => item.code === contact.territory_code) : undefined;
  if (!region) return { status: "error", reason: "UNAVAILABLE" };
  const token = invitationCode();
  const result = await (await getSupabaseServerClient()).rpc("propose_franchise_from_application", {
    p_application_id: value.applicationId,
    p_entry_fee_minor: feeMinor,
    p_entry_fee_mode: value.entryFeeMode,
    p_entry_fee_term_months: value.entryFeeTermMonths,
    p_mandate_term_months: value.mandateTermMonths,
    p_territory_name_fr: region.nameFr,
    p_territory_name_ar: region.nameAr,
    p_special_conditions: value.specialConditions,
    p_invitation_token_hash: token.hash,
    p_reason: value.reason,
    p_expected_row_version: value.rowVersion,
    p_idempotency_key: value.idempotencyKey,
  });
  if (result.error) return { status: "error", reason: reason(`${result.error.code ?? ""} ${result.error.message}`) };
  const proposed = z.object({ invitation_id: uuid, replayed: z.boolean() }).safeParse(result.data);
  if (!proposed.success) return { status: "error", reason: "UNAVAILABLE" };
  refresh(value.locale);
  if (proposed.data.replayed) return { status: "success" };
  const mailed = await mailInvitationCode({ applicationId: value.applicationId, invitationId: proposed.data.invitation_id, code: token.code, reference: value.applicationId.slice(0, 8).toUpperCase(), kind: "PROPOSED" });
  return { status: "success", mailed };
}

export async function resendFranchiseInvitationCode(_: FranchiseApplicationReviewState, formData: FormData): Promise<FranchiseApplicationReviewState> {
  const parsed = z.object({ locale: z.enum(["fr", "ar"]), applicationId: uuid, reason: z.string().trim().min(3).max(1000), idempotencyKey: uuid }).safeParse({
    locale: formData.get("locale"),
    applicationId: formData.get("applicationId"),
    reason: formData.get("reason"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const token = invitationCode();
  const result = await (await getSupabaseServerClient()).rpc("rotate_franchise_application_invitation_code", {
    p_application_id: parsed.data.applicationId,
    p_token_hash: token.hash,
    p_reason: parsed.data.reason,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) return { status: "error", reason: reason(`${result.error.code ?? ""} ${result.error.message}`) };
  const rotated = z.object({ invitation_id: uuid, replayed: z.boolean() }).safeParse(result.data);
  if (!rotated.success) return { status: "error", reason: "UNAVAILABLE" };
  refresh(parsed.data.locale);
  if (rotated.data.replayed) return { status: "success" };
  const mailed = await mailInvitationCode({ applicationId: parsed.data.applicationId, invitationId: rotated.data.invitation_id, code: token.code, reference: parsed.data.applicationId.slice(0, 8).toUpperCase(), kind: "ROTATED" });
  return { status: "success", mailed };
}

export async function decideFranchiseApplicationMandate(_: FranchiseApplicationReviewState, formData: FormData): Promise<FranchiseApplicationReviewState> {
  const parsed = z.object({ locale: z.enum(["fr", "ar"]), applicationId: uuid, invitationId: uuid, decision: z.enum(["APPROVE", "REJECT"]) }).safeParse({
    locale: formData.get("locale"),
    applicationId: formData.get("applicationId"),
    invitationId: formData.get("invitationId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const decided = await decideFranchiseMandate(formData);
  if (decided.status === "error") return { status: "error", reason: decided.reason };
  refresh(parsed.data.locale);
  if (decided.status !== "success" || parsed.data.decision !== "APPROVE") return { status: "success" };
  const mailed = await mailInvitationCode({ applicationId: parsed.data.applicationId, invitationId: parsed.data.invitationId, code: "", reference: parsed.data.applicationId.slice(0, 8).toUpperCase(), kind: "APPROVED" });
  return { status: "success", mailed };
}
