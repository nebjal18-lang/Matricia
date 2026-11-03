import {workflowStatusLabel}from"@/modules/shared/lib/i18n/workflow-statuses";
import Link from "next/link";
import { formatMinor } from "@/modules/provider/data/billing/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { SubscriptionDashboard } from "@/modules/shared/lib/subscriptions/model";
import type { VolumeDashboard } from "@/modules/shared/lib/volume-procurement/model";

const copy = {
  fr: {
    title: "Mes achats",
    lead: "Achats de la même organisation, visibles seulement avec un rôle Client activé. Aucun montant n’est inventé.",
    needClient: "Activez le Mode Client sur ce passeport pour consulter abonnement, crédits et achats groupés.",
    activate: "Ouvrir le Mode Client",
    subscription: "Abonnement Matricia",
    noSubscription: "Aucun abonnement n’est encore créé pour cette organisation.",
    reservations: "Réservations d’achats groupés",
    emptyReservations: "Aucune réservation n’est enregistrée.",
    seeSubscription: "Voir l’abonnement",
    seeVolume: "Voir les achats groupés",
    plan: "Plan",
    status: "Statut",
    period: "Période",
    units: "Unités",
  },
  ar: {
    title: "مشترياتي",
    lead: "مشتريات المؤسسة نفسها، ظاهرة فقط عند تفعيل دور العميل. لا يُختلق أي مبلغ.",
    needClient: "فعّلوا وضع العميل على هذا الجواز لمعاينة الاشتراك والأرصدة والمشتريات المجمّعة.",
    activate: "فتح وضع العميل",
    subscription: "اشتراك ماتريسيا",
    noSubscription: "لم يُنشأ اشتراك لهذه المؤسسة بعد.",
    reservations: "حجوزات المشتريات المجمّعة",
    emptyReservations: "لا توجد حجوزات مسجّلة.",
    seeSubscription: "عرض الاشتراك",
    seeVolume: "عرض المشتريات المجمّعة",
    plan: "الخطة",
    status: "الحالة",
    period: "الفترة",
    units: "الوحدات",
  },
} as const;

export function getPurchaseMessages(locale: Locale) {
  return copy[locale];
}

export function ProviderPurchasesBoard({
  locale,
  query,
  hasClientRole,
  subscription,
  volume,
}: {
  locale: Locale;
  query: string;
  hasClientRole: boolean;
  subscription: SubscriptionDashboard | null;
  volume: VolumeDashboard | null;
}) {
  const m = getPurchaseMessages(locale);
  if (!hasClientRole) {
    return (
      <main className="client-page provider-purchases">
        <article className="client-card">
          <header><h2>{m.title}</h2></header>
          <p>{m.needClient}</p>
          <Link href={`/${locale}/sous-traitant/mode-client${query}`} className="client-cta">{m.activate}</Link>
        </article>
      </main>
    );
  }
  const current = subscription?.subscription;
  const plan = current?.currentPlan;
  return (
    <main className="client-page provider-purchases">
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{m.subscription}</h2>
            <Link href={`/${locale}/client/abonnement${query}`} className="client-text-link">{m.seeSubscription}</Link>
          </header>
          {current && plan ? (
            <dl className="client-fact-grid">
              <div><small>{m.plan}</small><span>{plan.code} · v{plan.version}</span></div>
              <div><small>{m.status}</small><span>{workflowStatusLabel(current.status,locale)}</span></div>
              <div><small>{m.period}</small><span dir="ltr">{current.currentPeriodEnd ?? "—"}</span></div>
              <div><small>{m.plan}</small><span dir="ltr">{formatMinor(plan.monthlyPriceMinor, plan.currency, locale)}</span></div>
            </dl>
          ) : (
            <p>{m.noSubscription}</p>
          )}
        </article>
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{m.reservations}</h2>
            <Link href={`/${locale}/client/achats-groupes${query}`} className="client-text-link">{m.seeVolume}</Link>
          </header>
          {!volume || volume.reservations.length === 0 ? <p>{m.emptyReservations}</p> : (
            <table className="client-space-table">
              <thead><tr><th>{m.plan}</th><th>{m.units}</th><th>{m.status}</th></tr></thead>
              <tbody>
                {volume.reservations.map((row) => (
                  <tr key={row.id}>
                    <td>{row.benefitReference}</td>
                    <td dir="ltr">{row.reservedUnits}</td>
                    <td>{workflowStatusLabel(row.status,locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </main>
  );
}
