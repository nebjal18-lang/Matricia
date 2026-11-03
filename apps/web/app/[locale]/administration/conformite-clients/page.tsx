import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { actorCopy } from "@/modules/admin/data/spaces/actors-copy";
import { canApplyAdminDemo, demoComplianceCases } from "@/modules/admin/data/spaces/demo-overlay";
import { listClientComplianceReviews } from "@/modules/admin/screens/conformite-clients/actions";
import { ComplianceBoard } from "@/modules/admin/screens/spaces/actor-boards";
import { getComplianceMessages } from "@/modules/admin/screens/conformite-clients/messages";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ClientComplianceAdministrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; filter?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/conformite-clients` }));
  const requestedPage = Number(query.page ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filter = ["all","check","complement","review","decided"].includes(query.filter ?? "all") ? query.filter ?? "all" : "all";
  const result = await listClientComplianceReviews({page, filter});
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/conformite-clients` }));
  const serverCounts = result.status === "success" ? result.counts : undefined;
  const a = actorCopy(locale);
  const messages = getComplianceMessages(locale);
  const alternate = locale === "ar" ? "fr" : "ar";
  const cases = result.status === "success" && result.cases.length > 0
    ? result.cases
    : canApplyAdminDemo() ? demoComplianceCases() : result.status === "success" ? result.cases : [];
  const blocked = result.status === "error" && result.reason === "FORBIDDEN" && cases.length === 0;

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      actorCurrent="compliance"
      searchAction={`/${locale}/administration/conformite-clients`}
      searchPlaceholder={messages.navigation}
      alternateHref={`/${alternate}/administration/conformite-clients${space.selectedQuery ? `${space.selectedQuery}&` : "?"}filter=${filter}&page=${page}`}
      crumb={<AdminCrumb locale={locale} query={space.selectedQuery} items={[{ href: `/${locale}/administration/entreprises${space.selectedQuery}`, label: locale === "ar" ? "الفاعلون" : "Acteurs" }, { label: a.complianceTitle }]} />}
      title={messages.title}
      lead={a.complianceLead}
    >
      {result.status === "error" && result.reason === "MFA_REQUIRED" ? (
          <main className="client-page">
            <Alert>
              <AlertTitle>{messages.mfaTitle}</AlertTitle>
              <AlertDescription>
                <p>{messages.mfaDescription}</p>
                <Link href={`/${locale}/securite/compte`} className="admin-primary-cta">{messages.configureMfa}</Link>
              </AlertDescription>
            </Alert>
            <ComplianceBoard locale={locale} query={space.selectedQuery} cases={cases} filter={filter} serverCounts={serverCounts} />
          </main>
        ) : blocked ? (
          <main className="client-page">
            <Alert variant="destructive">
              <AlertTitle>{messages.forbiddenTitle}</AlertTitle>
              <AlertDescription><p>{messages.forbiddenDescription}</p></AlertDescription>
            </Alert>
            <ComplianceBoard locale={locale} query={space.selectedQuery} cases={[]} filter={filter} serverCounts={serverCounts} />
          </main>
        ) : result.status === "error" && cases.length === 0 ? (
          <main className="client-page">
            <Alert variant="destructive">
              <AlertTitle>{messages.unavailableTitle}</AlertTitle>
              <AlertDescription>
                <p>{messages.unavailable}</p>
                <Link href={`/${locale}/administration/conformite-clients`} className="admin-soft-cta">{messages.retry}</Link>
              </AlertDescription>
            </Alert>
            <ComplianceBoard locale={locale} query={space.selectedQuery} cases={[]} filter={filter} serverCounts={serverCounts} />
          </main>
        ) : (
        <ComplianceBoard locale={locale} query={space.selectedQuery} cases={cases} filter={filter} serverCounts={serverCounts} />
      )}
      {result.status === "success" ? <nav className="client-page flex gap-4" aria-label={locale === "ar" ? "صفحات الامتثال" : "Pages de conformité"}>{page>1?<Link href={`/${locale}/administration/conformite-clients${space.selectedQuery ? `${space.selectedQuery}&` : "?"}filter=${filter}&page=${page-1}`}>{locale === "ar" ? "السابق" : "Précédent"}</Link>:null}<span>{page}</span>{result.hasNext?<Link href={`/${locale}/administration/conformite-clients${space.selectedQuery ? `${space.selectedQuery}&` : "?"}filter=${filter}&page=${page+1}`}>{locale === "ar" ? "التالي" : "Suivant"}</Link>:null}</nav>:null}
    </AdminAppShell>
  );
}
