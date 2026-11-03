import Link from "next/link";
import { type SubscriptionSummary } from "@/modules/shared/lib/subscriptions/model";
import {formatMinorExact as formatMinor} from "@/modules/shared/lib/solution-insights/model";
import {subscriptionDateLabel} from "./display";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

type Cycle = SubscriptionSummary["cycles"][number];

export function SubscriptionInvoice({
  locale,
  query,
  organizationName,
  cycle,
}: {
  locale: Locale;
  query: string;
  organizationName: string;
  cycle: Cycle;
}) {
  const ar = locale === "ar";
  return (
    <article className="client-card">
      <header className="client-priority-head">
        <h2>{ar ? "تفاصيل دورة الاشتراك" : "Détail du cycle d’abonnement"}</h2>
        <span className="client-status-chip" data-tone="mint">{ar ? "دورة مسجلة" : "Cycle comptabilisé"}</span>
      </header>
      <p>{organizationName}</p>
      <dl className="client-brief-kpis">
        <div><dt>{ar ? "الدورة" : "Cycle"}</dt><dd dir="ltr">{cycle.cycleNumber}</dd></div>
        <div><dt>{ar ? "الخطة" : "Plan"}</dt><dd dir="ltr">{cycle.plan.code} · v{cycle.plan.version}</dd></div>
        <div><dt>{ar ? "الفترة" : "Période"}</dt><dd dir="ltr">{subscriptionDateLabel(cycle.periodStart,locale)} — {subscriptionDateLabel(cycle.periodEnd,locale)}</dd></div>
        <div><dt>{ar ? "المبلغ" : "Montant"}</dt><dd dir="ltr">{formatMinor(cycle.amountMinor, cycle.currency, locale)}</dd></div>
        {cycle.paymentReference ? <div><dt>{ar ? "مرجع الدفع" : "Référence de paiement"}</dt><dd dir="ltr">{cycle.paymentReference}</dd></div> : null}
      </dl>
      <Link href={`/${locale}/client/finances${query}#documents-commerciaux`} className="client-text-link">{ar ? "عرض الفواتير والإشعارات الدائنة" : "Consulter les factures et avoirs"}</Link>
    </article>
  );
}
