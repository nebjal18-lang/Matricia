import Link from "next/link";
import { CheckCircle2, FileText, Leaf, Shield, Users } from "lucide-react";
import type { ReactNode } from "react";
import { canApplyClientSpaceDemo, demoClientSpaces } from "@/modules/client/data/spaces/demo";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { MilestoneDecisionForm } from "@/modules/client/screens/missions/milestone-decision-form";
import type { MissionMessages } from "@/modules/client/screens/missions/messages";
import type { ContractMissionDashboard } from "@/modules/shared/lib/contracts-missions/model";
import { AssistanceCue } from "@/modules/client/screens/diagnostics/assistance-cue";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function toneFor(state: "done" | "current" | "todo") {
  if (state === "done") return "mint" as const;
  if (state === "current") return "violet" as const;
  return "peach" as const;
}

function milestoneState(status: string): "done" | "current" | "todo" {
  if (status === "ACCEPTED" || status === "DONE" || status === "COMPLETED") return "done";
  if (status === "SUBMITTED" || status === "IN_REVIEW" || status === "IN_PROGRESS") return "current";
  return "todo";
}

function statusLabel(state: "done" | "current" | "todo", status: string, locale: Locale, c: ReturnType<typeof spaceCopy>) {
  if (state === "done") return locale === "ar" ? "مصادق" : "Validé";
  if (state === "current") {
    if (status === "SUBMITTED" || status === "IN_REVIEW") return locale === "ar" ? "قيد المراجعة" : "En revue";
    return c.inProgress;
  }
  return c.comingSoon;
}

