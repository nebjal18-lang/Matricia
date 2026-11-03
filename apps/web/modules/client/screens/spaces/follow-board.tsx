import { SignedScopePendingNotice } from "@/modules/shared/ui/signed-scope-pending-notice";
import Link from "next/link";
import { ArrowRight, Bell, Calendar, ChevronRight, FileText, MessageSquare, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { canApplyClientSpaceDemo, demoClientSpaces } from "@/modules/client/data/spaces/demo";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { JourneyGlyph } from "@/modules/shared/ui/journey-glyph";
import type { ContractMissionDashboard } from "@/modules/shared/lib/contracts-missions/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function Cta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="client-ghost-link">
      {children}
      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

function formatDue(value: string | null, locale: Locale, fallback: string) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fallback;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    dateStyle: "medium",
    timeZone: "Africa/Casablanca",
  }).format(new Date(parsed));
}

function isTerminalMilestone(status: string) {
  return status === "ACCEPTED" || status === "DONE" || status === "COMPLETED" || status === "CANCELLED";
}

function isAwaitingDeliverable(status: string) {
  return status === "SUBMITTED" || status === "PENDING_ACCEPTANCE" || status === "IN_REVIEW";
}

export function FollowBoard({
  locale,
  query,
  organizationName,
  mission,
  children,
}: {
  locale: Locale;
  query: string;
  organizationName?: string | null;
  mission: ContractMissionDashboard["missions"][number] | null;
  children?: ReactNode;
}) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const preferDemo = canApplyClientSpaceDemo();
  const folders = mission
    ? [{ id: mission.id, title: organizationName ?? c.misTitle, status: mission.status, tone: "mint" as const, href: `/${locale}/client/missions/${mission.id}/jalons${query}` }]
    : preferDemo
      ? demo.requests.slice(0, 4).map((row) => ({ id: row.id, title: row.title, status: row.status, tone: row.tone, href: row.href }))
      : [];
  const steps = mission
    ? mission.milestones.map((item, index, all) => {
        const done = isTerminalMilestone(item.status);
        const current = !done && (index === 0 || all.slice(0, index).every((row) => isTerminalMilestone(row.status)));
        const detail = done
          ? (locale === "ar" ? "مكتمل" : "Terminé")
          : current
            ? c.inProgress
            : formatDue(item.dueAt, locale, c.comingSoon);
        return { id: item.id, title: item.title, detail, state: (done ? "done" : current ? "current" : "todo") as "done" | "current" | "todo" };
      })
    : preferDemo
      ? demo.missions.steps
      : [];
  const offerHref = `/${locale}/client/demandes${query}`;
  const offers = preferDemo && !mission ? demo.compareOffers.slice(0, 2) : [];
  const files = preferDemo && !mission ? demo.missions.files : (mission?.deliverables ?? []).map((item) => ({
    id: item.id,
    title: item.label,
    href: `/${locale}/client/missions/${mission!.id}/jalons${query}`,
    kind: "file" as const,
  }));

  const openMilestones = (mission?.milestones ?? []).filter((item) => !isTerminalMilestone(item.status));
  const awaitingDeliverables = (mission?.deliverables ?? []).filter((item) => isAwaitingDeliverable(item.status));
  const priorities: Array<{ id: string; href: string; label: string; chip: string; tone: "peach" | "violet" | "sky" }> = [];
  if (mission) {
    if (mission.signedScopePending) priorities.push({
      id: "signed-scope-preparation",
      href: `/${locale}/client/contrats${query}#contrat-${mission.contractId}`,
      label: locale === "ar" ? "تحضير التزامات الملحق الموقّع" : "Préparer les obligations de l’avenant signé",
      chip: c.actionRequired,
      tone: "violet",
    });
    if (awaitingDeliverables.length > 0) {
      priorities.push({
        id: "deliverable",
        href: `/${locale}/client/missions/${mission.id}/jalons${query}`,
        label: c.examineDeliverableNow,
        chip: c.awaiting,
        tone: "sky",
      });
    }
    if (openMilestones.length > 0) {
      priorities.push({
        id: "milestone",
        href: `/${locale}/client/missions/${mission.id}/jalons${query}`,
        label: openMilestones[0]!.title,
        chip: c.actionRequired,
        tone: "peach",
      });
    }
  } else if (preferDemo) {
    priorities.push(
      { id: "demo-bilan", href: `/${locale}/client/diagnostics${query}`, label: c.resumeBilan, chip: c.actionRequired, tone: "peach" },
      { id: "demo-offers", href: offerHref, label: c.compareOffers, chip: c.inProgress, tone: "violet" },
      { id: "demo-deliverable", href: `/${locale}/client/missions${query}`, label: c.examineDeliverableNow, chip: c.awaiting, tone: "sky" },
      { id: "demo-docs", href: `/${locale}/client/documents${query}`, label: c.completePiece, chip: c.toCompleteChip, tone: "peach" },
    );
  }
  const upcomingDeadlines = (mission?.milestones ?? [])
    .filter((item) => !isTerminalMilestone(item.status))
    .slice(0, 3);

  return (
    <main className="client-page client-follow-page">
      {mission ? <SignedScopePendingNotice pending={mission.signedScopePending} locale={locale} audience="client" contractId={mission.contractId} query={query} /> : null}
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.treatNow}</h2>
            <Link href={`/${locale}/client/missions${query}`} className="client-text-link">{c.seeAll}</Link>
          </header>
          {priorities.length === 0 ? <p>{c.emptyBoard}</p> : (
            <ul className="client-feed">
              {priorities.map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>
                    <span className="client-feed-icon" data-tone={item.tone}><FileText className="size-4" aria-hidden /></span>
                    <span>{item.label}</span>
                    <em><span className="client-status-chip" data-tone={item.tone}>{item.chip}</span></em>
                    <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.foldersNow}</h2>
            <Link href={`/${locale}/client/missions${query}`} className="client-text-link">{c.seeAll}</Link>
          </header>
          {folders.length === 0 ? <p>{locale === "ar" ? "لا ملف جارٍ للعرض." : "Aucun dossier en cours à afficher."}</p> : (
            <ul className="client-feed">
              {folders.map((row) => (
                <li key={row.id}>
                  <Link href={row.href}>
                    <span className="client-feed-icon" data-tone={row.tone} />
                    <span>{row.title}</span>
                    <em><span className="client-status-chip" data-tone={row.tone}>{row.status}</span></em>
                    <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
      <article className="client-card">
        <header className="client-priority-head">
          <h2>{c.myRequestsMissions}</h2>
          <Cta href={mission ? `/${locale}/client/missions/${mission.id}${query}` : `/${locale}/client/missions${query}`}>{c.openTheFolder}</Cta>
        </header>
        {steps.length === 0 ? <p>{c.emptyBoard}</p> : (
          <ol className="client-journey">
            {steps.map((step, index) => (
              <li key={step.id} data-state={step.state}>
                <span><JourneyGlyph index={index} /></span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </li>
            ))}
          </ol>
        )}
      </article>
      <article className="client-card">
        <header className="client-priority-head">
          <h2>{c.offersToCompare}</h2>
          <Link href={offerHref} className="client-text-link">{c.seeDetail}</Link>
        </header>
        {offers.length === 0 ? (
          <p>{c.compareLead}</p>
        ) : (
          <div className="client-table-wrap">
            <table className="client-space-table">
              <thead>
                <tr>
                  <th>{c.need}</th>
                  {offers.map((offer) => <th key={offer.slot}>{locale === "ar" ? `عرض ${offer.slot}` : `Offre ${offer.slot.toUpperCase()}`}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr><th>{locale === "ar" ? "النطاق" : "Périmètre"}</th>{offers.map((offer) => <td key={`${offer.slot}-p`}>{offer.tagline}</td>)}</tr>
                <tr><th>{c.durationLabel}</th>{offers.map((offer) => <td key={`${offer.slot}-d`}>{offer.weeks} {locale === "ar" ? "أسابيع" : "semaines"}</td>)}</tr>
                <tr><th>{c.exclusions}</th>{offers.map((offer) => <td key={`${offer.slot}-e`}>{offer.exclusions[0]}</td>)}</tr>
                <tr><th>{locale === "ar" ? "الشروط" : "Conditions"}</th>{offers.map((offer) => <td key={`${offer.slot}-c`}>{offer.guarantees}</td>)}</tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="client-next-action">
          <Link href={offerHref} className="client-next-action-link">
            <Scale className="size-4" aria-hidden />
            <span>{c.nextDecision} : {c.compareCta}</span>
            <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </div>
      </article>
      <section className="client-follow-triple">
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.documentsRenewals}</h2><Link href={`/${locale}/client/documents${query}`} className="client-text-link">{c.seeAll}</Link></header>
          {files.length === 0 ? <p>{c.emptyBoard}</p> : (
            <ul className="client-feed">
              {files.slice(0, 3).map((file) => (
                <li key={file.id}>
                  <Link href={file.href}>
                    <FileText className="size-4" aria-hidden />
                    <span>{file.title}</span>
                    <em><span className="client-status-chip" data-tone="peach">{c.toCompleteChip}</span></em>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.nextDeadlines}</h2><Link href={`/${locale}/client/missions${query}`} className="client-text-link">{c.seeAll}</Link></header>
          <ul className="client-feed">
            {upcomingDeadlines.map((item) => (
              <li key={item.id}>
                <span className="client-feed-icon" data-tone="sky"><Calendar className="size-4" aria-hidden /></span>
                <span>{item.title}</span>
                <em><span className="client-status-chip" data-tone="peach">{formatDue(item.dueAt, locale, c.comingSoon)}</span></em>
              </li>
            ))}
            {!mission && preferDemo ? demo.missions.steps.filter((step) => step.state !== "done").slice(0, 3).map((step) => (
              <li key={step.id}>
                <span className="client-feed-icon" data-tone="sky"><Calendar className="size-4" aria-hidden /></span>
                <span>{step.title}</span>
                <em><span className="client-status-chip" data-tone="peach">{c.comingSoon}</span></em>
              </li>
            )) : null}
            {upcomingDeadlines.length === 0 && !( !mission && preferDemo) ? (
              <li><span className="client-feed-icon" data-tone="sky"><Calendar className="size-4" aria-hidden /></span><span>{mission?.signedScopePending ? (locale === "ar" ? "تنتظر مواعيد الملحق تحضير العميل." : "Les échéances de l’avenant attendent la préparation du Client.") : c.emptyBoard}</span></li>
            ) : null}
          </ul>
        </article>
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.messagesNotifs}</h2><Link href={`/${locale}/messagerie${query}`} className="client-text-link">{c.seeAll}</Link></header>
          <ul className="client-feed">
            <li>
              <Link href={`/${locale}/messagerie${query}`}>
                <span className="client-feed-icon" data-tone="violet"><MessageSquare className="size-4" aria-hidden /></span>
                <span>{c.threadTitle}</span>
                <em className="client-notif-dot" aria-hidden><Bell className="size-4" /></em>
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/notifications${query}`}>
                <span className="client-feed-icon" data-tone="peach"><Bell className="size-4" aria-hidden /></span>
                <span>{c.notif}</span>
                <em>{c.open}</em>
              </Link>
            </li>
          </ul>
        </article>
      </section>
      {children}
    </main>
  );
}
