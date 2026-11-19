import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadMyPlatformAccess, mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { loadAdminBoxesDashboard } from "@/modules/admin/data/boxes/repository";
import { DEMO_BOX_TERRITORIES, demoNetworkSummary, isDemoWholesaleEnabled } from "@/modules/admin/data/wholesale/demo-network";
import { loadAdminWholesaleCatalog } from "@/modules/admin/data/wholesale/repository";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { BoxWholesaleWorkshop } from "@/modules/admin/screens/finance/box-wholesale-workshop";
import { BoxesPanel } from "@/modules/admin/screens/finance/boxes-panel";
import { getCommerceMessages } from "@/modules/admin/screens/finance/commerce-messages";
import { financeAuditOrganizationContext } from "@/modules/admin/screens/finance/audit-organization-context";
import { FinanceAuditOrganizationSelector } from "@/modules/admin/screens/finance/audit-organization-selector";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminStep11Gate } from "@/modules/admin/ui/admin-step11-gate";

export const dynamic = "force-dynamic";

/** Atelier Box : catalogue territorial des tarifs de gros + composition combo. */
export default async function AdminFinanceOffersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; territory?: string; subject?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();

  const wholesaleDemoOn = isDemoWholesaleEnabled();
  const requestedTerritory = query.territory?.trim().toUpperCase() ?? "";
  const territory = requestedTerritory || (wholesaleDemoOn ? DEMO_BOX_TERRITORIES[5].code : "");
  const subject = query.subject?.trim() || null;

  const [boxes, access, supervision, wholesale] = await Promise.all([
    loadAdminBoxesDashboard(),
    loadMyPlatformAccess(),
    loadAdminSupervisionDashboard(100),
    loadAdminWholesaleCatalog({ territoryCode: territory || "ZZ_EMPTY", subject }),
  ]);
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") {
    redirect(connexionHref(locale, { next: `/${locale}/administration/finance/offres` }));
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
  const wholesaleCatalog =
    wholesale.status === "success" && territory && wholesale.value ? wholesale.value : null;
  const territoryOptions =
    wholesale.status === "success" && wholesale.value ? wholesale.value.territories : [];
  const demoSummary = wholesaleDemoOn ? demoNetworkSummary() : null;
  const territoryLinks = territoryOptions.length > 0
    ? territoryOptions
    : DEMO_BOX_TERRITORIES.map((item) => ({ code: item.code, name_fr: item.nameFr, name_ar: item.nameAr }));
  const activeTerritory = territoryLinks.find((item) => item.code === territory);

  return (
    <AdminModulePage
      locale={locale}
      active="finance"
      path="finance/offres"
      querySuffix={auditOrganizationId ? `organizationId=${auditOrganizationId}` : undefined}
      title={ar ? "ورشة Box combo" : "Atelier Box combo"}
      lead={
        ar
          ? "اختاروا المؤسسة والإقليم، ركّبوا الصندوق من عروض الجملة، ثم سجّلوا المسودة."
          : "Choisissez l’entreprise et le territoire, composez la Box depuis les tarifs de gros, puis enregistrez le brouillon."
      }
      hubGroup="finance"
      hubMode="strip"
    >
      <AdminStep11Gate locale={locale} query={orgQuery} current="finance" />
      <p className="admin-finance-links mb-2">
        <Link href={`/${locale}/administration/finance${orgQuery}`}>{ar ? "← المالية" : "← Finance"}</Link>
        <Link href={`/${locale}/administration/finance/credits${orgQuery}`}>{ar ? "حزم الأرصدة" : "Packs de crédits"}</Link>
      </p>

      <section id="offre-contexte" className="admin-offer-context space-y-4 scroll-mt-24">
        <FinanceAuditOrganizationSelector
          locale={locale}
          context={organizationContext}
          workshop="offres"
          preserveParams={{ territory: territory || undefined, subject: subject || undefined }}
        />

        <section className="admin-panel space-y-3" aria-labelledby="territory-filter-title">
          <div className="admin-section-head">
            <div>
              <h2 id="territory-filter-title">{ar ? "الإقليم والموضوع" : "Territoire et sujet"}</h2>
              <p>
                {ar
                  ? "الإقليم يفتح كتالوج الجملة. الموضوع اختياري لتصفية الخدمات."
                  : "Le territoire ouvre le catalogue de gros. Le sujet filtre optionnellement les services."}
              </p>
            </div>
            {activeTerritory ? (
              <p className="admin-offer-context__active" role="status">
                {ar ? activeTerritory.name_ar ?? activeTerritory.code : activeTerritory.name_fr ?? activeTerritory.code}
              </p>
            ) : null}
          </div>
          <form method="get" className="admin-offer-context__filters flex flex-wrap items-end gap-3">
            {auditOrganizationId ? <input type="hidden" name="organizationId" value={auditOrganizationId} /> : null}
            <label className="grid min-w-[14rem] flex-1 gap-1 text-sm font-medium">
              <span>{ar ? "الإقليم" : "Territoire"}</span>
              <select
                name="territory"
                required
                defaultValue={territory}
                className="min-h-11 w-full rounded-lg border bg-background px-3 py-2"
              >
                <option value="" disabled>
                  {ar ? "اختيار إقليم" : "Choisir un territoire"}
                </option>
                {territoryLinks.map((item) => (
                  <option key={item.code} value={item.code}>
                    {ar ? item.name_ar ?? item.code : item.name_fr ?? item.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-[12rem] flex-1 gap-1 text-sm font-medium">
              <span>{ar ? "موضوع (اختياري)" : "Sujet (optionnel)"}</span>
              <input
                name="subject"
                defaultValue={subject ?? ""}
                className="min-h-11 w-full rounded-lg border bg-background px-3 py-2"
                placeholder={ar ? "مثال: موقع، تسويق" : "ex. site, marketing"}
              />
            </label>
            <button type="submit" className="admin-btn-primary min-h-11">
              {ar ? "فتح الكتالوج" : "Ouvrir le catalogue"}
            </button>
          </form>
          {wholesaleDemoOn && demoSummary ? (
            <details className="admin-offer-demo">
              <summary>{ar ? "وضع العرض التجريبي" : "Mode démo catalogue"}</summary>
              <p role="status" className="mt-2 text-sm text-muted-foreground">
                {ar
                  ? `${demoSummary.territories} أقاليم · ${demoSummary.totalOffers} عرض جملة. ملفات الامتياز/المقاولين في فضاءاتهم.`
                  : `${demoSummary.territories} régions · ${demoSummary.totalOffers} offres de gros. Dossiers franchisés/ST dans leurs espaces.`}
              </p>
            </details>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              {ar
                ? "وضع العرض غير مفعّل — فعّلوا MATRICIA_DEMO_ACCESS_ENABLED مع APP_ENV=development."
                : "Mode démo inactif — activez MATRICIA_DEMO_ACCESS_ENABLED avec APP_ENV=development."}
            </p>
          )}
        </section>
      </section>

      <section id="boxes" className="admin-finance-block space-y-4 scroll-mt-24" aria-labelledby="offer-workshop-title">
        <div className="admin-section-head">
          <div>
            <h2 id="offer-workshop-title">{ar ? "الورشة" : "Atelier"}</h2>
            <p>
              {ar
                ? "اختاروا خطوط الجملة، راجعوا الهامش، ثم سجّلوا مسودة الصندوق."
                : "Sélectionnez les lignes de gros, vérifiez la marge, puis enregistrez le brouillon de Box."}
            </p>
          </div>
        </div>

        {wholesale.status === "error" ? (
          <p className="admin-notice" data-tone="danger" role="alert">
            {wholesale.reason === "MFA_REQUIRED" || (mfaBlocked && wholesale.reason === "FORBIDDEN")
              ? mfaRequiredMessage(locale)
              : wholesale.reason === "INVALID_INPUT"
                ? ar
                  ? "رمز الإقليم غير صالح."
                  : "Code territoire invalide."
                : ar
                  ? "تعذر تحميل كتالوج عروض الجملة."
                  : "Impossible de charger le catalogue des offres de gros."}
          </p>
        ) : (
          <BoxWholesaleWorkshop
            locale={locale}
            catalog={wholesaleCatalog}
            auditOrganizationId={auditOrganizationId}
            m={commerce}
            createKey={randomUUID()}
          />
        )}
      </section>

      {boxes.status === "success" ? (
        <details className="admin-finance-details">
          <summary>{ar ? "أدوات تقنية متقدمة" : "Outils techniques avancés"}</summary>
          <div className="admin-finance-details-body">
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
          </div>
        </details>
      ) : null}
    </AdminModulePage>
  );
}
