"use client";

import { Badge } from "@/modules/shared/ui/badge";
import type { AdminBoxesDashboard } from "@/modules/admin/data/boxes/model";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
import { formatDateTimeCasablanca } from "@/modules/shared/lib/format/display";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { CommerceMessages } from "./commerce-messages";
import { ManualCreditGrantPanel } from "./manual-credit-panel";
import { SubscriptionGrantPanel } from "./subscription-grant-panel";

/**
 * Attributions + lecture du journal des crédits (hors atelier Offres Box).
 */
export function CreditAttributionsPanel({
  locale,
  dashboard,
  m,
  auditOrganizationId,
}: {
  locale: Locale;
  dashboard: AdminBoxesDashboard;
  m: CommerceMessages;
  auditOrganizationId: string | null;
}) {
  const canWrite = dashboard.capabilities.can_write && Boolean(auditOrganizationId);
  const orgWallets = auditOrganizationId
    ? dashboard.wallets.filter((wallet) => wallet.organization_id === auditOrganizationId)
    : [];
  const orgOptions = [
    ...new Map(orgWallets.map((wallet) => [wallet.organization_id, { id: wallet.organization_id, name: wallet.organization_name }])).values(),
  ];
  const hasActivity = dashboard.lots.length > 0 || dashboard.redemptions.length > 0;
  const offresHref = auditOrganizationId
    ? `/${locale}/administration/finance/offres?organizationId=${encodeURIComponent(auditOrganizationId)}`
    : `/${locale}/administration/finance/offres`;

  return (
    <section id="attributions" className="admin-finance-stage scroll-mt-24 space-y-4" aria-labelledby="credit-attributions-title">
      <div className="admin-section-head">
        <div>
          <h3 id="credit-attributions-title">
            {locale === "ar" ? "منح الأرصدة والدفتر" : "Attributions de crédits et journal"}
          </h3>
          <p>
            {locale === "ar"
              ? "منح يدوي أو أرصدة دورة اشتراك عبر الدفتر غير القابل للتعديل — ليس إنشاء عرض Box."
              : "Attribution manuelle ou crédits de cycle d’abonnement via le journal immuable — pas la création d’offre Box."}
          </p>
        </div>
      </div>

      {!auditOrganizationId ? (
        <p role="status" className="admin-notice">
          {locale === "ar"
            ? "اختاروا مؤسسة أعلاه لفتح المنح."
            : "Choisissez une entreprise ci-dessus pour ouvrir les attributions."}
        </p>
      ) : null}

      {canWrite ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ManualCreditGrantPanel locale={locale} wallets={orgWallets} />
          <SubscriptionGrantPanel locale={locale} organizations={orgOptions} />
        </div>
      ) : null}

      {auditOrganizationId && orgWallets.length === 0 ? (
        <p role="status" className="admin-notice" data-tone="warn">
          {locale === "ar"
            ? "لا محفظة لهذه المؤسسة بعد. افتحوها من ورشة العروض ثم عودوا هنا للمنح."
            : "Aucun compte crédits pour cette entreprise. Ouvrez-le dans l’atelier des offres puis revenez ici pour attribuer."}{" "}
          <a href={offresHref} className="font-semibold underline-offset-4 hover:underline">
            {locale === "ar" ? "ورشة العروض" : "Atelier des offres"}
          </a>
        </p>
      ) : null}

      <p className="admin-finance-metrics-inline" role="status">
        <span>
          {m.wallets} <strong dir="ltr">{dashboard.wallets.length}</strong>
        </span>
        {auditOrganizationId ? (
          <span>
            {locale === "ar" ? "لهذه المؤسسة" : "Pour cette entreprise"}{" "}
            <strong dir="ltr">{orgWallets.length}</strong>
          </span>
        ) : null}
      </p>

      <details className="admin-finance-details" open={hasActivity}>
        <summary>
          {locale === "ar" ? "نشاط الدفتر (دفعات واستهلاكات)" : "Activité du journal des crédits (lots et consommations)"}
          <span dir="ltr">
            {dashboard.lots.length}/{dashboard.redemptions.length}
          </span>
        </summary>
        <div className="admin-finance-details-body space-y-3">
          <section className="space-y-2">
            <h4 className="admin-finance-subhead">{m.lots}</h4>
            {dashboard.lots.length ? (
              <div className="admin-finance-list">
                {dashboard.lots.map((item) => (
                  <article key={item.id} className="admin-finance-row text-sm">
                    <p>
                      {localizeStatus(item.source_type, locale)} · <span dir="ltr">{item.quantity}</span>
                    </p>
                    <time dateTime={item.expires_at}>{formatDateTimeCasablanca(item.expires_at, locale)}</time>
                  </article>
                ))}
              </div>
            ) : (
              <p className="admin-finance-empty" role="status">
                {locale === "ar" ? "لا دفعات أرصدة بعد — تظهر بعد المنح أو الشراء." : "Aucun lot encore — apparaît après attribution ou achat."}
              </p>
            )}
          </section>
          <section className="space-y-2">
            <h4 className="admin-finance-subhead">{m.redemptions}</h4>
            {dashboard.redemptions.length ? (
              <div className="admin-finance-list">
                {dashboard.redemptions.map((item) => (
                  <article key={item.id} className="admin-finance-row text-sm">
                    <p>
                      {localizeStatus(item.status, locale)} · {item.reserved_credits} cr
                    </p>
                    <Badge variant="outline">{localizeStatus(item.status, locale)}</Badge>
                  </article>
                ))}
              </div>
            ) : (
              <p className="admin-finance-empty" role="status">
                {locale === "ar" ? "لا استهلاكات بعد — تظهر عند حجز ميزة." : "Aucune consommation encore — apparaît à la réservation d’un avantage."}
              </p>
            )}
          </section>
        </div>
      </details>
    </section>
  );
}