export function JalonsBoard({
  locale,
  query,
  organizationName,
  mission,
  messages,
  assistanceHref,
  children,
}: {
  locale: Locale;
  query: string;
  organizationName?: string | null;
  mission: ContractMissionDashboard["missions"][number] | null;
  messages: MissionMessages;
  assistanceHref?: string;
  children?: ReactNode;
}) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const preferDemo = canApplyClientSpaceDemo() && (!mission || mission.milestones.length === 0);
  const jalons = preferDemo
    ? demo.jalons
    : (mission?.milestones ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        due: item.dueAt ? new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(item.dueAt)) : "—",
        status: item.status,
        state: milestoneState(item.status),
      }));
  const selected = jalons.find((item) => item.state === "current") ?? jalons[0] ?? null;
  const selectedLive = mission?.milestones.find((item) => item.id === selected?.id) ?? null;
  const files = preferDemo ? demo.jalonFiles : (mission?.deliverables ?? []).map((item) => ({
    id: item.id,
    title: item.label,
    file: item.label,
    kind: "file" as const,
    scan: item.proofScanStatus === "CLEAN" ? "ok" as const : "wait" as const,
    href: `/${locale}/client/documents${query}`,
  }));
  const submittedCount = files.filter((file) => file.scan === "ok").length;
  const progressPct = files.length === 0 ? 0 : Math.round((submittedCount / files.length) * 100);
  const started = mission?.startedAt
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(mission.startedAt))
    : "—";
  const ended = mission?.completedAt
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(mission.completedAt))
    : "—";
  const selectedIndex = selected ? jalons.findIndex((item) => item.id === selected.id) + 1 : 0;

  return (
    <main className="client-page">
      <article className="client-card client-mission-mast">
        <div className="client-mission-mast-lead">
          <span className="client-feed-icon" data-tone="mint"><Leaf className="size-4" aria-hidden /></span>
          <div>
            <h2>{organizationName ?? (locale === "ar" ? "المهمة الجارية" : "Mission en cours")}</h2>
            <p>{c.misLead}</p>
          </div>
        </div>
        <div className="client-mission-mast-meta">
          <span className="client-status-chip" data-tone="mint">{c.inProgress}</span>
          <p dir="ltr">{started} → {ended}</p>
        </div>
        <div>
          <strong>{c.participants}</strong>
          <p className="client-mission-participants"><Users className="size-4" aria-hidden /> {c.yourCompany} · {c.matriciaTeam} · {c.partners}</p>
        </div>
        <div className="client-mission-mast-foot">
          <span className="client-status-chip" data-tone="mint">{c.contractSigned}</span>
          <span className="client-access-note"><Shield className="size-4" aria-hidden />{c.immutableVersion}</span>
          {mission ? <Link href={`/${locale}/client/missions/${mission.id}${query}`} className="client-text-link">{c.seeAmendment}</Link> : null}
        </div>
      </article>
      {assistanceHref ? <AssistanceCue locale={locale} href={assistanceHref} context="milestone" /> : null}
      <nav className="client-tabs" aria-label={c.jalonsTitle}>
        <a href="#jalons" aria-current="page">{c.tabJalons}</a>
        <Link href={mission ? `/${locale}/client/missions/${mission.id}${query}` : `/${locale}/client/missions${query}`}>{c.tabMission}</Link>
        <Link href={`/${locale}/client/documents${query}`}>{c.docsTab}</Link>
        <Link href={`/${locale}/messagerie${query}`}>{c.messagesTab}</Link>
        <a href="#jalon-history">{c.tabHistory}</a>
      </nav>
      <section className="client-dispute-layout" id="jalons">
        <article className="client-card">
          <ol className="client-mediation client-jalon-rail">
            {jalons.map((item, index) => (
              <li key={item.id} data-state={item.state} data-selected={selected?.id === item.id ? "true" : undefined}>
                <span className="client-jalon-marker" aria-hidden>
                  {item.state === "done" ? <CheckCircle2 className="size-4" /> : <span>{index + 1}</span>}
                </span>
                <span>
                  <strong>{locale === "ar" ? `المرحلة ${index + 1}` : `Jalon ${index + 1}`} — {item.title}</strong>
                  <small>{c.dueOn} : {item.due}</small>
                </span>
                <span className="client-status-chip" data-tone={toneFor(item.state)}>{statusLabel(item.state, item.status, locale, c)}</span>
              </li>
            ))}
          </ol>
        </article>
        <article className="client-card">
          {selected ? (
            <>
              <header className="client-priority-head">
                <div>
                  <h2>{locale === "ar" ? `المرحلة ${selectedIndex}` : `Jalon ${selectedIndex}`} — {selected.title}</h2>
                  <p>{c.dueOn} : {selected.due}</p>
                </div>
                <span className="client-status-chip" data-tone={toneFor(selected.state)}>{statusLabel(selected.state, selected.status, locale, c)}</span>
              </header>
              <div className="client-jalon-progress" aria-label={locale === "ar" ? "تقدم التسليمات" : "Progression des livrables"}>
                <p>{locale === "ar" ? `${submittedCount} من ${files.length} تسليمات` : `${submittedCount} sur ${files.length} livrables soumis`}</p>
                <div className="client-jalon-progress-track"><span style={{ width: `${progressPct}%` }} /></div>
                <strong dir="ltr">{progressPct} %</strong>
              </div>
              <h3>{c.deliverablesOf}</h3>
              <div className="client-table-wrap">
                <table className="client-space-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{c.docsTitle}</th>
                      <th>{locale === "ar" ? "ملف / إثبات" : "Fichier / preuve"}</th>
                      <th>{locale === "ar" ? "حالة الفحص" : "Statut de scan"}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, index) => (
                      <tr key={file.id}>
                        <td dir="ltr">{index + 1}</td>
                        <td><span className="client-doc-cell"><FileText className="size-4" aria-hidden />{file.title}</span></td>
                        <td>{file.file}</td>
                        <td><span className="client-status-chip" data-tone={file.scan === "ok" ? "mint" : "peach"}>{file.scan === "ok" ? c.scanOk : c.scanWait}</span></td>
                        <td><Link href={file.href} className="client-text-link">{c.open}</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href={`/${locale}/client/documents${query}`} className="client-ghost-link client-add-file">{c.addFile}</Link>
              <div className="client-jalon-split">
                <div id="jalon-history" className="client-jalon-comments">
                  <h3>{c.commentsOnJalon}</h3>
                  {selectedLive ? <MilestoneDecisionForm milestone={selectedLive} locale={locale} messages={messages} /> : (
                    <p className="client-access-note">{c.jalonHistory}</p>
                  )}
                </div>
                <div className="client-jalon-history">
                  <h3>{c.jalonHistory}</h3>
                  <ol className="client-mediation">
                    <li data-state="done"><span><strong>{c.contractSigned}</strong><small>{started}</small></span></li>
                    <li data-state={selected.state === "done" ? "done" : "current"}><span><strong>{selected.title}</strong><small>{selected.due}</small></span></li>
                  </ol>
                </div>
              </div>
              <div className="client-jalon-actions">
                {selectedLive && selectedLive.status === "SUBMITTED" ? (
                  <p className="client-access-note">{locale === "ar" ? "سجّلوا قراركم في النموذج أعلاه." : "Enregistrez votre décision dans le formulaire ci-dessus."}</p>
                ) : (
                  <p className="client-access-note">{locale === "ar" ? "لا يوجد قرار معلّق على هذا المعلم." : "Aucune décision en attente sur ce jalon."}</p>
                )}
                <Link href={`/${locale}/messagerie${query}`} className="client-jalon-btn" data-tone="peach">{c.requestChanges}</Link>
              </div>
            </>
          ) : <p>{messages.empty}</p>}
        </article>
      </section>
      {children}
    </main>
  );
}
