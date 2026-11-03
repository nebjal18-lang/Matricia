import { financeCostProofCopy } from "@/modules/admin/screens/pnl/finance-cost-proof-copy";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { loadMyPlatformAccess, mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { loadAdminBoxesDashboard } from "@/modules/admin/data/boxes/repository";
import { loadAdminCommerceCatalog } from "@/modules/admin/data/catalog/repository";
import { loadAdminClosureDashboard } from "@/modules/admin/data/closure/repository";
import { loadAdminFinanceDashboard } from "@/modules/admin/data/finance/repository";
import { loadAdminPnlDashboard } from "@/modules/admin/data/pnl/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { BoxesPanel } from "@/modules/admin/screens/finance/boxes-panel";
import { CommerceCatalogPanel } from "@/modules/admin/screens/finance/commerce-catalog-panel";
import { ClosurePanel } from "@/modules/admin/screens/finance/closure-panel";
import { getCommerceMessages } from "@/modules/admin/screens/finance/commerce-messages";
import { FinancePanel } from "@/modules/admin/screens/finance/finance-panel";
import { FinanceSorties } from "@/modules/admin/screens/finance/finance-sorties";
import { getAdminFinanceMessages } from "@/modules/admin/screens/finance/messages";
import { PnlPanel } from "@/modules/admin/screens/finance/pnl-panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { adminCopy } from "@/modules/admin/data/spaces/copy";

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
  const [result, boxes, pnl, closure, catalog, access] = await Promise.all([
    loadAdminFinanceDashboard(),
    loadAdminBoxesDashboard(),
    loadAdminPnlDashboard(),
    loadAdminClosureDashboard(),
    loadAdminCommerceCatalog(),
    loadMyPlatformAccess(),
  ]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/finance` }));
  const m = getAdminFinanceMessages(locale);
  const commerce = getCommerceMessages(locale);
  const c = adminCopy(locale);
  const ar = locale === "ar";
  const mfaBlocked = access.status === "ok" && !access.requirementSatisfied;
  const blockedCopy = (reason: string) => mfaBlocked && reason === "FORBIDDEN" ? mfaRequiredMessage(locale) : reason === "FORBIDDEN" ? m.forbidden : m.unavailable;
  const auditOrganizationId = query.organizationId
    ?? (boxes.status === "success" ? boxes.value.wallets[0]?.organization_id ?? null : null)
    ?? (result.status === "success" ? result.value.subscriptions[0]?.organization_id ?? null : null);

  return (
    <AdminModulePage locale={locale} active="finance" path="finance" title={m.title} lead={c.hubFinanceLead} hubGroup="finance">
      <Link className="admin-btn-outline inline-flex min-h-11 items-center" href={`/${locale}/administration/finance/recompenses`}>{ar?"مراجعة مكافآت إحالة العملاء":"Examiner les récompenses du parrainage Client"}</Link>
      <Link className="admin-btn-outline inline-flex min-h-11 items-center" href={`/${locale}/administration/finance/rapprochements-couts`}>{financeCostProofCopy[locale].openReconciliation}</Link>
      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{result.reason === "MFA_REQUIRED" ? mfaRequiredMessage(locale) : result.reason === "FORBIDDEN" ? m.forbidden : m.unavailable}</AlertTitle>
          <AlertDescription>
            <Link href={`/${locale}/administration/finance`} className="admin-btn-outline mt-3 inline-flex">{m.retry}</Link>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          <FinanceSorties locale={locale} dashboard={result.value} m={m} />
          <div className="admin-panel">
            <FinancePanel locale={locale} dashboard={result.value} m={m} identity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }} />
          </div>
          <section id="boxes" className="scroll-mt-24 rounded-xl border bg-card p-5">
            <div id="credits" className="scroll-mt-24" />
            <h2 className="text-xl font-semibold">{commerce.boxes}</h2>
            {boxes.status === "error" ? (
              <p className="mt-2 text-sm text-muted-foreground">{blockedCopy(boxes.reason)}{mfaBlocked && boxes.reason === "FORBIDDEN" ? <> <Link href={`/${locale}/securite/compte`}>{ar ? "فتح أمان الحساب" : "Ouvrir la sécurité du compte"}</Link></> : null}</p>
            ) : (
              <BoxesPanel
                locale={locale}
                dashboard={boxes.value}
                m={commerce}
                auditOrganizationId={auditOrganizationId}
                keys={{
                  benefit: randomUUID(),
                  activateBenefit: randomUUID(),
                  box: randomUUID(),
                  activateBox: randomUUID(),
                  link: randomUUID(),
                  wallet: randomUUID(),
                  credits: randomUUID(),
                }}
              />
            )}
          </section>
          <section id="catalogue-credits" className="scroll-mt-24 rounded-xl border bg-card p-5">
            <h2 className="text-xl font-semibold">{commerce.packs}</h2>
            {catalog.status === "error" ? (
              <p className="mt-2 text-sm text-muted-foreground">{blockedCopy(catalog.reason)}{mfaBlocked && catalog.reason === "FORBIDDEN" ? <> <Link href={`/${locale}/securite/compte`}>{ar ? "فتح أمان الحساب" : "Ouvrir la sécurité du compte"}</Link></> : null}</p>
            ) : (
              <CommerceCatalogPanel
                locale={locale}
                catalog={catalog.value}
                wallets={boxes.status === "success" ? boxes.value.wallets : []}
                m={commerce}
                auditOrganizationId={auditOrganizationId}
                keys={{
                  pack: randomUUID(),
                  activatePack: randomUUID(),
                  grantPack: randomUUID(),
                  promotion: randomUUID(),
                  activatePromotion: randomUUID(),
                  grantPromotion: randomUUID(),
                  parameter: randomUUID(),
                  activateParameter: randomUUID(),
                }}
              />
            )}
          </section>
          {pnl.status === "success" ? <PnlPanel locale={locale} dashboard={pnl.value} m={commerce} keyValue={randomUUID()} /> : <section id="pnl" className="scroll-mt-24 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">{commerce.pnl}</h2><p className="mt-2 text-sm text-muted-foreground">{m.unavailable}</p></section>}
          {closure.status === "success" ? <ClosurePanel locale={locale} dashboard={closure.value} m={commerce} keyValue={randomUUID()} /> : <section id="cloture" className="scroll-mt-24 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">{commerce.closure}</h2><p className="mt-2 text-sm text-muted-foreground">{m.unavailable}</p></section>}
          <section id="centres-couts" className="scroll-mt-24 rounded-xl border bg-card p-5">
            <h2 className="text-xl font-semibold">{ar ? "مراكز التكلفة" : "Centres de coûts"}</h2>
            <p className="mt-2 leading-7 text-muted-foreground">
              {ar
                ? "لا محرك مراكز تكلفة منفصل هنا. التوزيع يظهر عبر المطابقة والفواتير المفتوحة وكتب الأرباح والخسائر أعلاه."
                : "Aucun moteur de centres de coûts distinct ici. L’affectation se lit via le rapprochement, les factures ouvertes et les livres P&L ci-dessus."}
            </p>
          </section>
        </div>
      )}
    </AdminModulePage>
  );
}
