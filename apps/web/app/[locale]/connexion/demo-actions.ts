"use server";

import { redirect } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { demoPersonaEmail, isPublicDemoAccessEnabled } from "./demo-policy";
import { demoPersonaHome, demoPersonaWorkspace, type DemoPersona } from "./demo-personas";
import { ensureDemoPersonaAuthorization } from "./demo-authorization";
import { findDemoRegionalActor } from "./demo-regional-directory";
import { ensureDemoRegionalActor } from "./demo-regional-ensure";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { postLoginDestination } from "./actions";
import { elevateDemoSession } from "./demo-assurance";

function parsePersona(value: FormDataEntryValue | null): DemoPersona | null {
  return value === "client" || value === "provider" || value === "franchise" || value === "admin" ? value : null;
}

export async function connectDemoPersona(formData: FormData): Promise<void> {
  const localeInput = formData.get("locale");
  const locale = typeof localeInput === "string" && isLocale(localeInput) ? localeInput : "fr";
  const persona = parsePersona(formData.get("persona"));
  const requestedNext = safeReturnPath(formData.get("next"), locale);
  const failure = (reason: string) => `/${locale}/connexion?${new URLSearchParams({ demo: reason, ...(requestedNext ? { next: requestedNext } : {}) })}`;
  if (!persona || !isPublicDemoAccessEnabled()) redirect(failure("disabled"));

  const email = demoPersonaEmail(persona);
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) redirect(failure("unavailable"));

  const supabase = await getSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  const userId = session?.user?.id;
  if (sessionError || !userId) redirect(failure("unavailable"));
  const elevated = await elevateDemoSession({ email, userId, supabase, admin });
  if (!elevated) redirect(failure("unavailable"));
  const authorized = await ensureDemoPersonaAuthorization({ persona, userId, admin });
  if (!authorized) redirect(failure("role-missing"));

  const destination = demoPersonaHome(persona, locale);
  const workspace = demoPersonaWorkspace(persona);
  const resolved = await postLoginDestination(locale, destination, workspace);
  if (resolved.includes("navigation=role-fallback") || (workspace === "administration" && !resolved.includes("/administration/"))) {
    redirect(failure("role-missing"));
  }
  redirect(resolved);
}

/** Connexion démo ciblée : franchisé / ST / client d’une région. */
export async function connectDemoRegionalActor(formData: FormData): Promise<void> {
  const localeInput = formData.get("locale");
  const locale = typeof localeInput === "string" && isLocale(localeInput) ? localeInput : "fr";
  const kind = typeof formData.get("kind") === "string" ? String(formData.get("kind")) : "";
  const territoryCode = typeof formData.get("territoryCode") === "string" ? String(formData.get("territoryCode")).trim().toUpperCase() : "";
  const slot = typeof formData.get("slot") === "string" ? String(formData.get("slot")).trim() : "";
  const failure = (reason: string) => `/${locale}/connexion?${new URLSearchParams({ demo: reason })}`;
  if (!isPublicDemoAccessEnabled()) redirect(failure("disabled"));

  const actor = findDemoRegionalActor({ kind, territoryCode, slot });
  if (!actor) redirect(failure("unavailable"));

  const admin = getSupabaseAdminClient();
  const ensured = await ensureDemoRegionalActor({ admin, actor });
  if (!ensured) redirect(failure("unavailable"));

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: actor.email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) redirect(failure("unavailable"));

  const supabase = await getSupabaseServerClient();
  const { data: session, error: sessionError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  const userId = session?.user?.id;
  if (sessionError || !userId) redirect(failure("unavailable"));
  const elevated = await elevateDemoSession({ email: actor.email, userId, supabase, admin });
  if (!elevated) redirect(failure("unavailable"));

  const destination = demoPersonaHome(actor.persona, locale);
  const workspace = demoPersonaWorkspace(actor.persona);
  const withOrg = `${destination}${destination.includes("?") ? "&" : "?"}organizationId=${encodeURIComponent(ensured.organizationId)}`;
  const resolved = await postLoginDestination(locale, withOrg, workspace);
  if (resolved.includes("navigation=role-fallback")) redirect(failure("role-missing"));
  redirect(resolved);
}
