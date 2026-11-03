import Link from "next/link";
import { ArrowRight, Beaker, BookOpen, CheckCircle2, ClipboardList, FileText, Globe, LineChart, Lock, MessageSquare, Scale, Send, Users } from "lucide-react";
import type { ReactNode } from "react";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { catalogStatusLabel, catalogStatusTone, type FranchiseCatalogRow, type FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { FranchiseMandatePerimeter, FranchiseRowMenu, validationChipLabel, validationChipTone, workflowChipLabel } from "./library-chrome";
import { FranchiseCategoryCreateForm, FranchiseHierarchySubmitForm, FranchiseSubcategoryCreateForm } from "./catalog-commands";

const pipelineIcons = [ClipboardList, FileText, Scale, Beaker, Send, Globe, Users] as const;
const pipelineTones = ["violet", "peach", "mint", "sky", "peach", "mint", "violet"] as const;
const kpiIcons = [FileText, Send, MessageSquare, BookOpen] as const;
const kpiTones = ["violet", "peach", "mint", "sky"] as const;

export function nextAction(status: string, locale: Locale) {
  const c = libraryCopy(locale);
  if (status === "DRAFT") return c.completeDraft;
  if (status === "REJECTED" || status === "CHANGES_REQUESTED") return c.seeComments;
  if (["IN_REVIEW", "FRANCHISE_REVIEW", "CENTRAL_REVIEW"].includes(status)) return c.waitReturn;
  if (status === "PUBLISHED" || status === "APPROVED") return c.simulate;
  return c.submit;
}

export function kindLabel(kind: FranchiseCatalogRow["kind"], locale: Locale) {
  const c = libraryCopy(locale);
  if (kind === "SERVICE") return c.serviceKind;
  if (kind === "QUESTIONNAIRE") return c.questionnaireKind;
  return c.ruleKind;
}

export function MandateBanner({ locale, name }: { locale: Locale; name: string }) {
  const c = libraryCopy(locale);
  return (
    <p className="franchise-mandate-banner" role="status">
      <span className="franchise-pipe-icon" data-tone="sky" aria-hidden>
        <Lock className="size-3.5" />
      </span>
      <span>
        <strong>{c.scope}</strong>
        <small>{c.scopeHelp} {name}</small>
      </span>
    </p>
  );
}

export function StatusChip({ status, locale }: { status: string; locale: Locale }) {
  return <em className="client-status-chip" data-tone={catalogStatusTone(status)}>{catalogStatusLabel(status, locale)}</em>;
}

export function LanguageMarks({ item }: { item: FranchiseCatalogRow }) {
  const hasFr = Boolean(item.nameFr);
  const hasAr = Boolean(item.nameAr);
  if (!hasFr && !hasAr) return <span className="franchise-langs"><span className="client-access-note">—</span></span>;
  return (
    <span className="franchise-langs">
      {hasFr ? <span className="franchise-lang">FR</span> : null}
      {hasAr ? <span className="franchise-lang" data-tone="mint">AR</span> : null}
    </span>
  );
}

export function KindChip({ kind, locale }: { kind: FranchiseCatalogRow["kind"]; locale: Locale }) {
  return <em className="franchise-kind-chip" data-kind={kind}>{kindLabel(kind, locale)}</em>;
}

function KindIcon({ kind }: { kind: FranchiseCatalogRow["kind"] }) {
  if (kind === "QUESTIONNAIRE") return <FileText className="size-4" aria-hidden />;
  if (kind === "RULE") return <Scale className="size-4" aria-hidden />;
  return <ClipboardList className="size-4" aria-hidden />;
}

export function FranchiseLibraryHomeBoard({ locale, query, workspace }: { locale: Locale; query: string; workspace: FranchiseLibraryWorkspace }) {
  const c = libraryCopy(locale);
  const queue = [...workspace.questionnaires, ...workspace.services, ...workspace.rules]
    .filter((item) => item.status !== "ARCHIVED" && item.status !== "RETIRED")
    .slice(0, 8);
  const treatItems = queue.slice(0, 5).map((item, index) => ({
    href: item.href,
    title: item.title,
    tone: (["peach", "sky", "violet", "mint", "peach"] as const)[index] ?? "peach",
  }));
  const activity = [...workspace.questionnaires, ...workspace.services, ...workspace.rules, ...workspace.releases.map((item) => ({ id: item.id, title: item.key, status: item.status, href: `/${locale}/franchise/validations${query}`, kind: "QUESTIONNAIRE" as const }))]
    .slice(0, 5);
  const kpis = [
    { label: c.drafts, help: c.draftsHelp, value: workspace.counts.drafts, href: `/${locale}/franchise/validations/brouillons${query}`, source: c.kpiSourceValidations },
    { label: c.inReview, help: c.inReviewHelp, value: workspace.counts.inReview, href: `/${locale}/franchise/validations/en-cours${query}`, source: c.kpiSourceValidations },
    { label: c.returns, help: c.returnsHelp, value: workspace.counts.returns, href: `/${locale}/franchise/validations/corrections${query}`, source: c.kpiSourceValidations },
    { label: c.published, help: c.publishedHelp, value: workspace.counts.published, href: `/${locale}/franchise/validations/publications${query}`, source: c.kpiSourceValidations },
  ];
  return (
    <main className="client-page franchise-home-page">
      {(workspace.mandates?.length??0)>1?<nav aria-label={locale==="ar"?"اختيار التفويض":"Choisir le mandat"} className="flex flex-wrap gap-3">{workspace.mandates?.map((mandate)=><Link key={mandate.id} aria-current={mandate.id===workspace.mandate.franchiseId?"page":undefined} className="franchise-tool" href={`/${locale}/franchise/accueil?organizationId=${mandate.organizationId}&franchiseId=${mandate.id}`}>{mandate.operatorCode} · {mandate.id.slice(0,8).toUpperCase()}</Link>)}</nav>:null}
      <p className="franchise-home-lead-mobile">{c.homeLeadMobile}</p>
      <section className="franchise-treat franchise-home-kpis">
        {kpis.map((item, index) => {
          const Icon = kpiIcons[index] ?? FileText;
          return (
            <Link key={item.label} href={item.href} className="franchise-kpi-tile" data-tone={kpiTones[index]}>
              <span className="franchise-kpi-icon"><Icon className="size-4" aria-hidden /></span>
              <span>
                <strong dir="ltr">{item.value}</strong>
                <small>{item.label}</small>
                <small className="franchise-kpi-help">{item.help}</small>
                <small className="franchise-kpi-source">{c.kpiSource} : {item.source}</small>
              </span>
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          );
        })}
      </section>
      <article className="client-card franchise-home-journey">
        <header className="client-priority-head">
          <h2 className="franchise-journey-full">{c.journey}</h2>
          <h2 className="franchise-journey-short">{c.journeyShort}</h2>
          <Link href={`/${locale}/franchise/services/nouveau${query}`} className="franchise-tool franchise-tool-primary franchise-create-content">{c.createContent}</Link>
        </header>
        <ol className="franchise-pipeline franchise-pipeline-full">
          {c.steps.map(([title, text], index) => {
            const Icon = pipelineIcons[index] ?? ClipboardList;
            return (
              <li key={title}>
                <span className="franchise-pipe-row">
                  <span className="franchise-pipe-icon" data-tone={pipelineTones[index]}><Icon className="size-4" /></span>
                  {index < c.steps.length - 1 ? <span className="franchise-pipe-arrow" aria-hidden /> : null}
                </span>
                <strong>{index + 1}. {title}</strong>
                <small>{text}</small>
              </li>
            );
          })}
        </ol>
        <ol className="franchise-pipeline franchise-pipeline-mobile">
          {c.mobileSteps.map(([title, text], index) => {
            const Icon = [ClipboardList, Users, CheckCircle2, LineChart][index] ?? ClipboardList;
            return (
              <li key={title} data-active={index === 0 ? "true" : undefined}>
                <span className="franchise-pipe-row">
                  <span className="franchise-pipe-icon" data-tone={index === 0 ? "violet" : "sky"}><Icon className="size-4" /></span>
                  {index < c.mobileSteps.length - 1 ? <span className="franchise-pipe-arrow" aria-hidden /> : null}
                </span>
                <strong>{index + 1}. {title}</strong>
                <small>{text}</small>
              </li>
            );
          })}
        </ol>
      </article>
      <section className="franchise-home-grid">
        <article className="client-card">
          <header className="client-priority-head">
            <h2 className="franchise-queue-full">{c.queue}</h2>
            <h2 className="franchise-queue-mobile">{c.queueMobile}</h2>
            <Link href={`/${locale}/franchise/actions${query}`} className="client-soft-link">{c.seeAll}</Link>
          </header>
          {queue.length === 0 ? <p>{c.emptyQueue}</p> : (
            <>
              <ul className="franchise-mobile-queue">
                {queue.map((item) => (
                  <li key={`m-${item.id}`}>
                    <span className="franchise-kpi-icon" data-tone={catalogStatusTone(item.status)}><KindIcon kind={item.kind} /></span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{workflowChipLabel(item.status, locale)} · {item.versionLabel ?? "v1"}</small>
                    </span>
                    <em className="client-status-chip" data-tone={validationChipTone(item.status)}>{validationChipLabel(item.status, locale)}</em>
                    <Link href={item.href} className="client-soft-link" aria-label={item.title}><ArrowRight className="size-4 rtl:rotate-180" /></Link>
                  </li>
                ))}
              </ul>
              <div className="client-table-wrap client-compare franchise-home-queue-table">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{c.element}</th>
                    <th>{c.kind}</th>
                    <th>{c.linked}</th>
                    <th>{c.version}</th>
                    <th>{c.languages}</th>
                    <th>{c.validation}</th>
                    <th>{c.state}</th>
                    <th>{c.next}</th>
                    <th><span className="sr-only">{c.rowActions}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="franchise-row-title">
                          <span className="franchise-kpi-icon" data-tone="violet"><KindIcon kind={item.kind} /></span>
                          <strong>{item.title}</strong>
                        </span>
                      </td>
                      <td><KindChip kind={item.kind} locale={locale} /></td>
                      <td>{item.subcategory ?? item.category ?? "—"}</td>
                      <td>{item.versionLabel ?? "—"}</td>
                      <td><LanguageMarks item={item} /></td>
                      <td><em className="client-status-chip" data-tone={validationChipTone(item.status)}>{validationChipLabel(item.status, locale)}</em></td>
                      <td><em className="client-status-chip" data-tone={catalogStatusTone(item.status)}>{workflowChipLabel(item.status, locale)}</em></td>
                      <td><Link href={item.href}>{nextAction(item.status, locale)}</Link></td>
                      <td><FranchiseRowMenu href={item.href} label={item.title} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
          <header className="client-priority-head franchise-section-head"><h2>{c.quick}</h2></header>
          <div className="franchise-toolbar">
            <Link href={`/${locale}/franchise/services/nouveau${query}`} className="franchise-tool franchise-tool-primary"><ClipboardList className="size-4" aria-hidden /> {c.createService}</Link>
            <Link href={`/${locale}/franchise/questionnaires/nouveau${query}`} className="franchise-tool franchise-tool-peach"><FileText className="size-4" aria-hidden /> {c.createQuestion}</Link>
            <Link href={`/${locale}/franchise/regles/nouvelle${query}`} className="franchise-tool franchise-tool-mint"><Scale className="size-4" aria-hidden /> {c.createRule}</Link>
            <Link href={`/${locale}/franchise/regles${query}#simulation`} className="franchise-tool"><Beaker className="size-4" aria-hidden /> {c.simulate}</Link>
          </div>
          <p className="client-access-note">{c.clientsNote}</p>
        </article>
        <aside className="franchise-home-rail">
          <article className="client-card">
            <header className="client-priority-head"><h2>{c.treatNow}</h2><Link href={`/${locale}/franchise/validations${query}`} className="client-soft-link">{c.seeAll}</Link></header>
            <ul className="franchise-dot-list">
              {treatItems.length === 0 ? (
                <li><span className="client-access-note">{c.noActivity}</span></li>
              ) : treatItems.map((item) => (
                <li key={`${item.href}-${item.title}`}>
                  <span className="franchise-dot" data-tone={item.tone} />
                  <strong>{item.title}</strong>
                  <Link href={item.href} className="client-soft-link" aria-label={item.title}><ArrowRight className="size-4 rtl:rotate-180" /></Link>
                </li>
              ))}
            </ul>
          </article>
          <FranchiseMandatePerimeter locale={locale} name={workspace.mandate.libraryName} />
          <article className="client-card franchise-reminders">
            <header><h2>{c.reminders}</h2></header>
            <ul className="franchise-dot-list">
              {c.reminderItems.map((item) => (
                <li key={item}><span className="franchise-dot" data-tone="peach" /><span>{item}</span></li>
              ))}
            </ul>
          </article>
          <article className="client-card" id="activite">
            <header className="client-priority-head"><h2>{c.activity}</h2><Link href={`/${locale}/franchise/validations/historique${query}`} className="client-soft-link">{c.seeAll}</Link></header>
            {activity.length === 0 ? <p>{c.noActivity}</p> : (
              <ol className="franchise-activity">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className="franchise-dot" data-tone={catalogStatusTone(item.status)} />
                    <span><strong>{item.title}</strong><small>{catalogStatusLabel(item.status, locale)}</small></span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </aside>
      </section>
    </main>
  );
}

export function FranchiseCatalogListBoard({
  locale,
  title,
  empty,
  rows,
  actions,
  createHref,
  createLabel,
}: {
  locale: Locale;
  title: string;
  empty: string;
  rows: FranchiseCatalogRow[];
  actions?: ReactNode;
  createHref: string;
  createLabel: string;
}) {
  const c = libraryCopy(locale);
  return (
    <main className="client-page">
      <div className="franchise-toolbar">
        <Link href={createHref} className="franchise-tool franchise-tool-primary">{createLabel}</Link>
        {actions}
      </div>
      <article className="client-card">
        <header><h2>{title}</h2></header>
        {rows.length === 0 ? <p>{empty}</p> : (
          <ul className="client-feed">
            {rows.map((item) => (
              <li key={item.id} id={item.id}>
                <span className="client-feed-icon" data-tone="violet"><KindIcon kind={item.kind} /></span>
                <span>
                  <strong>{item.title}</strong>
                  <small><bdi dir="ltr">{item.code}</bdi>{item.versionLabel ? ` · ${item.versionLabel}` : ""} · {catalogStatusLabel(item.status, locale)}</small>
                </span>
                <Link href={item.href} className="client-soft-link">{nextAction(item.status, locale)}</Link>
              </li>
            ))}
          </ul>
        )}
        <p className="client-access-note">{c.clientsNote}</p>
      </article>
    </main>
  );
}

export function FranchiseLibraryStructureBoard({
  locale,
  query,
  workspace,
  view,
  commandIdentity,
  organizationId = null,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  view: "categories" | "version" | "historique";
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId?: string | null;
}) {
  const c = libraryCopy(locale);
  const tabs = [
    { id: "categories", href: `/${locale}/franchise/bibliotheque/categories${query}`, label: c.category },
    { id: "version", href: `/${locale}/franchise/bibliotheque/version${query}`, label: c.version },
    { id: "historique", href: `/${locale}/franchise/bibliotheque/historique${query}`, label: c.activity },
  ] as const;
  return (
    <main className="client-page" data-franchise-nested={view}>
      <MandateBanner locale={locale} name={workspace.mandate.libraryName} />
      <nav className="franchise-inspector-tabs" aria-label={c.libraryTitle}>
        {tabs.map((tab) => (
          <Link key={tab.id} href={tab.href} data-active={view === tab.id ? "true" : undefined}>{tab.label}</Link>
        ))}
      </nav>
      <section className="franchise-workbench">
        {view === "categories" ? (
          <article className="client-card">
            <header><h2>{c.category}</h2></header>
            {workspace.categories.length === 0 ? <p className="franchise-empty-panel">{c.emptyCategories}</p> : (
              <ul className="client-feed">
                {workspace.categories.map((category) => (
                  <li key={category.id}>
                    <span><strong>{category.title}</strong><small>{category.children.map((child) => child.title).join(" · ") || c.subcategory}</small></span>
                    <em className="client-status-chip">{category.status ?? workspace.mandate.libraryStatus}</em>
                  </li>
                ))}
              </ul>
            )}
            <FranchiseCategoryCreateForm locale={locale} libraryId={workspace.mandate.libraryId} franchiseId={workspace.mandate.franchiseId} organizationId={organizationId} commandIdentity={commandIdentity} />
            <FranchiseSubcategoryCreateForm locale={locale} libraryId={workspace.mandate.libraryId} franchiseId={workspace.mandate.franchiseId} organizationId={organizationId} commandIdentity={commandIdentity} categories={workspace.categories} />
            {workspace.categories.flatMap((category) => [
              <FranchiseHierarchySubmitForm key={`cat-${category.id}`} locale={locale} libraryId={workspace.mandate.libraryId} franchiseId={workspace.mandate.franchiseId} organizationId={organizationId} commandIdentity={commandIdentity} objectType="CATEGORY" item={category} />,
              ...category.children.map((child) => (
                <FranchiseHierarchySubmitForm key={`sub-${child.id}`} locale={locale} libraryId={workspace.mandate.libraryId} franchiseId={workspace.mandate.franchiseId} organizationId={organizationId} commandIdentity={commandIdentity} objectType="SUBCATEGORY" item={child} />
              )),
            ])}
          </article>
        ) : null}
        {view === "version" ? (
          <article className="client-card">
            <header><h2>{c.version}</h2></header>
            <dl className="franchise-props">
              <div><dt>{c.libraryTitle}</dt><dd>{workspace.mandate.libraryName}</dd></div>
              <div><dt>{c.version}</dt><dd dir="ltr">{workspace.mandate.libraryRowVersion}</dd></div>
              <div><dt>{c.state}</dt><dd>{workspace.mandate.libraryStatus}</dd></div>
            </dl>
          </article>
        ) : null}
        {view === "historique" ? (
          <article className="client-card">
            <header><h2>{c.activity}</h2></header>
            {workspace.releases.length === 0 ? <p className="franchise-empty-panel">{c.noActivity}</p> : (
              <ol className="franchise-activity">
                {workspace.releases.map((item) => (
                  <li key={item.id}><span className="franchise-dot" data-tone="violet" /><span><strong>{item.key}</strong><small>{item.status}</small></span></li>
                ))}
              </ol>
            )}
          </article>
        ) : null}
        <FranchiseMandatePerimeter locale={locale} name={workspace.mandate.libraryName} />
      </section>
    </main>
  );
}

export function FranchiseQuestionsBoard({ locale, questions,query="" }: { locale: Locale;query?:string; questions: FranchiseLibraryWorkspace["questions"] }) {
  const c = libraryCopy(locale);
  return (
    <article className="client-card">
      <header><h2>{c.createQuestion}</h2></header>
      {questions.length === 0 ? <p>{c.emptyQuestions}</p> : (
        <ul className="client-feed">
          {questions.map((item) => (
            <li key={item.id}>
              <span className="client-feed-icon" data-tone="mint"><Scale className="size-4" aria-hidden /></span>
              <span><Link href={`/${locale}/franchise/questions/${item.id}${query}`}><strong>{item.label}</strong></Link><small dir="ltr">{item.key} · {catalogStatusLabel(item.status, locale)}</small></span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function queueBucket(status: string): "todo" | "waiting" | "corrections" | "done" {
  if (status === "DRAFT") return "todo";
  if (["IN_REVIEW", "FRANCHISE_REVIEW", "CENTRAL_REVIEW", "LOCAL_TEST"].includes(status)) return "waiting";
  if (status === "REJECTED" || status === "CHANGES_REQUESTED") return "corrections";
  return "done";
}

export function FranchiseWorkQueueBoard({
  locale,
  query,
  workspace,
  bucket = "todo",
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  bucket?: "todo" | "waiting" | "corrections" | "done";
}) {
  const c = libraryCopy(locale);
  const all = [...workspace.questionnaires, ...workspace.services, ...workspace.rules]
    .filter((item) => item.status !== "ARCHIVED" && item.status !== "RETIRED");
  const counts = {
    todo: all.filter((item) => queueBucket(item.status) === "todo").length,
    waiting: all.filter((item) => queueBucket(item.status) === "waiting").length,
    corrections: all.filter((item) => queueBucket(item.status) === "corrections").length,
    done: all.filter((item) => queueBucket(item.status) === "done").length,
  };
  const rows = all.filter((item) => queueBucket(item.status) === bucket);
  const activity = all.slice(0, 5);
  const tabs = [
    { id: "todo" as const, label: c.queueTodo, value: counts.todo, tone: "violet" as const },
    { id: "waiting" as const, label: c.queueWaiting, value: counts.waiting, tone: "peach" as const },
    { id: "corrections" as const, label: c.queueCorrections, value: counts.corrections, tone: "peach" as const },
    { id: "done" as const, label: c.queueDone, value: counts.done, tone: "mint" as const },
  ];
  function bucketHref(id: typeof bucket) {
    const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    if (id === "todo") params.delete("bucket");
    else params.set("bucket", id);
    const next = params.toString();
    return `/${locale}/franchise/actions${next ? `?${next}` : ""}`;
  }
  return (
    <main className="client-page">
      <MandateBanner locale={locale} name={workspace.mandate.libraryName} />
      <section className="franchise-treat">
        {tabs.map((tab) => (
          <Link key={tab.id} href={bucketHref(tab.id)} className="franchise-kpi-tile" data-tone={tab.tone} data-active={bucket === tab.id ? "true" : undefined}>
            <span className="franchise-kpi-icon" data-tone={tab.tone}><FileText className="size-4" aria-hidden /></span>
            <span>
              <strong>{tab.label}</strong>
              <small dir="ltr">{tab.value}</small>
            </span>
          </Link>
        ))}
      </section>
      <section className="franchise-home-grid">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.queueItems} <small dir="ltr">({rows.length})</small></h2>
            <span className="franchise-sort-chip">{c.queueSort} · {c.queueSortDue}</span>
          </header>
          {rows.length === 0 ? <p>{c.emptyQueue}</p> : (
            <div className="client-table-wrap client-compare">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{c.kind}</th>
                    <th>{c.element}</th>
                    <th>{c.version}</th>
                    <th>{c.languages}</th>
                    <th>{c.state}</th>
                    <th>{c.queueDue}</th>
                    <th>{c.next}</th>
                    <th><span className="sr-only">{c.rowActions}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id}>
                      <td><KindChip kind={item.kind} locale={locale} /></td>
                      <td>
                        <span className="franchise-row-title">
                          <span className="franchise-kpi-icon" data-tone="violet"><KindIcon kind={item.kind} /></span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.subcategory ?? item.category ?? workspace.mandate.libraryName}</small>
                          </span>
                        </span>
                      </td>
                      <td>{item.versionLabel ?? "—"}</td>
                      <td><LanguageMarks item={item} /></td>
                      <td><em className="client-status-chip" data-tone={catalogStatusTone(item.status)}>{workflowChipLabel(item.status, locale)}</em></td>
                      <td><span className="franchise-due">—</span></td>
                      <td>
                        <span className="franchise-next-cell">
                          <small>{nextAction(item.status, locale)}</small>
                          <Link href={item.href} className="franchise-tool">{c.openItem}</Link>
                        </span>
                      </td>
                      <td><FranchiseRowMenu href={item.href} label={item.title} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="franchise-queue-foot">
            <p className="franchise-mandate-banner" role="note">
              <strong>{c.queueReminder}</strong>
              <small>{c.queueReminderBody} {workspace.mandate.libraryName}</small>
            </p>
            <p className="franchise-ask-panel">
              <MessageSquare className="size-4" aria-hidden />
              <span><strong>{c.queueAsk}</strong><small>{c.queueAskBody}</small></span>
            </p>
          </div>
        </article>
        <aside className="franchise-home-rail">
          <article className="client-card" id="activite">
            <header className="client-priority-head"><h2>{c.activity}</h2><Link href={`/${locale}/franchise/validations/historique${query}`} className="client-soft-link">{c.seeAll}</Link></header>
            {activity.length === 0 ? <p>{c.noActivity}</p> : (
              <ol className="franchise-activity">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className="franchise-dot" data-tone={catalogStatusTone(item.status)} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{catalogStatusLabel(item.status, locale)} · {workspace.mandate.libraryName}</small>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>
          <article className="client-card">
            <header><h2>{c.queueFilterTitle}</h2></header>
            <form className="franchise-filters" action={`/${locale}/franchise/actions`} method="get">
              <label>
                <span className="sr-only">{c.kind}</span>
                <select name="type" defaultValue="all"><option value="all">{c.queueAllTypes}</option></select>
              </label>
              <label>
                <span className="sr-only">{c.state}</span>
                <select name="state" defaultValue="all"><option value="all">{c.queueAllStates}</option></select>
              </label>
              <label>
                <span className="sr-only">{c.languages}</span>
                <select name="lang" defaultValue="all"><option value="all">{c.queueAllLanguages}</option></select>
              </label>
              <Link href={`/${locale}/franchise/actions${query}`} className="client-soft-link">{c.resetFilters}</Link>
            </form>
          </article>
        </aside>
      </section>
    </main>
  );
}

export function FranchiseLibraryOverviewBoard({
  locale,
  query,
  workspace,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
}) {
  const c = libraryCopy(locale);
  const published = workspace.counts.published;
  const categoryCount = workspace.categories.reduce((sum, cat) => sum + 1 + cat.children.length, 0);
  const totalElements = workspace.serverPage?workspace.serverPage.groups.SERVICE.total+workspace.serverPage.groups.QUESTIONNAIRE.total+workspace.serverPage.groups.RULE.total:workspace.services.length + workspace.questionnaires.length + workspace.rules.length;
  const coverage = totalElements === 0 ? 0 : Math.round((published / Math.max(totalElements, 1)) * 100);
  const versionLabel = `v${workspace.mandate.libraryRowVersion || 1}.0`;
  return (
    <main className="client-page">
      <MandateBanner locale={locale} name={workspace.mandate.libraryName} />
      <section className="franchise-treat">
        <article className="franchise-kpi-tile" data-tone="violet">
          <span className="franchise-kpi-icon" data-tone="violet"><BookOpen className="size-4" aria-hidden /></span>
          <span><strong dir="ltr">{published}</strong><small>{c.libraryPublishedCount}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="mint">
          <span className="franchise-kpi-icon" data-tone="mint"><ClipboardList className="size-4" aria-hidden /></span>
          <span><strong dir="ltr">{categoryCount}</strong><small>{c.libraryCategoriesCount}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="sky">
          <span className="franchise-kpi-icon" data-tone="sky"><Globe className="size-4" aria-hidden /></span>
          <span><strong>FR · AR</strong><small>{c.libraryLanguagesAvailable}</small></span>
        </article>
        <article className="franchise-kpi-tile" data-tone="sky">
          <span className="franchise-kpi-icon" data-tone="sky"><Lock className="size-4" aria-hidden /></span>
          <span><strong dir="ltr">{coverage} %</strong><small>{c.libraryCoveragePct}</small></span>
        </article>
      </section>
      <section className="franchise-library-grid">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.libraryTree}</h2>
            <Link href={`/${locale}/franchise/bibliotheque/categories${query}`} className="client-soft-link">{c.libraryExpandAll}</Link>
          </header>
          {workspace.categories.length === 0 ? <p className="franchise-empty-panel">{c.emptyCategories}</p> : (
            <ul className="franchise-tree">
              <li>
                <strong>{workspace.mandate.libraryName}</strong>
                <small dir="ltr">{totalElements} {c.libraryElementsIncluded}</small>
              </li>
              {workspace.categories.map((category) => (
                <li key={category.id}>
                  <details open>
                    <summary>
                      <span>{category.title}</span>
                      <small dir="ltr">{1 + category.children.length}</small>
                    </summary>
                    <ul>
                      {category.children.map((child) => (
                        <li key={child.id}><span>{child.title}</span></li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </article>
        <div className="client-stack">
          <article className="client-card">
            <header><h2>{c.libraryPublishedVersion}</h2></header>
            <p className="franchise-version-badge">
              <strong dir="ltr">{versionLabel}</strong>
              <em className="client-status-chip" data-tone="mint">{c.libraryReadOnly}</em>
            </p>
            <p className="client-access-note">{c.publishedImmutable}</p>
            <dl className="franchise-props">
              <div><dt>{c.libraryElementsIncluded}</dt><dd dir="ltr">{published}</dd></div>
              <div><dt>FR · AR</dt><dd>{c.libraryFullCoverage}</dd></div>
            </dl>
            <Link href={`/${locale}/franchise/bibliotheque/version${query}`} className="franchise-cta">{c.libraryPrepareVersion} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>
          </article>
          <article className="client-card">
            <header><h2>{c.libraryCoverage}</h2></header>
            <div className="franchise-coverage-row">
              <span>FR</span>
              <span className="franchise-complete"><span style={{ width: `${coverage}%` }} /></span>
              <small dir="ltr">{published}/{Math.max(totalElements, published || 1)}</small>
            </div>
            <div className="franchise-coverage-row">
              <span>AR</span>
              <span className="franchise-complete"><span style={{ width: `${coverage}%` }} /></span>
              <small dir="ltr">{published}/{Math.max(totalElements, published || 1)}</small>
            </div>
            <p className="client-access-note">{c.libraryCoverageOk}</p>
          </article>
        </div>
        <aside className="franchise-home-rail">
          <article className="client-card">
            <header className="client-priority-head">
              <h2>{c.libraryHistory}</h2>
              <Link href={`/${locale}/franchise/bibliotheque/historique${query}`} className="client-soft-link">{c.seeAll}</Link>
            </header>
            {workspace.releases.length === 0 ? <p className="franchise-empty-panel">{c.noActivity}</p> : (
              <ol className="franchise-activity">
                {workspace.releases.map((item, index) => (
                  <li key={item.id}>
                    <span className="franchise-dot" data-tone={index === 0 ? "mint" : "sky"} />
                    <span><strong dir="ltr">{item.key}</strong><small>{item.status}</small></span>
                  </li>
                ))}
              </ol>
            )}
          </article>
          <article className="client-card">
            <header className="client-priority-head">
              <h2>{c.libraryChangelog}</h2>
              <Link href={`/${locale}/franchise/bibliotheque/historique${query}`} className="client-soft-link">{c.seeAll}</Link>
            </header>
            <ul className="franchise-dot-list">
              {[...workspace.services, ...workspace.questionnaires, ...workspace.rules].slice(0, 4).map((item) => (
                <li key={item.id}>
                  <span className="franchise-dot" data-tone="violet" />
                  <span><strong>{item.title}</strong><small>{catalogStatusLabel(item.status, locale)}</small></span>
                </li>
              ))}
            </ul>
          </article>
          <FranchiseMandatePerimeter locale={locale} name={workspace.mandate.libraryName} />
        </aside>
      </section>
    </main>
  );
}
