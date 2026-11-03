import Link from "next/link";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { AccountSecurityPanel } from "./account-security-panel";
import { getAccountSecurity } from "./actions";
import { getAccountSecurityMessages } from "./messages";
import { ConnectedAppShell } from "@/modules/shared/ui/connected-app-shell";
import { SecurityBoard } from "@/modules/client/screens/spaces/security-board";
import { listMySessions } from "@/app/[locale]/securite/sessions/actions";
import { listOrganizationRoles } from "@/app/[locale]/organisation/roles/actions";
import { getRoleMessages } from "@/app/[locale]/organisation/roles/messages";
import { cookies } from "next/headers";
import { readWorkspaceNavigation } from "@/modules/shared/lib/auth/workspace-navigation-server";
import { resolveConnectedSpace } from "@/modules/shared/lib/account-security/connected-space";

function dateLabel(value: string | null, locale: "fr" | "ar") {
  if (!value) return "—";
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? `${value}Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-MA" : "ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function AccountSecurityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; next?: string; workspace?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const nextPath = safeReturnPath(query.next,locale);
  const contextQuery = new URLSearchParams();
  if (nextPath) contextQuery.set("next", nextPath);
  if (query.organizationId) contextQuery.set("organizationId", query.organizationId);
  if (query.workspace) contextQuery.set("workspace", query.workspace);
  const selfPath = `/${locale}/securite/compte${contextQuery.size ? `?${contextQuery}` : ""}`;
  const preferred = query.workspace ?? (nextPath?.startsWith(`/${locale}/administration/`) ? "administration" : (await cookies()).get("matricia.workspace")?.value);
  const navigation = await readWorkspaceNavigation(locale, query.organizationId, preferred);
  const selectedOption = navigation.status === "ok" ? navigation.navigation.options.find(option => option.kind === navigation.navigation.landing) : undefined;
  const effectiveOrganizationId = selectedOption ? new URL(selectedOption.href, "https://matricia.invalid").searchParams.get("organizationId") ?? undefined : query.organizationId;
  const [result, sessions, roles, space] = await Promise.all([
    getAccountSecurity(),
    listMySessions(),
    listOrganizationRoles(),
    resolveConnectedSpace({ locale, organizationId: navigation.status === "ok" && navigation.navigation.landing === "administration" ? undefined : effectiveOrganizationId, allowDirectoryFailure: true }).catch(error => {
      unstable_rethrow(error);
      if (!(error instanceof Error) || error.message !== "WORKSPACE_CONTEXT_UNAVAILABLE") throw error;
      return { status: "success" as const, selectedOrganizationId: null, selectedQuery: "", organizationName: null, userEmail: null, directoryUnavailable: true };
    }),
  ]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: selfPath }));
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: selfPath }));
  if (nextPath && result.status === "success" && result.currentAal === "aal2" && result.requirementSatisfied) redirect(nextPath);
  const messages = getAccountSecurityMessages(locale);
  const roleMessages = getRoleMessages(locale);
  return (
    <ConnectedAppShell
      locale={locale}
      organizationId={query.organizationId}
      allowContextFailure
      currentPath={selfPath}
      nextPath={nextPath}
      workspace={query.workspace}
      title={locale === "ar" ? "أمان حسابي" : "Sécurité de mon compte"}
      lead={locale === "ar" ? "العامل الثاني وحماية الجلسات في مساحتكم الحالية." : "Second facteur et protection des sessions dans votre espace actuel."}
      clientActive="company"
      providerActive="company"
      franchiseActive="governance"
    >
      {space.directoryUnavailable ? <WorkspaceFailure locale={locale} reason="QUERY_FAILED" returnPath={selfPath} /> : null}
      <Link className="min-h-11 underline" href={`/${locale}/connexion/consentements`}>{locale==="fr"?"Mes textes versionnés et consentements":"نسخ النصوص وموافقاتي"}</Link>
      {result.status === "error" ? (
<WorkspaceFailure locale={locale} reason={result.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "QUERY_FAILED"} returnPath={selfPath} />
      ) : (
        <SecurityBoard
          locale={locale}
          query={space.selectedQuery}
          organizationName={space.organizationName}
          organizationId={space.selectedOrganizationId}
          security={result}
          sessions={sessions.status === "success" ? sessions.sessions.map((session) => ({
            id: session.id,
            isCurrent: session.isCurrent,
            label: session.userAgent && /Mobile|Android|iPhone|iPad/i.test(session.userAgent)
              ? (locale === "ar" ? "جهاز جوّال" : "Appareil mobile")
              : (locale === "ar" ? "جهاز مكتبي" : "Appareil de bureau"),
            detail: session.userAgent ?? (locale === "ar" ? "وكيل غير متاح" : "Agent indisponible"),
            lastSeen: dateLabel(session.lastSeenAt, locale),
          })) : []}
          members={roles.status === "success" ? roles.memberships.map((member) => ({
            id: member.id,
            name: member.isCurrentUser ? (locale === "ar" ? "أنتم" : "Vous") : (member.organizationName ?? roleMessages.anotherMember),
            role: member.roles[0] ? roleMessages.roles[member.roles[0]] : roleMessages.noRole,
            status: roleMessages.membershipStatuses[member.status],
          })) : []}
        >
          <details className="client-ops" open>
            <summary>{messages.mfaTitle}</summary>
            <AccountSecurityPanel nextPath={nextPath} locale={locale} security={result} messages={messages} />
          </details>
        </SecurityBoard>
      )}
    </ConnectedAppShell>
  );
}
