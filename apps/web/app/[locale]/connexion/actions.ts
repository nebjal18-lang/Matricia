"use server";
import { ensureCurrentConsentDocuments } from "@/modules/shared/lib/auth/consent/current-documents";

import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { authorizedReturnPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { readWorkspaceNavigation } from "@/modules/shared/lib/auth/workspace-navigation-server";
import { z } from "zod";
import { cookies } from "next/headers";
import { isCurrentLegalConsent, TERMS_VERSION, PRIVACY_VERSION } from "@/modules/shared/lib/auth/legal-consent";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { headers } from "next/headers";
import { normalizeEmail } from "@/modules/shared/lib/auth/otp";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";

export type OtpRequestResult = { accepted: true } | { accepted: false; reason: "INVALID_EMAIL" | "RATE_LIMITED" | "CONSENT_REQUIRED" | "UNAVAILABLE" };

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

  if (isRegistration) {
    try { await ensureCurrentConsentDocuments(locale); } catch { return { accepted:false,reason:"UNAVAILABLE" }; }
    const receipt = await admin.rpc("reserve_registration_consent", { p_email: email, p_locale: locale, p_terms_version: TERMS_VERSION, p_privacy_version: PRIVACY_VERSION });
    if (receipt.error || typeof receipt.data !== "string") return { accepted: false, reason: "UNAVAILABLE" };
    (await cookies()).set("matricia.registration-consent", receipt.data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 1800 });
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

  if (deliveryError && deliveryError.code !== "user_not_found") return { accepted: false, reason: "UNAVAILABLE" };
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
  const [assurance, policy] = await Promise.all([client.auth.mfa.getAuthenticatorAssuranceLevel(),client.rpc("get_my_account_security_requirement")]);
  const requirements = z.array(z.object({ mfa_required: z.boolean(), current_aal: z.enum(["aal1","aal2"]), requirement_satisfied: z.boolean() }).passthrough()).length(1).safeParse(policy.data);
  const needsChallenge = navigation.status === "error" || !navigation.requirementSatisfied || assurance.error || policy.error || !requirements.success || !requirements.data[0]!.requirement_satisfied || (assurance.data?.currentLevel !== "aal2" && (assurance.data?.nextLevel === "aal2" || requirements.data[0]!.mfa_required));
  return needsChallenge ? `/${locale}/securite/compte?${new URLSearchParams({ next: target })}` : target;
}
