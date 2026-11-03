"use server";

import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { isLocale, type Locale } from "@/modules/shared/lib/i18n/locale";

const uuidSchema = z.string().uuid();
const totpCodeSchema = z.string().regex(/^\d{6}$/);
const factorSchema = z.object({
  id: uuidSchema,
  factor_type: z.string(),
  friendly_name: z.string().nullable().optional(),
  status: z.enum(["verified", "unverified"]),
  created_at: z.string(),
});
const requirementSchema = z.object({
  mfa_required: z.boolean(),
  password_allowed: z.boolean(),
  current_aal: z.enum(["aal1", "aal2"]),
  requirement_satisfied: z.boolean(),
  matched_role_codes: z.array(z.string()),
});
const enrollmentSchema = z.object({
  id: uuidSchema,
  totp: z.object({
    qr_code: z.string().startsWith("data:image/svg+xml").max(200_000),
    secret: z.string().regex(/^[A-Z2-7]+=*$/i).min(16).max(128),
  }),
});
const passwordSchema = z.object({
  password: z.string().min(12).max(72)
    .regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  confirmation: z.string(),
  nonce: totpCodeSchema,
}).refine((value) => value.password === value.confirmation, { path: ["confirmation"] });

export type SafeMfaFactor = {
  id: string;
  friendlyName: string;
  status: "verified" | "unverified";
  createdAt: string;
};
export type AccountSecurityResult =
  | {
      status: "success";
      factors: SafeMfaFactor[];
      mfaRequired: boolean;
      passwordAllowed: boolean;
      currentAal: "aal1" | "aal2";
      requirementSatisfied: boolean;
      matchedRoleCodes: string[];
    }
  | { status: "error"; reason: "UNAUTHENTICATED" | "UNAVAILABLE" };
export type EnrollmentState =
  | { status: "idle" }
  | { status: "enrollment"; factorId: string; qrCode: string; secret: string }
  | { status: "success"; nextPath?: string }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FACTOR_LIMIT" | "AUDIT_PENDING" | "UNAVAILABLE" };
export type PasswordState =
  | { status: "idle" }
  | { status: "nonce_sent" }
  | { status: "success" }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "PASSWORD_FORBIDDEN" | "AUDIT_PENDING" | "UNAVAILABLE" };
export type UnenrollState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "AAL2_REQUIRED" | "MFA_REQUIRED" | "AUDIT_PENDING" | "UNAVAILABLE" };

function routeLocale(value: FormDataEntryValue | null): Locale {
  return typeof value === "string" && isLocale(value) ? value : "fr";
}

async function authenticatedClient() {
  const supabase = await getSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : { supabase, user };
}

async function recordSecurityEvent(userId: string, action: string, resourceId: string) {
  const admin = getSupabaseAdminClient();
  return admin.rpc("record_account_security_event", {
    p_actor_user_id: userId,
    p_action: action,
    p_resource_id: resourceId,
    p_correlation_id: randomUUID(),
  });
}

async function beginAuditedSecurityChange(
  userId: string,
  requestedAction: string,
  successAction: string,
  resourceId: string,
) {
  const operationId = randomUUID();
  const admin = getSupabaseAdminClient();
  const result = await admin.rpc("begin_account_security_change", {
    p_operation_id: operationId,
    p_actor_user_id: userId,
    p_requested_action: requestedAction,
    p_success_action: successAction,
    p_resource_id: resourceId,
  });
  return result.error ? null : operationId;
}

async function completeAuditedSecurityChange(operationId: string) {
  const admin = getSupabaseAdminClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await admin.rpc("complete_account_security_change", {
      p_operation_id: operationId,
    });
    if (!result.error) return true;
  }
  return false;
}

export async function getAccountSecurity(): Promise<AccountSecurityResult> {
  const context = await authenticatedClient();
  if (!context) return { status: "error", reason: "UNAUTHENTICATED" };
  const [factorsResult, requirementResult] = await Promise.all([
    context.supabase.auth.mfa.listFactors(),
    context.supabase.rpc("get_my_account_security_requirement"),
  ]);
  if (factorsResult.error || requirementResult.error) return { status: "error", reason: "UNAVAILABLE" };
  const factors = z.array(factorSchema).safeParse(factorsResult.data?.all ?? []);
  const requirements = z.array(requirementSchema).safeParse(requirementResult.data);
  if (!factors.success || !requirements.success || requirements.data.length !== 1) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const requirement = requirements.data[0]!;
  return {
    status: "success",
    factors: factors.data
      .filter((factor) => factor.factor_type === "totp")
      .map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name?.slice(0, 80) || "Matricia TOTP",
        status: factor.status,
        createdAt: factor.created_at,
      })),
    mfaRequired: requirement.mfa_required,
    passwordAllowed: requirement.password_allowed,
    currentAal: requirement.current_aal,
    requirementSatisfied: requirement.requirement_satisfied,
    matchedRoleCodes: requirement.matched_role_codes,
  };
}

export async function beginTotpEnrollment(
  _previousState: EnrollmentState,
  _formData: FormData,
): Promise<EnrollmentState> {
  void _previousState;
  void _formData;
  const context = await authenticatedClient();
  if (!context) return { status: "error", reason: "UNAUTHENTICATED" };
  const current = await context.supabase.auth.mfa.listFactors();
  if (current.error) return { status: "error", reason: "UNAVAILABLE" };
  if ((current.data?.totp.filter((factor) => factor.status === "verified").length ?? 0) >= 3) {
    return { status: "error", reason: "FACTOR_LIMIT" };
  }
  const requested = await recordSecurityEvent(
    context.user.id,
    "identity.mfa.enrollment.requested",
    "totp",
  );
  if (requested.error) return { status: "error", reason: "UNAVAILABLE" };
  const result = await context.supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Matricia Authenticator",
  });
  const parsed = enrollmentSchema.safeParse(result.data);
  if (result.error || !parsed.success) return { status: "error", reason: "UNAVAILABLE" };
  return {
    status: "enrollment",
    factorId: parsed.data.id,
    qrCode: parsed.data.totp.qr_code,
    secret: parsed.data.totp.secret,
  };
}

