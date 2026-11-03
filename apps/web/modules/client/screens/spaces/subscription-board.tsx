import Link from "next/link";
import { Boxes, CreditCard, FileText, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { type SubscriptionDashboard } from "@/modules/shared/lib/subscriptions/model";
import {formatMinorExact as formatMinor} from "@/modules/shared/lib/solution-insights/model";
import {workflowStatusLabel} from "@/modules/shared/lib/i18n/workflow-statuses";
import {subscriptionDateLabel} from "../abonnement/display";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type SubscriptionCreditsView = {
  balance: string;
  unitCode: string;
  memberCount: number | null;
  available?: boolean;
  boxes: Array<{ id: string; name: string; budget: string; href: string }>;
  operations: Array<{ id: string; title: string; quantity: string; href: string }>;
};

export function SubscriptionBoard({
  locale,
  query,
  dashboard,
  credits,
  children,
}: {
  locale: Locale;
  query: string;
  dashboard: SubscriptionDashboard;
  credits: SubscriptionCreditsView;
  children?: ReactNode;
}) {
  const c = spaceCopy(locale);
  const subscription = dashboard.subscription;
  const plan = subscription?.currentPlan;
  const cycles = subscription?.cycles ?? [];
  const unavailable = locale === "ar" ? "غير متاح" : "Non disponible";
  return (
    <main className="client-page">
      <nav className="client-tabs" aria-label={c.subPageTitle}>
        <a href="#abonnement" aria-current="page">{c.mySub}</a>
        <a href="#factures">{c.paymentsTab}</a>
        <a href="#credits">{c.myCredits}</a>
        <a href="#boxes">{c.boxesTab}</a>
      </nav>
      <section className="client-board client-board-compare" id="abonnement">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.mySub}</h2>
            {subscription ? <span className="client-status-chip" data-tone="mint">{workflowStatusLabel(subscription.status,locale)}</span> : null}
          </header>
          <h3>{plan ? `${plan.code} · v${plan.version}` : dashboard.organizationName}</h3>
          {subscription?.currentPeriodEnd ? <p>{locale === "ar" ? "التجديد" : "Renouvellement"}: {subscriptionDateLabel(subscription.currentPeriodEnd,locale)}</p> : null}
          <a href="#plans" className="client-cta">{c.manageSub}</a>
        </article>
        <article className="client-card">
          <header><h2>{c.inBrief}</h2></header>
          <ul className="client-brief-kpis">
            <li className="client-kpi-card"><span className="client-feed-icon" data-tone="violet"><Users className="size-4" aria-hidden /></span><strong dir="auto">{credits.memberCount ?? unavailable}</strong><small>{c.usersActive}</small></li>
            <li className="client-kpi-card"><span className="client-feed-icon" data-tone="sky"><FileText className="size-4" aria-hidden /></span><strong dir="ltr">{cycles.length}</strong><small>{locale==="fr"?"Cycles comptabilisés":"الدورات المسجلة"}</small></li>
            <li className="client-kpi-card"><span className="client-feed-icon" data-tone="mint"><CreditCard className="size-4" aria-hidden /></span><strong dir="ltr">{credits.balance}</strong><small>{c.creditsAvailable} · {credits.unitCode}</small></li>
            <li className="client-kpi-card"><span className="client-feed-icon" data-tone="peach"><Boxes className="size-4" aria-hidden /></span><strong dir="auto">{credits.available === false ? unavailable : credits.boxes.length}</strong><small>{c.boxesAvailable}</small></li>
          </ul>
        </article>
      </section>
      <section className="client-board client-board-compare" id="factures">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{locale==="fr"?"Derniers cycles comptabilisés":"آخر الدورات المسجلة"}</h2>
            <Link href={`/${locale}/client/finances${query}#documents-commerciaux`} className="client-text-link">{c.seeAllFin}</Link>
          </header>
          {cycles.length === 0 ? <p>{locale === "ar" ? "لا توجد دورة فوترة بعد." : "Aucun cycle de facturation pour le moment."}</p> : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead><tr><th>{locale === "ar" ? "التاريخ" : "Date"}</th><th>{locale === "ar" ? "الخطة" : "Plan"}</th><th>{locale === "ar" ? "المبلغ" : "Montant"}</th><th /></tr></thead>
                <tbody>
                  {cycles.slice(0, 6).map((cycle) => (
                    <tr key={cycle.id}>
                      <td>{subscriptionDateLabel(cycle.periodEnd,locale)}</td>
                      <td dir="ltr">{cycle.plan.code} · v{cycle.plan.version}</td>
                      <td dir="ltr">{formatMinor(cycle.amountMinor, cycle.currency, locale)}</td>
                      <td><Link href={`/${locale}/client/abonnement/cycles/${cycle.id}${query}`} className="client-text-link">{locale==="fr"?"Voir le cycle":"عرض الدورة"}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
      <section className="client-board client-board-compare" id="credits">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.myCredits}</h2>
            <Link href={`/${locale}/client/credits${query}`} className="client-text-link">{c.seeAll}</Link>
          </header>
          <p>{c.creditExplain}</p>
          <p><strong dir="ltr">{credits.balance} {credits.unitCode}</strong></p>
          {credits.operations.length === 0 ? null : (
            <ul className="client-feed">
              {credits.operations.slice(0, 4).map((item) => (
                <li key={item.id}><Link href={item.href}><span>{item.title}</span><em dir="ltr">{item.quantity}</em></Link></li>
              ))}
            </ul>
          )}
          <Link href={`/${locale}/client/credits${query}`} className="client-cta">{c.seeCredits}</Link>
        </article>
        <article className="client-card" id="boxes">
          <header className="client-priority-head">
            <h2>{c.myBoxes}</h2>
            <Link href={`/${locale}/client/credits${query}`} className="client-text-link">{c.seeAllBoxes}</Link>
          </header>
          {credits.available === false ? <p role="alert">{locale === "ar" ? "تعذر تحميل الصناديق والأرصدة في نطاق صلاحياتكم. أعيدوا المحاولة عبر صفحة الأرصدة." : "Les Box et crédits ne peuvent pas être chargés dans votre périmètre d’accès. Réessayez depuis la page des crédits."}</p> : credits.boxes.length === 0 ? <p>{locale === "ar" ? "لا صندوق ظاهر لهذه المؤسسة." : "Aucune Box visible pour cette organisation."}</p> : (
            <ul className="client-feed">
              {credits.boxes.map((box) => (
                <li key={box.id}><Link href={box.href}><Boxes className="size-4" aria-hidden /><span>{box.name}</span><em dir="ltr">{box.budget}</em></Link></li>
              ))}
            </ul>
          )}
        </article>
      </section>
      <section className="client-board">
        <article className="client-card">
          <p><Sparkles className="size-4" aria-hidden /> {c.moreThanSub}</p>
          <p>{c.creditKnowHow}</p>
          <Link href={`/${locale}/contact${query}`} className="client-soft-link">{c.contactAssist}</Link>
        </article>
      </section>
      <div id="plans">{children}</div>
    </main>
  );
}
