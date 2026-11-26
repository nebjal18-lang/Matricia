"use server";

import { redirect } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseAdminClient } from "@/modules/shared/lib/supabase/admin";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { demoPersonaEmail, isPublicDemoAccessEnabled } from "./demo-policy";
import { demoPersonaHome, demoPersonaWorkspace, type DemoPersona } from "./demo-personas";
import { ensureDemoPersonaAuthorization } from "./demo-authorization";
import { ensureDemoFranchisePersona } from "./demo-franchise-ensure";
import { findDemoRegionalActor } from "./demo-regional-directory";
import { ensureDemoClientComFilm } from "./demo-client-com-film-ensure";
import { ensureDemoRegionalActor, loadDemoRegionalIdentity } from "./demo-regional-ensure";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { postLoginDestination } from "./actions";
import { elevateDemoSession } from "./demo-assurance";
import { findDemoIdentity, isDemoIdentity } from "./demo-identity";

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
  const identity = await findDemoIdentity(admin, email, persona);
  if (!identity) redirect(failure("role-missing"));
  const authorized = await ensureDemoPersonaAuthorization({ persona, userId: identity.id, admin });
  if (!authorized) redirect(failure("role-missing"));
  let organizationId: string | undefined;
  if (persona === "franchise") {
    const ensured = await ensureDemoFranchisePersona({ admin, userId: identity.id, email });
    if (!ensured) redirect(failure("role-missing"));
    organizationId = ensured.organizationId;
  }
  await connectValidatedDemo({ admin, email, userId: identity.id, persona, locale, failure, organizationId });
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

  const prepared = await (async () => {
    try {
      const admin = getSupabaseAdminClient();
      // Seed-first ensure — Auth listUsers pagination outages must not become a digest.
      const ensured = await ensureDemoRegionalActor({ admin, actor });
      if (!ensured) return null;
      if (actor.persona === "client") {
        await ensureDemoClientComFilm({
          admin,
          client: actor,
          clientUserId: ensured.userId,
          clientOrganizationId: ensured.organizationId,
        });
      }
      const identity = await loadDemoRegionalIdentity(admin, ensured.userId, actor);
      if (!identity || identity.id !== ensured.userId) return { admin, ensured, identity: null };
      return { admin, ensured, identity };
    } catch {
      return null;
    }
  })();
  if (!prepared) redirect(failure("unavailable"));
  if (!prepared.identity) redirect(failure("role-missing"));
  await connectValidatedDemo({
    admin: prepared.admin,
    email: actor.email,
    userId: prepared.identity.id,
    persona: actor.persona,
    locale,
    failure,
    organizationId: prepared.ensured.organizationId,
  });
}

async function connectValidatedDemo(input: {
  admin: ReturnType<typeof getSupabaseAdminClient>;
  email: string;
  userId: string;
  persona: DemoPersona;
  locale: "fr" | "ar";
  failure: (reason: string) => string;
  organizationId?: string;
}): Promise<void> {
  const { admin, email, userId, persona, locale, failure } = input;
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash || !data.user || data.user.id !== userId || !isDemoIdentity(data.user, email, persona)) {
    redirect(failure("unavailable"));
  }

  const supabase = await getSupabaseServerClient();
  let resolved: string | null = null;
  let reason = "unavailable";
  try {
    const session = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    const user = session.data?.user;
    if (!session.error && user?.id === userId && isDemoIdentity(user, email, persona)) {
      if (await elevateDemoSession({ email, userId, supabase, admin })) {
        const destination = demoPersonaHome(persona, locale);
        const workspace = demoPersonaWorkspace(persona);
        const withOrg = input.organizationId
          ? destination + (destination.includes("?") ? "&" : "?") + "organizationId=" + encodeURIComponent(input.organizationId)
          : destination;
        const candidate = await postLoginDestination(locale, withOrg, workspace);
        const safeCandidate = safeReturnPath(candidate, locale);
        const target = safeCandidate ? new URL(safeCandidate, "https://matricia.invalid") : null;
        const expected = new URL(withOrg, "https://matricia.invalid");
        // Only the requested workspace home completes login. Login, MFA and
        // unavailable redirects are refusals even when they contain our next URL.
        if (!target || target.pathname !== expected.pathname
          || target.searchParams.get("workspace") !== expected.searchParams.get("workspace")
          || target.searchParams.has("demo")
          || target.searchParams.get("navigation") === "role-fallback") {
          reason = "role-missing";
        } else {
          resolved = candidate;
        }
      }
    }
  } catch {
    // Auth/service failures never leave a partially established demo session.
    reason = "unavailable";
  } finally {
    if (!resolved) await supabase.auth.signOut({ scope: "local" });
  }
  redirect(resolved ?? failure(reason));
}
