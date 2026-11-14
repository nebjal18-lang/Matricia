"use server";
import { ensureCurrentConsentDocuments } from "@/modules/shared/lib/auth/consent/current-documents";

import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { authorizedReturnPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { readWorkspaceNavigation } from "@/modules/shared/lib/auth/workspace-navigation-server";
import { cookies } from "next/headers";
import { isCurrentLegalConsent, TERMS_VERSION, PRIVACY_VERSION } from "@/modules/shared/lib/auth/legal-consent";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { headers } from "next/headers";
import { normalizeEmail, normalizeOtp } from "@/modules/shared/lib/auth/otp";
import type { EmailOtpLength } from "@/modules/shared/lib/auth/otp-config";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";

export type OtpRequestResult = { accepted: true } | { accepted: false; reason: "INVALID_EMAIL" | "RATE_LIMITED" | "CONSENT_REQUIRED" | "UNAVAILABLE" };
export type CompleteLoginResult =
  | { ok: true; destination: string }
  | { ok: false; reason: "INVALID" | "EXPIRED" | "CONSENT" | "UNAVAILABLE" };

function clientIp(headerStore: Headers): string | null {
  const candidate = headerStore.get("cf-connecting-ip") ?? headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!candidate || candidate.length > 45 || !/^[0-9a-f:.]+$/i.test(candidate)) return null;
  return candidate;
}

export async function requestOtp(emailInput: string, localeInput: string, _nextPathInput?: string, intentInput?: string, consentInput?: unknown): Promise<OtpRequestResult> {
  const email = normalizeEmail(emailInput);
  if (!email) return { accepted: false, reason: "INVALID_EMAIL" };
  const locale = isLocale(localeInput) ? localeInput : "fr";
  const isRegistration = intentInput === "registration";
  if (isRegistration && !isCurrentLegalConsent(consentInput)) return { accepted: false, reason: "CONSENT_REQUIRED" };
  const admin = getSupabaseAdminClient();
  const headerStore = await headers();
  const { data, error } = await admin.rpc("reserve_otp_request", {
    p_identifier: email,
    p_client_ip: clientIp(headerStore),
  });

  const quota = Array.isArray(data) ? data[0] : data;
  if (error || quota?.allowed !== true) {
    return quota?.allowed === false ? { accepted: false, reason: "RATE_LIMITED" } : { accepted: false, reason: "UNAVAILABLE" };
  }

  let consentReceipt: string | null = null;
  if (isRegistration) {
    try { await ensureCurrentConsentDocuments(locale); } catch { return { accepted:false,reason:"UNAVAILABLE" }; }
    const receipt = await admin.rpc("reserve_registration_consent", { p_email: email, p_locale: locale, p_terms_version: TERMS_VERSION, p_privacy_version: PRIVACY_VERSION });
    if (receipt.error || typeof receipt.data !== "string") return { accepted: false, reason: "UNAVAILABLE" };
    consentReceipt = receipt.data;
  }

  const { error: deliveryError } = await admin.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: isRegistration,
      ...(isRegistration ? { data: { locale } } : {}),
    },
  });
  if (deliveryError?.code === "over_email_send_rate_limit" || deliveryError?.status === 429) {
    return { accepted: false, reason: "RATE_LIMITED" };
  }

  // Login must not reveal whether the mailbox exists. Hosted GoTrue may return
  // otp_disabled / signup-disabled equivalents instead of user_not_found.
  if (
    !isRegistration
    && deliveryError
    && (deliveryError.code === "user_not_found"
      || deliveryError.code === "otp_disabled"
      || /signups?\s+not\s+allowed/i.test(deliveryError.message ?? ""))
  ) {
    return { accepted: true };
  }

  if (deliveryError) return { accepted: false, reason: "UNAVAILABLE" };
  // Persist the consent cookie only after OTP delivery succeeded — never before the send.
  if (consentReceipt) {
    (await cookies()).set("matricia.registration-consent", consentReceipt, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 1800 });
  }
  return { accepted: true };
}

export async function confirmRegistrationConsent(): Promise<boolean> {
  const store = await cookies();
  const receipt = store.get("matricia.registration-consent")?.value;
  if (!receipt) return false;
  const result = await (await getSupabaseServerClient()).rpc("confirm_registration_consent", { p_receipt_id: receipt });
  if (result.error) return false;
  store.delete("matricia.registration-consent");
  return true;
}