export async function verifyTotpEnrollment(
  _previousState: EnrollmentState,
  formData: FormData,
): Promise<EnrollmentState> {
  const factorId = uuidSchema.safeParse(formData.get("factorId"));
  const code = totpCodeSchema.safeParse(formData.get("code"));
  const locale = routeLocale(formData.get("locale"));
  if (!factorId.success || !code.success) return { status: "error", reason: "VALIDATION" };
  const context = await authenticatedClient();
  if (!context) return { status: "error", reason: "UNAUTHENTICATED" };
  const operationId = await beginAuditedSecurityChange(
    context.user.id,
    "identity.mfa.verification.requested",
    "identity.mfa.enrolled",
    factorId.data,
  );
  if (!operationId) return { status: "error", reason: "UNAVAILABLE" };
  const verified = await context.supabase.auth.mfa.challengeAndVerify({
    factorId: factorId.data,
    code: code.data,
  });
  if (verified.error) return { status: "error", reason: "VALIDATION" };
  const assurance = await context.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2") return { status: "error", reason: "UNAVAILABLE" };
  const audited = await completeAuditedSecurityChange(operationId);
  if (!audited) return { status: "error", reason: "AUDIT_PENDING" };
  revalidatePath(`/${locale}/securite/compte`);
  const nextPath = safeReturnPath(formData.get("next"),locale);
  return { status: "success", ...(nextPath ? { nextPath } : {}) };
}

export async function requestPasswordNonce(
  _previousState: PasswordState,
  _formData: FormData,
): Promise<PasswordState> {
  void _previousState;
  void _formData;
  const context = await authenticatedClient();
  if (!context) return { status: "error", reason: "UNAUTHENTICATED" };
  const requested = await recordSecurityEvent(
    context.user.id,
    "identity.password.change.requested",
    "password",
  );
  if (requested.error) return { status: "error", reason: "UNAVAILABLE" };
  const { error } = await context.supabase.auth.reauthenticate();
  return error ? { status: "error", reason: "UNAVAILABLE" } : { status: "nonce_sent" };
}

export async function setOptionalPassword(
  _previousState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
    nonce: formData.get("nonce"),
  });
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  const context = await authenticatedClient();
  if (!context) return { status: "error", reason: "UNAUTHENTICATED" };
  const requirementResult = await context.supabase.rpc("get_my_account_security_requirement");
  const requirements = z.array(requirementSchema).safeParse(requirementResult.data);
  if (requirementResult.error || !requirements.success || requirements.data.length !== 1) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  if (!requirements.data[0]!.password_allowed) {
    return { status: "error", reason: "PASSWORD_FORBIDDEN" };
  }
  const operationId = await beginAuditedSecurityChange(
    context.user.id,
    "identity.password.change.requested",
    "identity.password.updated",
    "password-update",
  );
  if (!operationId) return { status: "error", reason: "UNAVAILABLE" };
  const { error } = await context.supabase.auth.updateUser({
    password: parsed.data.password,
    nonce: parsed.data.nonce,
  });
  if (error) return { status: "error", reason: "VALIDATION" };
  const audited = await completeAuditedSecurityChange(operationId);
  if (!audited) return { status: "error", reason: "AUDIT_PENDING" };
  return { status: "success" };
}

export async function unenrollTotp(
  _previousState: UnenrollState,
  formData: FormData,
): Promise<UnenrollState> {
  const factorId = uuidSchema.safeParse(formData.get("factorId"));
  const locale = routeLocale(formData.get("locale"));
  if (!factorId.success || formData.get("confirmed") !== "yes") {
    return { status: "error", reason: "VALIDATION" };
  }
  const context = await authenticatedClient();
  if (!context) return { status: "error", reason: "UNAUTHENTICATED" };
  const [aal, factorsResult, requirementResult] = await Promise.all([
    context.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    context.supabase.auth.mfa.listFactors(),
    context.supabase.rpc("get_my_account_security_requirement"),
  ]);
  const requirements = z.array(requirementSchema).safeParse(requirementResult.data);
  if (aal.error || factorsResult.error || requirementResult.error || !requirements.success || requirements.data.length !== 1) {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  if (aal.data.currentLevel !== "aal2") return { status: "error", reason: "AAL2_REQUIRED" };
  const verifiedFactors = factorsResult.data?.totp.filter((factor) => factor.status === "verified") ?? [];
  if (requirements.data[0]!.mfa_required && verifiedFactors.length <= 1) {
    return { status: "error", reason: "MFA_REQUIRED" };
  }
  const operationId = await beginAuditedSecurityChange(
    context.user.id,
    "identity.mfa.unenrollment.requested",
    "identity.mfa.unenrolled",
    factorId.data,
  );
  if (!operationId) return { status: "error", reason: "UNAVAILABLE" };
  const result = await context.supabase.auth.mfa.unenroll({ factorId: factorId.data });
  if (result.error) return { status: "error", reason: "UNAVAILABLE" };
  const audited = await completeAuditedSecurityChange(operationId);
  if (!audited) return { status: "error", reason: "AUDIT_PENDING" };
  revalidatePath(`/${locale}/securite/compte`);
  return { status: "success" };
}
