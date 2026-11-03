import Link from "next/link";
import { Download, UserPlus } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { AdminReadError } from "@/modules/admin/ui/admin-read-error";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { loadAdminClientDirectory } from "@/modules/admin/data/spaces/actors-repository";
import { ClientsBoard } from "@/modules/admin/screens/spaces/actor-boards";
import { ClientsPanel } from "@/modules/admin/screens/clients/clients-panel";
import { getAdminClientMessages } from "@/modules/admin/screens/clients/messages";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; q?: string; status?: string; compliance?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/clients` }));
  const directory = await loadAdminClientDirectory(locale);
  if (directory.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/clients` }));
  const a = actorCopy(locale);
  const m = getAdminClientMessages(locale);
  const alternate = locale === "ar" ? "fr" : "ar";
  const boardFilters = { status: query.status, compliance: query.compliance };
  const paramsForUi = new URLSearchParams(space.selectedQuery);
  for (const key of ["q", "status", "compliance"] as const) if (query[key]) paramsForUi.set(key, query[key]!);
  const uiQuery = paramsForUi.size ? `?${paramsForUi}` : "";

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      actorCurrent="clients"
      searchAction={`/${locale}/administration/clients`}
      searchPlaceholder={a.searchUsers}
      alternateHref={`/${alternate}/administration/clients${uiQuery}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/entreprises${space.selectedQuery}`, label: locale === "ar" ? "الفاعلون" : "Acteurs" }, { label: a.clientsTitle }]} />}
      title={a.clientsTitle}
      lead={a.clientsLead}
      actions={
        <>
          <Link href={`/${locale}/administration/utilisateurs/inviter${space.selectedQuery}${space.selectedQuery ? "&" : "?"}role=CLIENT_OWNER`} className="admin-soft-cta"><UserPlus className="size-4" aria-hidden />{a.inviteClient}</Link>
          <a href={`/${locale}/administration/clients/export${uiQuery}`} className="admin-dir-action" data-tone="white"><Download className="size-4" aria-hidden />{locale === "ar" ? "تصدير" : "Exporter"}</a>
        </>
      }
    >
      {directory.reason === "MFA_REQUIRED" ? (
        <main className="client-page">
          <Alert>
            <AlertTitle>{m.mfaTitle}</AlertTitle>
            <AlertDescription>
              <p>{m.mfaBody}</p>
              <Link href={`/${locale}/securite/compte`} className="admin-soft-cta">{m.configureMfa}</Link>
            </AlertDescription>
          </Alert>
        </main>
      ) : directory.reason === "FORBIDDEN" ? (
        <main className="client-page">
          <Alert variant="destructive">
            <AlertTitle>{a.forbiddenSection}</AlertTitle>
            <AlertDescription>{a.forbiddenSectionLead}</AlertDescription>
          </Alert>
        </main>
      ) : directory.reason ? <main className="client-page"><AdminReadError locale={locale} reason={directory.reason === "QUERY_FAILED" ? "UNAVAILABLE" : directory.reason} retryHref={`/${locale}/administration/clients${uiQuery}`} /></main> : (
        <>
          <ClientsBoard locale={locale} query={uiQuery} organizations={directory.organizations} cases={directory.cases} diagnostics={directory.diagnostics} search={query.q} filters={boardFilters} />
          {directory.dashboard ? (
            <details className="client-ops">
              <summary>{m.title}</summary>
              <ClientsPanel dashboard={directory.dashboard} locale={locale} m={m} keys={directory.keys} />
            </details>
          ) : null}
        </>
      )}
    </AdminAppShell>
  );
}
