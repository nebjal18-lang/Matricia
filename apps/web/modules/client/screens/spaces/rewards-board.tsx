import Link from "next/link";
import { Award, Gift, Leaf, Link2, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import type { RewardsDashboard } from "@/modules/shared/lib/rewards-referrals-roi/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function formatBps(value: string) {
  const amount = BigInt(value);
  const negative = amount < BigInt(0);
  const absolute = negative ? -amount : amount;
  const whole = absolute / BigInt(100);
  const fraction = (absolute % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function RewardsBoard({
  locale,
  query,
  dashboard,
  children,
}: {
  locale: Locale;
  query: string;
  dashboard: RewardsDashboard;
  children?: ReactNode;
}) {
  const c = spaceCopy(locale);
  const conversions = dashboard.conversions;
  const link = dashboard.links.find((item) => item.status === "ACTIVE" && item.audience_type === "CLIENT");
  const snapshot = dashboard.roiSnapshots[0];
  const stageLabels = locale === "ar" ? {REGISTERED:"مسجّل",PROFILE_STARTED:"الملف قيد الإعداد",VERIFIED:"تم التحقق",ACTIVE:"مفعّل",REJECTED:"مرفوض",CANCELLED:"ملغى"} : {REGISTERED:"Inscrit",PROFILE_STARTED:"Dossier en préparation",VERIFIED:"Vérifié",ACTIVE:"Activé",REJECTED:"Refusé",CANCELLED:"Annulé"};
  const stageLabel = (value:string) => stageLabels[value as keyof typeof stageLabels] ?? (locale === "ar" ? "حالة غير معروفة" : "État non reconnu");
  const inviteHref = `/${locale}/client/recompenses${query}#regles`;
  const ambassador = conversions.some((item) => item.conversion_stage === "ACTIVE");
  const engaged = dashboard.grants.length > 0;
  const referralGranted = dashboard.referralRewardStatuses?.some((item) => item.state === "GRANTED") ?? false;
  const referralPending = dashboard.referralRewardStatuses?.some((item) => item.state === "APPROVED_PENDING_EXECUTION") ?? false;
  return (
    <main className="client-page">
      <section className="client-board client-board-compare">
        <article className="client-card" id="badges">
          <header className="client-priority-head">
            <h2>{c.badgesTitle}</h2>
            <a href="#badges" className="client-text-link" aria-current="page">{c.seeBadges}</a>
          </header>
          <ul className="client-brief-kpis">
            <li className="client-kpi-card"><span className="client-feed-icon" data-tone="mint"><Award className="size-4" aria-hidden /></span><strong>{c.ambassador}</strong><small>{ambassador ? c.obtained : c.inProgressBadge}</small></li>
            <li className="client-kpi-card"><span className="client-feed-icon" data-tone="violet"><Gift className="size-4" aria-hidden /></span><strong>{c.engagedClient}</strong><small>{engaged ? c.obtained : c.inProgressBadge}</small></li>
            <li className="client-kpi-card"><span className="client-feed-icon" data-tone="sky"><Leaf className="size-4" aria-hidden /></span><strong>{c.impactActor}</strong><small>{snapshot ? c.obtained : c.inProgressBadge}</small></li>
          </ul>
          <p className="client-access-note">{c.clearCriteria}</p>
        </article>
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.inviteNetwork}</h2>
            <a href="#regles" className="client-text-link">{c.howItWorks}</a>
          </header>
          <p>{c.inviteNetworkLead}</p>
          <ol className="client-journey">
            <li data-state={link ? "done" : "current"}><span>1</span><small>{locale === "ar" ? "مدعو" : "Invité"}</small></li>
            <li data-state={conversions.some((item) => item.conversion_stage !== "REGISTERED") ? "done" : conversions.length > 0 ? "current" : "todo"}><span>2</span><small>{locale === "ar" ? "مسجّل" : "Inscrit"}</small></li>
            <li data-state={conversions.some((item) => item.conversion_stage === "VERIFIED" || item.conversion_stage === "ACTIVE") ? "current" : "todo"}><span>3</span><small>{locale === "ar" ? "مؤهل" : "Éligible"}</small></li>
            <li data-state={referralGranted ? "done" : referralPending ? "current" : "todo"}><span>4</span><small>{locale === "ar" ? "مكافأة" : "Récompense"}</small></li>
          </ol>
          {referralPending ? <p role="status" className="client-access-note">{locale === "ar" ? "تمت الموافقة على المكافأة؛ إصدار الرصيد ينتظر معالجة فريق المالية." : "Récompense approuvée ; émission des crédits en attente de traitement par la finance."}</p> : null}
          <p><Link2 className="size-4" aria-hidden /> {c.inviteLink}</p>
          <p dir="ltr">{link ? <Link className="underline break-all" href={`/${locale}/invitation/${encodeURIComponent(link.referral_code)}`}>{`/${locale}/invitation/${link.referral_code}`}</Link> : (locale === "ar" ? "يُنشأ الرابط بعد تفعيل رمز إحالة." : "Le lien apparaît après création d’un code d’invitation.")}</p>
          {link ? (
            <p className="client-access-note" role="status">
              {locale === "ar" ? "شاركوا رابط الدعوة أعلاه مع جهة الاتصال." : "Partagez le lien d’invitation ci-dessus avec votre contact."}
            </p>
          ) : (
            <Link href={inviteHref} className="client-cta"><Share2 className="size-4" aria-hidden />{c.inviteContact}</Link>
          )}
        </article>
      </section>
      <section className="client-board client-board-compare">
        <article className="client-card" id="parrainages">
          <header className="client-priority-head">
            <h2>{c.referralStatus}</h2>
            <span className="client-text-link" aria-hidden>{c.seeHistory}</span>
          </header>
          {conversions.length === 0 ? <p>{locale === "ar" ? "لا إحالات ظاهرة بعد." : "Aucun parrainage visible pour le moment."}</p> : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead><tr><th>{locale === "ar" ? "المرحلة" : "Étape"}</th><th>{c.status}</th><th /></tr></thead>
                <tbody>
                  {conversions.slice(0, 6).map((item) => (
                    <tr key={item.id}>
                      <td>{stageLabel(item.conversion_stage)}</td>
                      <td><span className="client-status-chip" data-tone="mint">{stageLabel(item.conversion_stage)}</span></td>
                      <td><span className="client-access-note" dir="ltr">{item.id.slice(0, 8)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
        <article className="client-card" id="roi">
          <header><h2>{c.savingsRoi}</h2></header>
          {snapshot ? (
            <dl className="client-fact-grid">
              <div><small>{c.savingsRoi}</small><span dir="ltr">{formatMinor(snapshot.net_value_minor, snapshot.currency, locale)}</span></div>
              <div><small>ROI</small><span dir="ltr">{formatBps(snapshot.roi_basis_points)} %</span></div>
              <div><small>{c.calcMethod}</small><span dir="ltr">{snapshot.formula_version}</span></div>
            </dl>
          ) : <p>{locale === "ar" ? "يُحتسب العائد بعد اعتماد قاعدة قياس." : "Le ROI s’affiche après validation d’une base de mesure."}</p>}
          <p className="client-access-note">{c.dataSources}</p>
          <a href="#roi" className="client-ghost-link">{c.calcMethod}</a>
        </article>
      </section>
      <article className="client-quote-banner">
        <div>
          <h2>{c.togetherFurther}</h2>
          <p>{c.togetherLead}</p>
        </div>
      </article>
      <div id="regles">{children}</div>
    </main>
  );
}
