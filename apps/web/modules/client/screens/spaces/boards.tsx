import { getClientRfqMessages } from "@/modules/client/screens/demandes/messages";
import Link from "next/link";
import { ArrowRight, Briefcase, Cloud, FileText, Filter, Folder, Goal, MessageSquare, Plus, Scale, Search, Target } from "lucide-react";
import type { ReactNode } from "react";
import { canApplyClientSpaceDemo } from "@/modules/client/data/spaces/demo";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { demoClientSpaces } from "@/modules/client/data/spaces/demo";
import { OrganizationTabs } from "./organization-tabs";
import { JourneyGlyph } from "@/modules/shared/ui/journey-glyph";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function Cta({
  href,
  children,
  soft = false,
  tone,
}: {
  href: string;
  children: ReactNode;
  soft?: boolean;
  tone?: "violet" | "peach" | "mint" | "sky";
}) {
  const className = tone && !soft ? "client-kpi-cta" : soft ? "client-soft-link" : "client-ghost-link";
  return (
    <Link href={href} className={className} data-tone={tone}>
      {children}
      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

const PRIORITY_TONES = ["peach", "violet", "sky"] as const;

function FileGlyph({ kind }: { kind: "pdf" | "docx" | "xlsx" | "file" | "message" | "folder" }) {
  const label = kind === "pdf" ? "PDF" : kind === "docx" ? "W" : kind === "xlsx" ? "X" : kind === "message" ? "M" : kind === "folder" ? "D" : "F";
  return <span className="client-file-glyph" data-kind={kind} aria-hidden>{label}</span>;
}

function stepStateLabel(state: "done" | "current" | "todo" | "upcoming", locale: Locale) {
  if (state === "done") return locale === "ar" ? "منجز" : "Terminé";
  if (state === "current") return locale === "ar" ? "قيد الانتظار" : "En attente";
  return locale === "ar" ? "للمعالجة" : "À traiter";
}

export type DiagnosticFinding = {
  id: string;
  title: string;
  severity: string;
  blocking: boolean;
  action: string;
  why: string;
  impact?: string;
  href: string;
  cta?: "plan" | "need";
};

export type DiagnosticOpportunityCard = {
  id: string;
  title: string;
  status: string;
  href: string;
};

export type DiagnosticContinuity = {
  evolution: Array<{ libraryCode: string; score: string; delta: string | null; href: string }>;
  expiredAnswerCount: number;
  expiringAnswerCount: number;
  questionnaireHref: string;
  proposedCount: number;
  reassessmentCount: number;
  assistanceHref: string;
  solutionsHref: string;
};

export function DiagnosticsBoard({
  locale,
  questionnaireHref,
  evolutionHref,
  score,
  ratingLabel,
  libraryScores,
  findings,
  opportunities,
  runs,
  hasSubmittedAssessment,
  organizationName,
  continuity,
}: {
  locale: Locale;
  questionnaireHref: string;
  evolutionHref: string;
  score: string | null;
  ratingLabel: string | null;
  libraryScores: Array<{ key: string; score: string }>;
  findings: DiagnosticFinding[];
  opportunities: DiagnosticOpportunityCard[];
  runs: Array<{ id: string; title: string; href: string }>;
  hasSubmittedAssessment: boolean;
  organizationName?: string | null;
  continuity?: DiagnosticContinuity;
}) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, "");
  const analyseHref = evolutionHref;
  const preferDemo = canApplyClientSpaceDemo() && findings.length === 0;
  const priorities = preferDemo
    ? demo.priorities.map((row) => ({
        id: row.id,
        title: row.title,
        constat: row.constat,
        impact: row.impact,
        action: row.action,
        why: row.why,
        href: row.href,
        cta: row.cta,
      }))
    : findings.map((row) => ({
        id: row.id,
        title: row.title,
        constat: `${row.severity}${row.blocking ? ` · ${locale === "ar" ? "إجراء مطلوب" : "Action requise"}` : ""}`,
        impact: row.impact ?? (row.blocking ? (locale === "ar" ? "يعيق التقدم الحالي" : "Bloque l’avancement actuel") : (locale === "ar" ? "يتطلب متابعة" : "À surveiller")),
        action: row.action,
        why: row.why,
        href: row.href,
        cta: row.cta ?? "plan" as const,
      }));
  const shownRuns = runs.length > 0 ? runs : preferDemo ? demo.runs : [];
  const understood = preferDemo
    ? demo.understood
    : {
        activity: organizationName?.trim() || c.activity,
        objectives: findings[0]?.action || c.objectives,
        attention: (findings.find((row) => row.blocking) ?? findings[0])?.title || c.attention,
      };
  return (
    <main className="client-page">
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header>
            <h2>
              <Target className="size-4" aria-hidden />
              {c.diagNow}
            </h2>
            {score ? (
              <p>
                <strong dir="ltr">{score}/100</strong>
                {ratingLabel ? ` · ${ratingLabel}` : ""}
              </p>
            ) : (
              <p>{c.diagNowLead}</p>
            )}
          </header>
          {libraryScores.length > 0 ? (
            <dl className="client-fact-grid">
              {libraryScores.map((item) => (
                <div key={item.key}>
                  <small>{item.key}</small>
                  <span dir="ltr">{item.score}/100</span>
                </div>
              ))}
            </dl>
          ) : null}
          {priorities.length === 0 ? (
            <div className="client-offer-actions">
              <Cta href={questionnaireHref} soft>
                {c.startQuestionnaire}
              </Cta>
              {hasSubmittedAssessment ? <Cta href={analyseHref}>{c.computeAnalysis}</Cta> : null}
            </div>
          ) : (
            priorities.map((row, index) => {
              const tone = PRIORITY_TONES[index % PRIORITY_TONES.length];
              return (
                <div key={row.id} className="client-priority-card" data-tone={tone}>
                  <div className="client-priority-head">
                    <strong>
                      <span className="client-num" data-tone={tone}>
                        {index + 1}
                      </span>
                      {row.title}
                    </strong>
                    <Cta href={row.href} soft tone={tone}>
                      {row.cta === "need" ? c.describeNeed : c.seePlan}
                    </Cta>
                  </div>
                  <dl className="client-fact-grid">
                    <div>
                      <small>{c.constat}</small>
                      <span>{row.constat}</span>
                    </div>
                    <div>
                      <small>{c.impact}</small>
                      <span>{row.impact}</span>
                    </div>
                    <div>
                      <small>{c.recommended}</small>
                      <span>{row.action}</span>
                    </div>
                    <div>
                      <small>{c.why}</small>
                      <span>{row.why}</span>
                    </div>
                  </dl>
                </div>
              );
            })
          )}
        </article>
        <div className="client-stack">
          <article className="client-card">
            <header>
              <h2>{c.understood}</h2>
            </header>
            <p>{c.understoodLead}</p>
            <ul className="client-feed">
              <li>
                <span className="client-feed-icon" data-tone="violet">
                  <Briefcase className="size-4" aria-hidden />
                </span>
                <span>
                  <strong>{c.activity}</strong>
                  <small>{understood.activity}</small>
                </span>
              </li>
              <li>
                <span className="client-feed-icon" data-tone="sky">
                  <Target className="size-4" aria-hidden />
                </span>
                <span>
                  <strong>{c.objectives}</strong>
                  <small>{understood.objectives}</small>
                </span>
              </li>
              <li>
                <span className="client-feed-icon" data-tone="mint">
                  <Goal className="size-4" aria-hidden />
                </span>
                <span>
                  <strong>{c.attention}</strong>
                  <small>{understood.attention}</small>
                </span>
              </li>
            </ul>
            <div className="client-offer-actions">
              <Cta href={questionnaireHref}>{c.modify}</Cta>
              <Cta href={analyseHref} soft>
                {c.validate}
              </Cta>
            </div>
          </article>
          <article className="client-card client-resume-card">
            <header>
              <h2>{c.resume}</h2>
            </header>
            <p>{c.resumeLead}</p>
            <Cta href={questionnaireHref} soft>
              {c.continue}
            </Cta>
            <div className="client-quote-art" aria-hidden />
          </article>
          <article className="client-card">
            <header>
              <h2>{c.myRuns}</h2>
            </header>
            <p>{c.myRunsLead}</p>
            {shownRuns.length === 0 ? (
              <Cta href={questionnaireHref} soft>
                {c.startQuestionnaire}
              </Cta>
            ) : (
              <ul className="client-feed">
                {shownRuns.map((run) => (
                  <li key={run.id}>
                    <Link href={run.href}>
                      <FileText className="size-4" aria-hidden />
                      <span>{run.title}</span>
                      <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Cta href={evolutionHref} soft>
              {locale === "ar" ? "تطور التشخيصات" : "Évolution des diagnostics"}
            </Cta>
          </article>
          {continuity ? (
            <article className="client-card">
              <header><h2>{c.continuity}</h2></header>
              {continuity.evolution.length > 0 ? (
                <ul className="client-feed">
                  {continuity.evolution.map((item) => (
                    <li key={item.libraryCode}>
                      <Link href={item.href}>
                        <span>
                          <strong dir="ltr">{item.libraryCode}</strong>
                          <small dir="ltr">{item.score}/100 · {item.delta ?? c.firstEvolution}</small>
                        </span>
                        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {continuity.expiredAnswerCount > 0 ? (
                <p role="alert">
                  <bdi dir="ltr">{continuity.expiredAnswerCount}</bdi> · {c.revalidateExpired}
                </p>
              ) : continuity.expiringAnswerCount > 0 ? (
                <p role="status">
                  <bdi dir="ltr">{continuity.expiringAnswerCount}</bdi> · {c.expiringAnswers}
                </p>
              ) : null}
              {continuity.reassessmentCount > 0 ? (
                <p role="status">
                  <bdi dir="ltr">{continuity.reassessmentCount}</bdi> · {c.profileChange}
                </p>
              ) : null}
              {continuity.proposedCount > 0 ? (
                <p role="status">
                  <bdi dir="ltr">{continuity.proposedCount}</bdi> · {c.proposedAssistance}
                </p>
              ) : null}
              <div className="client-offer-actions">
                {continuity.expiredAnswerCount > 0 || continuity.expiringAnswerCount > 0 ? <Cta href={continuity.questionnaireHref}>{c.revalidateExpired}</Cta> : null}
                <Cta href={continuity.solutionsHref} soft>{c.compareSolutions}</Cta>
                <Cta href={continuity.assistanceHref} soft>{c.openAssistance}</Cta>
              </div>
            </article>
          ) : null}
          {opportunities.length > 0 ? (
            <article className="client-card">
              <header><h2>{locale === "ar" ? "فرص قابلة للتحويل" : "Opportunités convertibles"}</h2></header>
              <ul className="client-feed">
                {opportunities.map((item) => (
                  <li key={item.id}><Link href={item.href}><span>{item.title}</span><small>{item.status}</small><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link></li>
                ))}
              </ul>
            </article>
          ) : null}
        </div>
      </section>
      <article className="client-quote-banner">
        <div>
          <h2>{c.pace}</h2>
          <p>{c.paceLead}</p>
        </div>
        <blockquote>{c.quote}</blockquote>
      </article>
    </main>
  );
}


export function RequestsBoard({ locale, query, compareHref, rows, searchQuery, statusFilter }: { locale: Locale; query: string; compareHref: string; searchQuery?: string; statusFilter?: string; rows: Array<{ id: string; title: string; status: string; last: string; next: string; href: string; tone: "violet" | "sky" | "mint" | "peach" }>; organizationName?: string | null }) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const demoOn = canApplyClientSpaceDemo();
  const list = demoOn ? demo.requests : rows;
  const kpis = demoOn
    ? demo.requestKpis
    : [
        { id: "k1", title: c.toComplete, detail: rows.filter((row) => row.tone === "violet" || row.tone === "peach").length ? String(rows.filter((row) => row.tone === "violet" || row.tone === "peach").length) : c.emptyBoard, href: `/${locale}/client/documents${query}`, tone: "peach" as const },
        { id: "k2", title: c.offersToCompare, detail: rows.filter((row) => row.tone === "mint").length ? String(rows.filter((row) => row.tone === "mint").length) : c.emptyBoard, href: compareHref, tone: "violet" as const },
        { id: "k3", title: c.questions, detail: c.msgTitle, href: `/${locale}/messagerie${query}`, tone: "mint" as const },
      ];
  return (
    <main className="client-page">
      <section className="client-space-kpis">
        {kpis.map((kpi) => (
          <Link key={kpi.id} href={kpi.href} className="client-card client-insight">
            <span className="client-feed-icon" data-tone={kpi.tone}><FileText className="size-4" aria-hidden /></span>
            <div><h3>{kpi.title}{kpi.id !== "k3" ? <small className="block">{locale === "fr" ? "Sur cette page" : "في هذه الصفحة"}</small> : null}</h3><p>{kpi.detail}</p></div>
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        ))}
      </section>
      <section className="client-board client-board-compare">
        <article className="client-card" id="filtres">
          <header>
            <h2>{c.allRequests}</h2>
            <form method="get" className="client-table-tools">
              {new URLSearchParams(query).get("organizationId")?<input type="hidden" name="organizationId" value={new URLSearchParams(query).get("organizationId")!}/>:null}
              <label className="client-top-search">
                <Search className="size-4" aria-hidden />
                <span className="sr-only">{c.searchRequest}</span>
                <input name="q" defaultValue={searchQuery} maxLength={200} placeholder={c.searchRequest} />
              </label>
              <label className="client-status-filter">
                <span className="sr-only">{c.allStatuses}</span>
                <select defaultValue={statusFilter??""} name="statut">
                  <option value="">{c.allStatuses}</option>
                  {Object.entries(getClientRfqMessages(locale).statuses).map(([code,label])=><option key={code} value={code}>{label}</option>)}
                </select>
              </label>
              <button type="submit" className="client-ghost-link">{locale==='fr'?'Rechercher':'بحث'}</button>
            </form>
          </header>
          {list.length === 0 ? (
            <p>{c.emptyBoard}</p>
          ) : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead><tr><th>{c.need}</th><th>{c.status}</th><th>{c.lastAction}</th><th>{c.nextStep}</th><th /></tr></thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id}>
                      <td><span className="client-doc-cell"><FileGlyph kind="file" />{row.title}</span></td>
                      <td><span className="client-status-chip" data-tone={row.tone}>{row.status}</span></td>
                      <td>{row.last}</td>
                      <td>{row.next}</td>
                      <td><Cta href={row.href}>{c.open}</Cta></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
        <article className="client-card client-compare-aside">
          <header><h2><Scale className="size-4" aria-hidden />{c.compareOffers}</h2></header>
          <p>{c.compareLead}</p>
          <Cta href={compareHref} soft>{c.compareCta}</Cta>
          <div className="client-quote-art" aria-hidden />
          <blockquote>{c.quote}</blockquote>
        </article>
      </section>
      <article className="client-card client-priority-head">
        <div>
          <h2>{c.fromDiag}</h2>
          <p>{c.fromDiagLead}</p>
        </div>
        <Cta href={`/${locale}/client/diagnostics${query}`} soft>{c.usePriority}</Cta>
      </article>
    </main>
  );
}

export type MissionBoardView = {
  validations: Array<{ id: string; title: string; detail: string; href: string }>;
  steps: Array<{ id: string; title: string; detail: string; state: "done" | "current" | "todo" | "upcoming" }>;
  decision: { title: string; context: string; impact: string; href: string } | null;
  files: Array<{ id: string; title: string; href: string; kind: "pdf" | "docx" | "xlsx" | "file" | "message" | "folder" }>;
};

export function MissionsBoard({ locale, query, view }: { locale: Locale; query: string; organizationName?: string | null; view?: MissionBoardView }) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const preferDemo = canApplyClientSpaceDemo() && !view?.validations.length && !view?.steps.length;
  const data = preferDemo ? demo.missions : {
    validations: view?.validations ?? [],
    steps: view?.steps ?? [],
    decision: view?.decision ?? null,
    files: view?.files ?? [],
  };
  return (
    <main className="client-page">
      <article className="client-card">
        <header><h2>{c.nextValidations}</h2></header>
        <p>{c.nextValidationsLead}</p>
        {data.validations.length === 0 ? <p>{c.emptyBoard}</p> : (
          <div className="client-validation-grid">
            {data.validations.map((item) => (
              <div key={item.id} className="client-validation-card">
                <span className="client-feed-icon" data-tone="peach"><FileText className="size-4" aria-hidden /></span>
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                <Cta href={item.href}>{c.open}</Cta>
              </div>
            ))}
          </div>
        )}
      </article>
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header><h2>{c.follow}</h2></header>
          <p>{c.followLead}</p>
          {data.steps.length === 0 ? <p>{c.emptyBoard}</p> : (
            <>
              <ol className="client-journey">
                {data.steps.map((step, index) => (
                  <li key={step.id} data-state={step.state}><span><JourneyGlyph index={index} /></span><small>{step.title}</small></li>
                ))}
              </ol>
              <ul className="client-feed">
                {data.steps.map((step) => (
                  <li key={`${step.id}-row`}>
                    <span className="client-feed-icon" data-tone={step.state === "done" ? "mint" : step.state === "current" ? "violet" : "peach"} />
                    <span><strong>{step.title}</strong><small>{step.detail}</small></span>
                    <em data-tone={step.state === "done" ? "mint" : step.state === "current" ? "violet" : "peach"}>{stepStateLabel(step.state, locale)}</em>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
        <div className="client-stack">
          <article className="client-card">
            <header><h2>{c.decisions}</h2></header>
            <p>{c.decisionsLead}</p>
            {data.decision ? (
              <>
                <h3>{data.decision.title}</h3>
                <p><strong>{c.contextLabel}.</strong> {data.decision.context}</p>
                <p><strong>{c.impactLabel}.</strong> {data.decision.impact}</p>
                <p className="client-decision-note">{c.decisionNote}</p>
                <Cta href={data.decision.href}>{c.open}</Cta>
              </>
            ) : <p>{c.emptyBoard}</p>}
          </article>
          <article className="client-card">
            <header>
              <h2>{c.docsExchanges}</h2>
            </header>
            <nav className="client-tabs" aria-label={c.docsExchanges}>
              <a href="#dossier-docs" aria-current="page">{c.all}</a>
              <Link href={`/${locale}/client/documents${query}`}>{c.docsTab}</Link>
              <Link href={`/${locale}/messagerie${query}`}>{c.messagesTab}</Link>
            </nav>
            {data.files.length === 0 ? <p>{c.emptyBoard}</p> : (
              <ul className="client-feed" id="dossier-docs">
                {data.files.map((file) => (
                  <li key={file.id}><Link href={file.href}><FileGlyph kind={file.kind} /><span>{file.title}</span><em>{c.open}</em></Link></li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>
      <article className="client-quote-banner client-collab-banner">
        <div>
          <h2>{c.collaboration}</h2>
          <p>{c.collaborationLead}</p>
        </div>
        <blockquote>{locale === "ar" ? "أبعد اليوم، من أجل الغد." : "Plus loin aujourd’hui, pour demain."}</blockquote>
      </article>
    </main>
  );
}

export type DocumentBoardRow = {
  id: string;
  title: string;
  folder: string;
  status: string;
  access: string;
  href: string;
  kind: "pdf" | "docx" | "xlsx" | "file" | "message" | "folder";
  tone: "violet" | "sky" | "mint" | "peach";
};

export function DocumentsBoard({ locale, query, children, documents, toHandle, recent }: { locale: Locale; query: string; children?: ReactNode; organizationName?: string | null; documents?: DocumentBoardRow[]; toHandle?: Array<{ id: string; title: string; href: string; tone: "violet" | "sky" | "mint" | "peach"; action: "examine" | "confirm" | "reply" }>; recent?: DocumentBoardRow[] }) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const preferDemo = canApplyClientSpaceDemo() && (!documents || documents.length === 0);
  const rows = preferDemo ? demo.documents : documents ?? [];
  const handle = preferDemo ? demo.toHandle : toHandle ?? [];
  const recentRows = preferDemo ? demo.recentDocuments : recent ?? rows;
  const actionLabel = { examine: c.examine, confirm: c.confirm, reply: c.reply } as const;
  return (
    <main className="client-page">
      <p className="client-safety">{c.safety}</p>
      <section className="client-board client-board-compare">
        <article className="client-card">
          {rows.length === 0 ? <p>{c.emptyBoard}</p> : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead><tr><th>{c.docsTitle}</th><th>{c.folder}</th><th>{c.status}</th><th>{locale === "ar" ? "الوصول" : "Accès"}</th><th>{c.actionCol}</th></tr></thead>
                <tbody>
                  {rows.map((doc) => (
                    <tr key={doc.id}>
                      <td><span className="client-doc-cell"><FileGlyph kind={doc.kind} />{doc.title}</span></td>
                      <td>{doc.folder}</td>
                      <td><span className="client-status-chip" data-tone={doc.tone}>{doc.status}</span></td>
                      <td>{doc.access}</td>
                      <td><Cta href={doc.href}>{c.open}</Cta></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
        <div className="client-stack">
          <article className="client-card">
            <header className="client-priority-head"><h2>{c.toHandle}</h2><Link href={`/${locale}/client/missions${query}`} className="client-text-link">{c.seeAllToHandle}</Link></header>
            {handle.length === 0 ? <p>{c.emptyBoard}</p> : (
              <ul className="client-feed">
                {handle.map((item) => (
                  <li key={item.id}><Link href={item.href}><span className="client-feed-icon" data-tone={item.tone}><FileText className="size-4" aria-hidden /></span><span>{item.title}</span><em>{actionLabel[item.action]}</em></Link></li>
                ))}
              </ul>
            )}
          </article>
          <article className="client-card">
            <div className="client-drop" role="note">
              <Cloud className="size-6" aria-hidden />
              <p>{c.drop}</p>
              <small>{c.formats}</small>
            </div>
            <p className="client-access-note">{locale === "ar" ? "إيداع الملفات يتم من تفاصيل الطلب أو المهمة المعنية." : "Le dépôt de fichiers se fait depuis le dossier de demande ou de mission concerné."}</p>
            <p className="client-verified">{c.verified}</p>
          </article>
        </div>
      </section>
      <article className="client-card">
        <header className="client-priority-head">
          <h2>{c.recent}</h2>
          <Link href={`/${locale}/client/documents${query}`} className="client-text-link">{c.seeAllToHandle}</Link>
        </header>
        <nav className="client-tabs" aria-label={c.recent}>
          <a href="#documents-recents" aria-current="page">{c.all}</a>
          <Link href={`/${locale}/client/demandes${query}`}>{c.requestsTab}</Link>
          <Link href={`/${locale}/client/missions${query}`}>{c.missionsTab}</Link>
          <Link href={`/${locale}/client/contrats${query}`}>{c.contractsTab}</Link>
          <Link href={`/${locale}/client/documents${query}`}>{c.contractsTab}</Link>
        </nav>
        {recentRows.length === 0 ? <p>{c.emptyBoard}</p> : (
          <ul className="client-feed" id="documents-recents">
            {recentRows.map((doc) => (
              <li key={doc.id}><Link href={doc.href}><FileGlyph kind={doc.kind} /><span><strong>{doc.title}</strong><small>{doc.folder}</small></span><span className="client-status-chip" data-tone={doc.tone}>{doc.status}</span><em>{c.open}</em></Link></li>
            ))}
          </ul>
        )}
      </article>
      {children ? <details className="client-ops"><summary>{c.opsDocs}</summary>{children}</details> : null}
    </main>
  );
}

export function FinancesBoard({ locale, query, rows }: { locale: Locale; query: string; organizationName?: string | null; rows?: Array<{ id: string; title: string; folder: string; status: string; next: string; href: string; tone: "violet" | "sky" | "mint" | "peach" }> }) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const preferDemo = canApplyClientSpaceDemo() && (!rows || rows.length === 0);
  const list = preferDemo ? demo.finances : rows ?? [];
  return (
    <main className="client-page">
      <section className="client-space-kpis">
        <article className="client-card client-kpi-card">
          <span className="client-feed-icon" data-tone="violet"><FileText className="size-4" aria-hidden /></span>
          <h2>{c.invoices}</h2>
          <p>{c.invoiceLead}</p>
          <Cta href={`/${locale}/client/abonnement${query}`} tone="violet">{c.open}</Cta>
        </article>
        <article className="client-card client-kpi-card">
          <span className="client-feed-icon" data-tone="peach"><FileText className="size-4" aria-hidden /></span>
          <h2>{c.payments}</h2>
          <p>{c.paymentLead}</p>
          <Cta href={`/${locale}/client/abonnement${query}#plans`} tone="peach">{c.open}</Cta>
        </article>
        <article className="client-card client-kpi-card">
          <span className="client-feed-icon" data-tone="mint"><FileText className="size-4" aria-hidden /></span>
          <h2>{c.credits}</h2>
          <p>{c.creditLead}</p>
          <Cta href={`/${locale}/client/credits${query}`} tone="mint">{c.open}</Cta>
        </article>
      </section>
      <section className="client-board client-board-compare">
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.finDocs}</h2><Link href={`/${locale}/client/abonnement${query}`} className="client-text-link">{c.seeAllToHandle}</Link></header>
          <p>{c.finDocsLead}</p>
          {list.length === 0 ? <p>{c.emptyBoard}</p> : (
            <div className="client-table-wrap">
              <table className="client-space-table">
                <thead><tr><th>{c.docsTitle}</th><th>{c.folder}</th><th>{c.status}</th><th>{c.nextAction}</th><th>{c.actionCol}</th></tr></thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id}>
                      <td><span className="client-doc-cell"><FileGlyph kind="file" />{row.title}</span></td>
                      <td>{row.folder}</td>
                      <td><span className="client-status-chip" data-tone={row.tone}>{row.status}</span></td>
                      <td>{row.next}</td>
                      <td><Cta href={row.href}>{c.open}</Cta></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href={`/${locale}/client/abonnement${query}`} className="client-text-link">{c.seeAllFin}</Link>
        </article>
        <div className="client-stack">
          <article className="client-card">
            <header><h2>{c.understand}</h2></header>
            <p>{c.understandLead}</p>
            <p>{c.understandNote}</p>
            <p>{c.questionHelp}</p>
          </article>
          <article className="client-card">
            <header><h2>{c.options}</h2></header>
            <ul className="client-feed">
              <li><Link href={`/${locale}/client/abonnement${query}`}><span>{c.manageSub}</span><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link></li>
              <li><Link href={`/${locale}/client/credits${query}`}><span>{c.seeCredits}</span><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link></li>
              <li><Link href={`/${locale}/client/achats-groupes${query}`}><span>{c.volume}</span><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link></li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}

export function CompanyBoard({ locale, query, organizationName, people }: { locale: Locale; query: string; organizationName: string | null; alternate: "fr" | "ar"; people?: Array<{ id: string; name: string; role: string }> }) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const demoOn = canApplyClientSpaceDemo();
  const legalName = organizationName ?? (demoOn ? (locale === "ar" ? "عميل · تواصل وتسويق وإبداع" : "Client · Communication, marketing et création") : "—");
  const members = people ?? (demoOn ? demo.people : []);
  return (
    <main className="client-page" data-client-layout="company">
      <OrganizationTabs locale={locale} query={query} active="profile" />
      <section className="client-board" id="sites">
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.orgInfo}</h2><Cta href={`/${locale}/organisation${query}#modifier`}>{c.modify}</Cta></header>
          <dl className="client-fact-grid client-org-grid">
            <div><small>{c.legalName}</small><span>{legalName}</span></div>
            {demoOn ? (
              <>
                <div><small>{c.address}</small><span>{locale === "ar" ? "الدار البيضاء، المغرب" : "Casablanca, Maroc"}</span></div>
                <div><small>{c.orgActivity}</small><span>{demo.understood.activity}</span></div>
                <div><small>{c.contacts}</small><span>{locale === "ar" ? "عبر فضاء ماتريسيا" : "Via l’espace Matricia"}</span></div>
              </>
            ) : (
              <div>
                <small>{locale === "ar" ? "الملف" : "Compléter"}</small>
                <span className="client-access-note">
                  {locale === "ar" ? "العنوان والنشاط وجهات الاتصال تُدار من تعديل المؤسسة." : "Adresse, activité et contacts se gèrent depuis la modification de l’entreprise."}
                </span>
              </div>
            )}
          </dl>
        </article>
        <article className="client-card">
          <header><h2>{c.security}</h2></header>
          <ul className="client-feed">
            <li><Link href={`/${locale}/confidentialite/demandes`}><span>{locale==="fr"?"Mes demandes de données":"طلباتي المتعلقة بالبيانات"}</span><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link></li>
            <li><Link href={`/${locale}/securite/compte${query}`}><span>{c.accountSec}</span><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link></li>
            <li><Link href={`/${locale}/securite/sessions`}><span>{c.sessions}</span><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link></li>
            <li><Link href={`/${locale}/notifications${query}`}><span>{c.notif}</span><ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link></li>
          </ul>
        </article>
      </section>
      <section className="client-board">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.people}</h2>
            <div className="client-offer-actions">
              <Cta href={`/${locale}/organisation/roles${query}`}>{c.manageAccess}</Cta>
              <Cta href={`/${locale}/securite/compte${query}#invitation`} soft>{c.invite}</Cta>
            </div>
          </header>
          <ul className="client-feed">
            {members.length === 0 ? <li><span>{c.emptyPeople}</span></li> : members.map((person) => (
              <li key={person.id}><span className="client-feed-icon" data-tone="violet" /><span><strong>{person.name}</strong></span><em>{person.role}</em></li>
            ))}
          </ul>
          <p className="client-access-note">{c.accessNote}</p>
        </article>
        <article className="client-card">
          <header><h2>{c.prefs}</h2></header>
          <div className="client-pref-row">
            <div>
              <strong>{c.language}</strong>
              <p>{locale === "ar" ? "اختاروا لغة الواجهة لفريقكم." : "Choisissez la langue d’affichage pour votre équipe."}</p>
            </div>
            <div className="client-lang-switch">
              <Link href={`/fr/organisation${query}`} hrefLang="fr" aria-current={locale === "fr" ? "page" : undefined}>FR</Link>
              <Link href={`/ar/organisation${query}`} hrefLang="ar" aria-current={locale === "ar" ? "page" : undefined}>AR</Link>
            </div>
          </div>
          <p><strong>{c.commPrefs}</strong></p>
          <p>{c.newsLead}</p>
          <Cta href={`/${locale}/notifications${query}`}>{c.openPreferences}</Cta>
        </article>
      </section>
      <footer className="client-space-footer">
        <p>Matricia — {c.footerLine}</p>
        <nav>
          <Link href={`/${locale}/contact${query}`}>{c.help}</Link>
          <Link href={`/${locale}/confidentialite`}>{c.privacy}</Link>
          <Link href={`/${locale}/conditions`}>{c.terms}</Link>
        </nav>
      </footer>
    </main>
  );
}

export function MessagesBoard({ locale, query, search, children, threads,serverFiltered=false,inboxError=false,inboxFooter }: { locale: Locale; query: string; search?: string; children: ReactNode; threads?: Array<{ id: string; title: string; meta: string; href: string }>; organizationName?: string | null;serverFiltered?:boolean;inboxError?:boolean;inboxFooter?:ReactNode }) {
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, query);
  const liveThreads = threads ?? [];
  const showDemo = !serverFiltered && canApplyClientSpaceDemo() && liveThreads.length === 0;
  const needle = (search ?? "").trim().toLocaleLowerCase();
  const inbox = (showDemo ? demo.inbox : liveThreads).filter((item) => serverFiltered || !needle || `${item.title} ${item.meta}`.toLocaleLowerCase().includes(needle));
  const organizationId = new URLSearchParams(query.replace(/^\?/, "")).get("organizationId");
  return (
    <main className="client-page">
      <div className="client-msg-grid">
        <article className="client-card">
          <form className="client-top-search" action={`/${locale}/messagerie`} method="get" role="search">
            {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
            <Search className="size-4" aria-hidden />
            <label><span className="sr-only">{c.searchThread}</span><input name="q" defaultValue={search} placeholder={c.searchThread} /></label>
          </form>
          <nav className="client-tabs" aria-label={c.msgTitle}>
            <Link href={`/${locale}/messagerie${query}`} aria-current={search ? undefined : "page"}>{c.all}</Link>
            <Link href={`/${locale}/notifications${query}`}>{c.unread}</Link>
            <Link href={`/${locale}/client/demandes${query}`}>{c.linked}</Link>
          </nav>
          <ul className="client-feed" id="messages-inbox">
            {inboxError ? <li><p role="alert">{locale==="fr"?"Les fils sont momentanément indisponibles. Réessayez.":"المحادثات غير متاحة مؤقتاً. حاولوا مجدداً."}</p></li> : inbox.length === 0 ? <li><span>{c.emptyBoard}</span></li> : inbox.map((item) => (
              <li key={item.id}><Link href={item.href}><span className="client-feed-icon" data-tone={"tone" in item ? item.tone : "violet"}>{("kind" in item && item.kind === "folder") ? <Folder className="size-4" aria-hidden /> : <MessageSquare className="size-4" aria-hidden />}</span><span><strong>{item.title}</strong><small>{item.meta}</small></span><em>{item.meta}</em></Link></li>
            ))}
          </ul>
          {inboxFooter}
        </article>
        <article className="client-card client-msg-thread">
          {showDemo ? (
            <>
              <header className="client-priority-head">
                <h2>{c.threadTitle} — {demo.thread.folder}</h2>
              </header>
              <ol className="client-msg-list">
                {demo.thread.messages.map((message) => (
                  <li key={message.id} data-side={message.side}>
                    <strong>{message.title}</strong>
                    <p>{message.body}</p>
                  </li>
                ))}
              </ol>
              <p className="client-access-note">{c.accessNote}</p>
            </>
          ) : null}
          {children}
        </article>
        <article className="client-card">
          <header><h2>{c.context}</h2></header>
          {showDemo ? (
            <>
              <p><strong>{demo.thread.folder}</strong></p>
              <ul className="client-feed">
                <li><span><strong>{c.status}</strong></span><em>{demo.thread.status}</em></li>
                <li><span><strong>{c.typeLabel}</strong><small>{demo.thread.type}</small></span></li>
                <li><span><strong>{c.associatedItems}</strong><small>{demo.thread.associated}</small></span></li>
              </ul>
              <Cta href={`/${locale}/client/demandes${query}`} soft>{c.openTheFolder}</Cta>
              <header><h2>{c.associated}</h2></header>
              <ul className="client-feed">
                {demo.missions.files.slice(0, 3).map((file) => (
                  <li key={file.id}><Link href={file.href}><FileGlyph kind={file.kind} /><span>{file.title}</span></Link></li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>{c.msgLead}</p>
              <ul className="client-feed">
                <li><Link href={`/${locale}/client/demandes${query}`}><Folder className="size-4" aria-hidden /><span>{c.openTheFolder}</span></Link></li>
                <li><Link href={`/${locale}/client/documents${query}`}><FileGlyph kind="file" /><span>{c.docsTitle}</span></Link></li>
              </ul>
            </>
          )}
          <p className="client-access-note">{c.accessNote}</p>
        </article>
      </div>
    </main>
  );
}

export function SpaceActions({ href, label, variant = "primary" }: { href: string; label: string; variant?: "primary" | "soft" | "ghost" }) {
  const className = variant === "ghost" ? "client-ghost-link" : variant === "soft" ? "client-soft-link" : "client-cta";
  return <Link href={href} className={className}><Plus className="size-4" aria-hidden />{label}</Link>;
}

export function SpaceFilters({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="client-ghost-link"><Filter className="size-4" aria-hidden />{label}</Link>;
}