/** Verify email OTP on the server so session cookies are visible to post-login routing. */
export async function completeEmailLogin(
  emailInput: string,
  tokenInput: string,
  localeInput: string,
  nextPathInput?: string,
  intentInput?: string,
  otpLength: EmailOtpLength = 6,
): Promise<CompleteLoginResult> {
  const email = normalizeEmail(emailInput);
  const token = normalizeOtp(tokenInput, otpLength);
  const locale = isLocale(localeInput) ? localeInput : "fr";
  if (!email || !token) return { ok: false, reason: "INVALID" };
  const client = await getSupabaseServerClient();
  const { error } = await client.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { ok: false, reason: error.code === "otp_expired" ? "EXPIRED" : "INVALID" };
  }
  if (intentInput === "registration") {
    if (!(await confirmRegistrationConsent())) {
      await client.auth.signOut();
      return { ok: false, reason: "CONSENT" };
    }
  }
  return { ok: true, destination: await postLoginDestination(locale, nextPathInput) };
}

/** Verify password on the server so session cookies are visible to post-login routing. */
export async function completePasswordLogin(
  emailInput: string,
  passwordInput: string,
  localeInput: string,
  nextPathInput?: string,
): Promise<CompleteLoginResult> {
  const email = normalizeEmail(emailInput);
  const locale = isLocale(localeInput) ? localeInput : "fr";
  if (!email || passwordInput.length < 12 || passwordInput.length > 72) return { ok: false, reason: "INVALID" };
  const client = await getSupabaseServerClient();
  const { error } = await client.auth.signInWithPassword({ email, password: passwordInput });
  if (error) return { ok: false, reason: "INVALID" };
  return { ok: true, destination: await postLoginDestination(locale, nextPathInput) };
}

/** Resolve the next step from server-verified assurance and the role policy. */
export async function postLoginDestination(localeInput: string, requestedNext?: string): Promise<string> {
  const locale = isLocale(localeInput) ? localeInput : "fr";
  const requested = safeReturnPath(requestedNext, locale);
  let target = requested ?? `/${locale}/tableau-de-bord`;
  const client = await getSupabaseServerClient();
  if (!(await client.auth.getUser()).data.user) return `/${locale}/connexion?${new URLSearchParams({ next: target })}`;
  const navigation = await readWorkspaceNavigation(locale);
  if (navigation.status === "ok") {
    const allowed = navigation.navigation.options.map(option => option.kind);
    const authorized = authorizedReturnPath(requested, locale, allowed);
    const fallback = navigation.navigation.options.find(option => option.kind === navigation.navigation.landing)?.href ?? `/${locale}/tableau-de-bord`;
    target = authorized ?? fallback;
    const targetUrl = new URL(target, "https://matricia.invalid");
    const currentKind = navigation.navigation.options.find(option => option.kind === targetUrl.searchParams.get("workspace"))?.kind
      ?? (targetUrl.pathname.startsWith(`/${locale}/administration/`) ? allowed.find(kind => kind === "administration") : targetUrl.pathname.startsWith(`/${locale}/franchise/`) ? allowed.find(kind => kind === "franchise") : targetUrl.pathname.startsWith(`/${locale}/sous-traitant/`) ? allowed.find(kind => kind === "provider") : navigation.navigation.landing);
    if (currentKind) (await cookies()).set("matricia.workspace", currentKind, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
    if (requested && !authorized) {
      const url = new URL(target, "https://matricia.invalid");
      url.searchParams.set("navigation", "role-fallback");
      target = `${url.pathname}${url.search}`;
    }
  }
  // A navigation read failure is a technical incident — never pretend MFA is missing.
  if (navigation.status !== "ok") {
    if (navigation.reason === "UNAUTHENTICATED") {
      return connexionHref(locale, { next: target });
    }
    return `/${locale}/indisponible?${new URLSearchParams({ next: target })}`;
  }
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  // navigation already resolved get_my_account_security_requirement — do not call it twice.
  const needsChallenge = !navigation.requirementSatisfied || Boolean(assurance.error)
    || (assurance.data?.currentLevel !== "aal2" && assurance.data?.nextLevel === "aal2");
  return needsChallenge ? `/${locale}/securite/compte?${new URLSearchParams({ next: target })}` : target;
}
