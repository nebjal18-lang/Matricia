import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { loadMyPlatformAccess, mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { loadAdminClosureDashboard } from "@/modules/admin/data/closure/repository";
import { loadAdminFinanceDashboard } from "@/modules/admin/data/finance/repository";
import { loadAdminPnlDashboard } from "@/modules/admin/data/pnl/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { ClosurePanel } from "@/modules/admin/screens/finance/closure-panel";
import { getCommerceMessages } from "@/modules/admin/screens/finance/commerce-messages";
import { FinancePanel } from "@/modules/admin/screens/finance/finance-panel";
import { FinanceSorties } from "@/modules/admin/screens/finance/finance-sorties";
import { FinanceWorkshops } from "@/modules/admin/screens/finance/finance-workshops";
import { getAdminFinanceMessages } from "@/modules/admin/screens/finance/messages";
import { PnlPanel } from "@/modules/admin/screens/finance/pnl-panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminStep11Gate } from "@/modules/admin/ui/admin-step11-gate";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { financeAuditOrganizationContext } from "@/modules/admin/screens/finance/audit-organization-context";
import { FinanceAuditOrganizationSelector } from "@/modules/admin/screens/finance/audit-organization-selector";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const [result, pnl, closure, , supervision] = await Promise.all([
    loadAdminFinanceDashboard(),
    loadAdminPnlDashboard(),
    loadAdminClosureDashboard(),
    loadMyPlatformAccess(),
    loadAdminSupervisionDashboard(100),
  ]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") {
    redirect(connexionHref(locale, { next: `/${locale}/administration/finance` }));
  }
  const m = getAdminFinanceMessages(locale);
  const commerce = getCommerceMessages(locale);
  const ar = locale === "ar";
  const organizationContext = financeAuditOrganizationContext(
    query.organizationId,
    supervision.status === "success"
      ? { status: "success", organizations: supervision.value.organizations }
      : { status: "error" },
  );
  const auditOrganizationId = organizationContext.organizationId;
  const orgQuery = auditOrganizationId ? `?organizationId=${encodeURIComponent(auditOrganizationId)}` : "";

  return (
    <AdminModulePage
      locale={locale}
      active="finance"
      path="finance"
      querySuffix={auditOrganizationId ? `organizationId=${auditOrganizationId}` : undefined}
      title={m.title}
      lead={m.intro}
      hubGroup="finance"
      hubMode="strip"
    >
      <div className="admin-finance-workspace space-y-6">
        <nav className="admin-finance-tabs" aria-label={m.nav}>
          <Link href={`/${locale}/administration/parcours${orgQuery}`} className="client-ghost-link">{m.tabMilestones}</Link>
          <a href="#finance-aujourdhui" className="admin-soft-cta" aria-current="page">{m.tabMoney}</a>
          <a href="#cloture" className="client-ghost-link">{m.tabClosure}</a>
        </nav>

        {result.status === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>
              {result.reason === "MFA_REQUIRED" ? mfaRequiredMessage(locale) : result.reason === "FORBIDDEN" ? m.forbidden : m.unavailable}
            </AlertTitle>
            <AlertDescription>
              <Link href={`/${locale}/administration/finance`} className="admin-soft-cta mt-3 inline-flex min-h-11 items-center">
                {m.retry}
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <FinancePanel
            locale={locale}
            dashboard={result.value}
            m={m}
            organizationQuery={orgQuery}
            identity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }}
          />
        )}

        <details className="client-card p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">{ar ? "الخطوة 11 والمؤسسة المرجعية" : "Étape 11 et entreprise de référence"}</summary>
          <div className="mt-4 space-y-4">
            <AdminStep11Gate locale={locale} query={orgQuery} current="finance" />
            <FinanceAuditOrganizationSelector locale={locale} context={organizationContext} />
          </div>
        </details>

        <details className="client-card p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">{m.booksTitle}</summary>
          <div className="mt-4 space-y-6">
        <section id="cloture" className="admin-section-head scroll-mt-24 space-y-4" aria-labelledby="finance-books-title">
          <div>
            <h2 id="finance-books-title">{m.booksTitle}</h2>
            <p>{m.booksLead}</p>
          </div>
          <div className="client-table-wrap" tabIndex={0} role="region" aria-label={m.booksTitle}>
            <table className="client-space-table admin-org-table">
              <thead>
                <tr>
                  <th>{m.operation}</th>
                  <th>{m.status}</th>
                  <th>{m.action}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{m.journalIn}</td>
                  <td><span className="client-status-chip" data-tone="peach">{m.closurePending}</span></td>
                  <td><a href="#pnl" className="client-text-link">{m.viewEntries}</a></td>
                </tr>
                <tr>
                  <td>{m.journalOut}</td>
                  <td><span className="client-status-chip" data-tone="peach">{m.closurePending}</span></td>
                  <td><a href="#sorties" className="client-text-link">{m.viewEntries}</a></td>
                </tr>
                <tr>
                  <td>{m.journalReconcile}</td>
                  <td><span className="client-status-chip" data-tone="peach">{m.closurePending}</span></td>
                  <td><a href="#rapprochements" className="client-text-link">{m.viewEntries}</a></td>
                </tr>
              </tbody>
            </table>
          </div>
          {pnl.status === "success" ? (
            <div id="pnl">
              <PnlPanel locale={locale} dashboard={pnl.value} m={commerce} keyValue={randomUUID()} />
            </div>
          ) : (
            <section id="pnl" className="admin-finance-stage space-y-2" aria-labelledby="finance-pnl-title">
              <h3 id="finance-pnl-title" className="admin-finance-subhead">{commerce.pnl}</h3>
              <p className="admin-finance-empty" role="status">{m.unavailable}</p>
            </section>
          )}
          {closure.status === "success" ? (
            <ClosurePanel locale={locale} dashboard={closure.value} m={commerce} keyValue={randomUUID()} />
          ) : (
            <section className="admin-finance-stage space-y-2" aria-labelledby="finance-closure-title">
              <h3 id="finance-closure-title" className="admin-finance-subhead">{commerce.closure}</h3>
              <p className="admin-finance-empty" role="status">{m.unavailable}</p>
            </section>
          )}
          <section id="centres-couts" className="admin-finance-stage scroll-mt-24 space-y-2" aria-labelledby="finance-cost-centers-title">
            <h3 id="finance-cost-centers-title" className="admin-finance-subhead">{ar ? "مراكز التكلفة" : "Centres de coûts"}</h3>
            <p className="admin-finance-lead">
              {ar
                ? "لا شاشة منفصلة: تُقرأ التخصيصات عبر المطابقة والفواتير المفتوحة ودفتر الأرباح والخسائر."
                : "Pas d’écran séparé : les affectations se lisent via le rapprochement, les factures ouvertes et le P&L."}
            </p>
          </section>
        </section>

        {result.status === "success" ? (
          <details className="client-card p-4">
            <summary className="min-h-11 cursor-pointer font-semibold">{m.recordedPayments}</summary>
            <div className="mt-4">
              <FinanceSorties locale={locale} dashboard={result.value} m={m} />
            </div>
          </details>
        ) : null}

        <FinanceWorkshops locale={locale} m={m} organizationQuery={orgQuery} />
          </div>
        </details>

        {/* Ancres legacy hub → ateliers */}
        <section id="boxes" hidden>
          <Link href={`/${locale}/administration/finance/offres${orgQuery}`}>boxes</Link>
        </section>
        <section id="plans" hidden>
          <Link href={`/${locale}/administration/finance/offres${orgQuery}`}>plans</Link>
        </section>
        <section id="credits" hidden>
          <Link href={`/${locale}/administration/finance/credits${orgQuery}`}>credits</Link>
        </section>
      </div>
    </AdminModulePage>
  );
}
