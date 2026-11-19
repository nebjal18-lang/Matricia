import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadMyPlatformAccess, mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { loadAdminBoxesDashboard } from "@/modules/admin/data/boxes/repository";
import { loadAdminCommerceCatalog } from "@/modules/admin/data/catalog/repository";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { CommerceCatalogPanel } from "@/modules/admin/screens/finance/commerce-catalog-panel";
import { CreditAttributionsPanel } from "@/modules/admin/screens/finance/credit-attributions-panel";
import { getCommerceMessages } from "@/modules/admin/screens/finance/commerce-messages";
import { financeAuditOrganizationContext } from "@/modules/admin/screens/finance/audit-organization-context";
import { FinanceAuditOrganizationSelector } from "@/modules/admin/screens/finance/audit-organization-selector";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";


export const dynamic = "force-dynamic";

/** Packs / promotions — séparé de l’atelier offres Box. */
export default async function AdminFinanceCreditsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const [catalog, boxes, access, supervision] = await Promise.all([
    loadAdminCommerceCatalog(),
    loadAdminBoxesDashboard(),
    loadMyPlatformAccess(),
    loadAdminSupervisionDashboard(100),
  ]);
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") {
    redirect(connexionHref(locale, { next: `/${locale}/administration/finance/credits` }));
  }

  const ar = locale === "ar";
  const commerce = getCommerceMessages(locale);
  const organizationContext = financeAuditOrganizationContext(
    query.organizationId,
    supervision.status === "success"
      ? { status: "success", organizations: supervision.value.organizations }
      : { status: "error" },
  );
  const auditOrganizationId = organizationContext.organizationId;
  const mfaBlocked = access.status === "ok" && !access.requirementSatisfied;
  const orgQuery = auditOrganizationId ? `?organizationId=${encodeURIComponent(auditOrganizationId)}` : "";

  return (
    <AdminModulePage
      locale={locale}
      active="finance"
      path="finance/credits"
      querySuffix={auditOrganizationId ? `organizationId=${auditOrganizationId}` : undefined}
      title={ar ? "حزم الأرصدة والعروض" : "Packs de crédits et promotions"}
      lead={
        ar
          ? "حزم، عروض، منح يدوي ونشاط الدفتر — منفصل عن بناء عرض Box متعدد الخدمات."
          : "Packs, promotions, attributions manuelles et journal des crédits — distinct de la création d’une offre Box multi-services."
      }
      hubGroup="finance"
      hubMode="strip"
    >
      <p className="admin-finance-links mb-2">
        <Link href={`/${locale}/administration/finance${orgQuery}`}>{ar ? "← العودة إلى المالية" : "← Retour à Finance"}</Link>
        <Link href={`/${locale}/administration/finance/offres${orgQuery}`}>{ar ? "عروض Box" : "Offres Box"}</Link>
      </p>

      <FinanceAuditOrganizationSelector locale={locale} context={organizationContext} workshop="credits" />

      <section id="credits" className="admin-finance-block space-y-4" data-tone="sky">
        {catalog.status === "error" ? (
          <p className="admin-notice" data-tone="danger" role="alert">
            {mfaBlocked || catalog.reason === "FORBIDDEN"
              ? mfaRequiredMessage(locale)
              : ar
                ? "تعذر تحميل الكتالوج."
                : "Impossible de charger le catalogue."}
          </p>
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

      {boxes.status === "success" ? (
        <details className="client-card p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">{ar ? "المنح والدفتر" : "Attributions et journal"}</summary>
          <div className="mt-4">
            <CreditAttributionsPanel
              locale={locale}
              dashboard={boxes.value}
              m={commerce}
              auditOrganizationId={auditOrganizationId}
            />
          </div>
        </details>
      ) : (
        <p className="admin-notice" data-tone="danger" role="alert">
          {boxes.reason === "MFA_REQUIRED" || (mfaBlocked && boxes.reason === "FORBIDDEN")
            ? mfaRequiredMessage(locale)
            : ar
              ? "تعذر تحميل المحافظ والدفتر."
              : "Impossible de charger les comptes crédits et le journal."}
        </p>
      )}
    </AdminModulePage>
  );
}
