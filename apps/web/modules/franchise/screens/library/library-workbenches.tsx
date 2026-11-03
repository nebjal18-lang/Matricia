import{CatalogServerPagination}from"./server-pagination";
import Link from "next/link";
import { Beaker, ClipboardList, Eye, GitBranch, ListOrdered, Lock, Plus, RotateCcw, Send, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { QuestionnaireBuilder } from "@/modules/admin/screens/catalogue/questionnaire-builder";
import { QuestionBuilder } from "@/modules/admin/screens/catalogue/question-builder";
import { RuleBuilder } from "@/modules/admin/screens/catalogue/rule-builder";
import { getBuilderMessages } from "@/modules/admin/screens/catalogue/messages";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import type { FranchiseCatalogRow, FranchiseLibraryWorkspace, FranchiseQuestionRow } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { MandateBanner, StatusChip, kindLabel, nextAction } from "./library-boards";
import { FranchiseScopeInfo } from "./library-chrome";
import { FranchiseServiceDraftForm, FranchiseServiceCommandForms } from "./service-builder";
import { FranchiseQuestionnaireSandbox } from "./sandbox-form";
import { FranchiseArchiveServiceForm, FranchiseCatalogSubmitForm, FranchiseCloneQuestionnaireForm, FranchiseDuplicateServiceForm, FranchisePublishReleaseForm } from "./catalog-commands";
import { ServicesCatalogPanel } from "./services-catalog-panel";

function Toolbar({ children }: { children: ReactNode }) {
  return <div className="franchise-toolbar">{children}</div>;
}

function ToolLink({ href, label, tone = "ghost", icon }: { href: string; label: string; tone?: "primary" | "ghost" | "mint" | "peach"; icon?: ReactNode }) {
  return <Link href={href} className={`franchise-tool franchise-tool-${tone}`}>{icon}{label}</Link>;
}

function completeness(item: FranchiseCatalogRow) {
  return Math.round(([item.nameFr, item.nameAr, item.description].filter(Boolean).length / 3) * 100);
}

function answerTypeLabel(type: string | null, locale: Locale) {
  const fr: Record<string, string> = { YES_NO: "Choix unique", SINGLE_CHOICE: "Choix unique", INTEGER: "Nombre exact", SHORT_TEXT: "Document", LONG_TEXT: "Texte", DATE: "Date", MONEY: "Montant" };
  const ar: Record<string, string> = { YES_NO: "اختيار واحد", SINGLE_CHOICE: "اختيار واحد", INTEGER: "عدد دقيق", SHORT_TEXT: "وثيقة", LONG_TEXT: "نص", DATE: "تاريخ", MONEY: "مبلغ" };
  return (locale === "ar" ? ar : fr)[type ?? ""] ?? type ?? "—";
}

export function FranchiseServicesWorkbench({
  locale,
  query,
  workspace,
  selectedId,
  createMode,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  selectedId: string | null;
  createMode: boolean;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const selected = workspace.services.find((item) => item.id === selectedId) ?? (createMode ? null : workspace.services[0] ?? null);
  return (
    <main className="client-page">
      <FranchiseScopeInfo locale={locale} />
      <Toolbar>
        <ToolLink href={`/${locale}/franchise/services/nouveau${query}`} label={c.newService} tone="primary" icon={<Plus className="size-4" aria-hidden />} />
        <ToolLink href={selected ? `/${locale}/franchise/services/${selected.id}/simulation${query}` : `/${locale}/franchise/services${query}`} label={c.simulate} tone="mint" />
        <ToolLink href={selected ? `/${locale}/franchise/services/${selected.id}/validation${query}` : `/${locale}/franchise/validations${query}`} label={c.submitValidation} />
      </Toolbar>
      <section className="franchise-workbench franchise-workbench-services">
        <ServicesCatalogPanel serverPage={workspace.serverPage} locale={locale} workspaceName={workspace.mandate.libraryName} categories={workspace.categories} services={workspace.services} selectedId={selected?.id ?? null} libraryId={workspace.mandate.libraryId} organizationId={organizationId} commandIdentity={commandIdentity} />
        <aside className="client-card franchise-service-drawer">
          {createMode || !selected ? (
            <>
              <header><h2>{c.newService}</h2></header>
              <FranchiseServiceDraftForm locale={locale} workspace={workspace} commandIdentity={commandIdentity} organizationId={organizationId} />
            </>
          ) : (
            <ServiceProperties locale={locale} workspace={workspace} service={selected} commandIdentity={commandIdentity} organizationId={organizationId} />
          )}
        </aside>
      </section>
    </main>
  );
}

function ServiceProperties({ locale, workspace, service, commandIdentity, organizationId }: { locale: Locale; workspace: FranchiseLibraryWorkspace; service: FranchiseCatalogRow; commandIdentity: { idempotencyKey: string; correlationId: string }; organizationId: string | null }) {
  const c = libraryCopy(locale);
  const score = completeness(service);
  return (
    <>
      <header className="client-priority-head">
        <h2>{service.title}</h2>
        <StatusChip status={service.status} locale={locale} />
      </header>
      <nav className="franchise-inspector-tabs" aria-label={c.properties}>
        <a href="#contenu" data-active="true">{c.inspectorContent}</a>
        <a href="#conditions">{c.inspectorConditions}</a>
        <a href="#documents">{c.inspectorDocuments}</a>
        <a href="#historique">{c.inspectorHistory}</a>
      </nav>
      <section id="contenu">
        <p className="client-access-note">{workspace.mandate.libraryName} · {service.code}</p>
        <h3>{c.generalInfo}</h3>
        <dl className="franchise-props">
          <div><small>{c.labelFr}</small><span>{service.nameFr ?? service.title}</span></div>
          <div><small>{c.labelAr}</small><span dir="rtl" lang="ar">{service.nameAr ?? "—"}</span></div>
          <div><small>{c.linked}</small><span>{service.category ?? "—"} / {service.subcategory ?? "—"}</span></div>
          <div><small>{c.version}</small><span>{service.versionLabel ?? "—"}</span></div>
        </dl>
        {service.description ? <p>{service.description}</p> : null}
        <div className="franchise-split">
          <article>
            <h3>{c.draftCompleteness}</h3>
            <span className="franchise-complete" aria-hidden><span style={{ width: `${score}%` }} /></span>
            <p><bdi dir="ltr">{score}%</bdi></p>
          </article>
          <article>
            <h3>{c.matriciaReturn}</h3>
            <p>{c.noMatriciaReturn}</p>
          </article>
        </div>
      </section>
      <section id="conditions">
        <h3>{c.inspectorConditions}</h3>
        <p>{c.conditionalVisibility}</p>
      </section>
      <section id="documents">
        <h3>{c.inspectorDocuments}</h3>
        <p>{c.noDocuments}</p>
      </section>
      <section id="historique">
        <h3>{c.inspectorHistory}</h3>
        <p>{service.versionLabel ?? "v1"} · {kindLabel(service.kind, locale)}</p>
      </section>
      <ul className="franchise-draft-checklist">
        {c.draftChecklist.map((item, index) => {
          const done = index < Math.round((score / 100) * c.draftChecklist.length);
          return <li key={item} data-done={done ? "true" : undefined}>{item}</li>;
        })}
      </ul>
      <p className="franchise-matricia-note" role="note">{c.matriciaReturn}: {c.noMatriciaReturn}</p>
      {service.command ? (
        <>
          <FranchiseServiceCommandForms locale={locale} workspace={workspace} service={service} commandIdentity={commandIdentity} organizationId={organizationId} />
          <FranchiseDuplicateServiceForm locale={locale} workspace={workspace} service={service} commandIdentity={commandIdentity} organizationId={organizationId} />
          <FranchiseArchiveServiceForm locale={locale} workspace={workspace} service={service} commandIdentity={commandIdentity} organizationId={organizationId} />
        </>
      ) : null}
      {service.status === "APPROVED" ? (
        <FranchisePublishReleaseForm locale={locale} workspace={workspace} commandIdentity={commandIdentity} organizationId={organizationId} />
      ) : null}
      <div className="franchise-security-inline" role="note">
        <p><Lock className="size-4" aria-hidden /> {c.securityReminders}</p>
        <ul>{c.securityBullets.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </>
  );
}

export function FranchiseQuestionnairesWorkbench({
  locale,
  query,
  workspace,
  selectedId,
  createMode,
  commandIdentity,
  search = "",
  organizationId = null,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  selectedId: string | null;
  createMode: boolean;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  search?: string;
  organizationId?: string | null;
}) {
  const c = libraryCopy(locale);
  const listed=workspace.questionnaires;
  const selected = listed.find((item) => item.id === selectedId) ?? workspace.questionnaires.find((item) => item.id === selectedId) ?? listed[0] ?? workspace.questionnaires[0] ?? null;
  const questions = workspace.questions.filter((item) => !selected || item.questionnaireId === selected.id || item.questionnaireId === null);
  const selectedQuestion: FranchiseQuestionRow | null = questions[0] ?? null;
  const firstService = workspace.services[0] ?? null;
  const messages = getBuilderMessages(locale);
  return (
    <main className="client-page">
      <MandateBanner locale={locale} name={workspace.mandate.libraryName} />
      <Toolbar>
        <ToolLink href={`/${locale}/franchise/questionnaires/nouveau${query}`} label={c.createQuestionnaire} tone="primary" icon={<Plus className="size-4" aria-hidden />} />
        <ToolLink href={selected ? `${selected.href}${query}` : `/${locale}/franchise/questionnaires/nouveau${query}`} label={c.reorder} tone="peach" icon={<ListOrdered className="size-4" aria-hidden />} />
        <ToolLink href={selected ? `/${locale}/franchise/questionnaires/${selected.id}/apercu${query}` : `/${locale}/franchise/questionnaires${query}`} label={c.previewClient} icon={<Eye className="size-4" aria-hidden />} />
        <ToolLink href={selected ? `/${locale}/franchise/questionnaires/${selected.id}/simulation${query}` : `/${locale}/franchise/regles${query}#simulation`} label={c.testBranches} icon={<GitBranch className="size-4" aria-hidden />} />
        <ToolLink href={`/${locale}/franchise/validations${query}`} label={c.submitValidation} tone="mint" icon={<Send className="size-4" aria-hidden />} />
      </Toolbar>
      <section className="franchise-workbench">
        <article className="client-card">
          <header><h2>{c.questionnairesTitle}</h2></header>
          <form className="franchise-search" method="get" action={`/${locale}/franchise/questionnaires`} role="search">
            {query.includes("organizationId=") ? <input type="hidden" name="organizationId" value={new URLSearchParams(query.startsWith("?") ? query.slice(1) : query).get("organizationId") ?? ""} /> : null}
            <label className="sr-only" htmlFor="franchise-q-search">{c.searchQuestionnaire}</label>
            <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId}/><input id="franchise-q-search" name="q" defaultValue={search} placeholder={c.searchQuestionnaire} />
          </form>
          {listed.length === 0 ? <p>{c.emptyQuestionnaires}</p> : (
            <ul className="client-feed">
              {listed.map((item) => (
                <li key={item.id} data-selected={selected?.id === item.id ? "true" : undefined}>
                  <span className="franchise-kpi-icon" data-tone="violet"><ClipboardList className="size-4" aria-hidden /></span>
                  <span><strong>{item.title}</strong></span>
                  <StatusChip status={item.status} locale={locale} />
                  <Link href={item.href} className="client-soft-link" aria-label={item.title}>›</Link>
                </li>
              ))}
            </ul>
          )}<CatalogServerPagination page={workspace.serverPage} locale={locale} query={query}/>
        </article>
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{selected ? selected.title : c.questionnairesTitle}</h2>
            {selected ? <StatusChip status={selected.status} locale={locale} /> : null}
          </header>
          <ol className="franchise-mini-pipe">
            {c.questionnaireCycle.map(([title, text], index) => (
              <li key={title} data-active={index === 0 ? "true" : undefined}>
                <em>{index + 1}</em>
                <strong>{title}</strong>
                <small>{text}</small>
              </li>
            ))}
          </ol>
          {questions.length === 0 ? <p>{c.emptyQuestions}</p> : (
            <ol className="franchise-question-list">
              {questions.map((item, index) => (
                <li key={item.id}>
                  <span className="client-num">{index + 1}</span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{answerTypeLabel(item.answerType, locale)}</small>
                  </span>
                  <em className="franchise-kind-chip">{answerTypeLabel(item.answerType, locale)}</em>
                </li>
              ))}
            </ol>
          )}
          {firstService ? (
            <details className="franchise-builder" id="question">
              <summary className="franchise-tool franchise-tool-primary"><Plus className="size-4" aria-hidden /> {c.addQuestion}</summary>
              <QuestionBuilder
                locale={locale}
                library={{ id: workspace.mandate.libraryId, code: workspace.mandate.libraryCode }}
                service={{ id: firstService.id, code: firstService.code }}
                messages={messages}
                commandIdentity={commandIdentity}
              />
            </details>
          ) : <p className="client-access-note">{c.emptyServices}</p>}
          <p className="franchise-warning" role="note"><ShieldAlert className="size-4" aria-hidden /> {c.versionWarning}</p>
          <section id="simulation">
            <h3>{c.sandbox}</h3>
            <FranchiseQuestionnaireSandbox locale={locale} workspace={workspace} organizationId={organizationId} selectedQuestionnaireId={selected?.id ?? null} />
          </section>
        </article>
        <aside className="client-card">
          <header className="client-priority-head">
            <h2>{createMode || !selectedQuestion ? c.createQuestionnaire : c.questionProperties}</h2>
          </header>
          {selectedQuestion && !createMode ? (
            <form className="franchise-props-form">
              <label className="franchise-field">{c.questionType}
                <input readOnly value={answerTypeLabel(selectedQuestion.answerType, locale)} />
              </label>
              <label className="franchise-field">{c.technicalKey}
                <input readOnly dir="ltr" value={selectedQuestion.key} />
              </label>
              <div className="franchise-split">
                <label className="franchise-field">{c.labelFr}
                  <input readOnly value={selectedQuestion.labelFr ?? (locale === "fr" ? selectedQuestion.label : "")} />
                </label>
                <label className="franchise-field">{c.labelAr}
                  <input readOnly dir="rtl" lang="ar" value={selectedQuestion.labelAr ?? (locale === "ar" ? selectedQuestion.label : "")} />
                </label>
              </div>
              <label className="franchise-field">{c.helpFr}
                <textarea readOnly rows={2} value={selectedQuestion.helpFr ?? (locale === "fr" ? selectedQuestion.help : "")} />
              </label>
              <label className="franchise-field">{c.helpAr}
                <textarea readOnly rows={2} dir="rtl" lang="ar" value={selectedQuestion.helpAr ?? (locale === "ar" ? selectedQuestion.help : "")} />
              </label>
              <p className="client-access-note">{c.requiredAnswer}: {selectedQuestion.required ? "Oui" : "Non"}</p>
              {firstService ? (
                <label className="franchise-field">{c.associateService}
                  <input readOnly value={firstService.title} />
                </label>
              ) : null}
            </form>
          ) : null}
          <details className="franchise-builder" id="nouveau" open={createMode || workspace.questionnaires.length === 0}>
            <summary>{c.createQuestionnaire}</summary>
            <QuestionnaireBuilder
              locale={locale}
              library={{ id: workspace.mandate.libraryId, code: workspace.mandate.libraryCode, currentReleaseId: workspace.mandate.currentReleaseId }}
              messages={messages}
              commandIdentity={commandIdentity}
            />
          </details>
          {selected && !createMode ? (
            <>
              <dl className="franchise-props">
                <div><small>{c.technicalKey}</small><span dir="ltr">{selected.code}</span></div>
                <div><small>{c.version}</small><span>{selected.versionLabel ?? "—"}</span></div>
                <div><small>{c.state}</small><StatusChip status={selected.status} locale={locale} /></div>
              </dl>
              <FranchiseCatalogSubmitForm locale={locale} workspace={workspace} item={selected} commandIdentity={commandIdentity} organizationId={organizationId} />
              <FranchiseCloneQuestionnaireForm locale={locale} workspace={workspace} item={selected} commandIdentity={commandIdentity} organizationId={organizationId} />
            </>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

export function FranchiseRulesWorkbench({
  locale,
  query,
  workspace,
  selectedId,
  createMode,
  commandIdentity,
  search = "",
  organizationId = null,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  selectedId: string | null;
  createMode: boolean;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  search?: string;
  organizationId?: string | null;
}) {
  const c = libraryCopy(locale);
  const listed=workspace.rules;
  const selected = listed.find((item) => item.id === selectedId) ?? workspace.rules.find((item) => item.id === selectedId) ?? listed[0] ?? workspace.rules[0] ?? null;
  const messages = getBuilderMessages(locale);
  const firstService = workspace.services[0];
  return (
    <main className="client-page">
      <MandateBanner locale={locale} name={workspace.mandate.libraryName} />
      <Toolbar>
        <ToolLink href={selected ? `/${locale}/franchise/regles${query}?ruleId=${selected.id}` : `/${locale}/franchise/regles${query}`} label={c.saveDraft} />
        <ToolLink href={`/${locale}/franchise/regles${query}#simulation`} label={c.simulate} tone="mint" icon={<Beaker className="size-4" aria-hidden />} />
        <ToolLink href={`/${locale}/franchise/validations${query}`} label={c.submitMatricia} tone="primary" icon={<Send className="size-4" aria-hidden />} />
      </Toolbar>
      <section className="franchise-workbench">
        <article className="client-card">
          <header className="client-priority-head"><h2>{c.libraryRules}</h2><Link href={`/${locale}/franchise/regles/nouvelle${query}`} className="franchise-tool franchise-tool-primary"><Plus className="size-4" aria-hidden /> {c.newRule}</Link></header>
          <form className="franchise-search" method="get" action={`/${locale}/franchise/regles`} role="search">
            {query.includes("organizationId=") ? <input type="hidden" name="organizationId" value={new URLSearchParams(query.startsWith("?") ? query.slice(1) : query).get("organizationId") ?? ""} /> : null}
            {selected ? <input type="hidden" name="ruleId" value={selected.id} /> : null}
            <label className="sr-only" htmlFor="franchise-rule-search">{c.searchRule}</label>
            <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId}/><input id="franchise-rule-search" name="q" defaultValue={search} placeholder={c.searchRule} />
          </form>
          {listed.length === 0 ? <p>{c.emptyRules}</p> : (
            <ul className="client-feed">
              {listed.map((item) => (
                <li key={item.id} data-selected={selected?.id === item.id ? "true" : undefined}>
                  <span className="franchise-kpi-icon" data-tone="violet"><GitBranch className="size-4" aria-hidden /></span>
                  <span><strong dir="ltr">{item.title}</strong><small>{item.versionLabel ?? ""}</small></span>
                  <StatusChip status={item.status} locale={locale} />
                  <Link href={item.href} className="client-soft-link">{nextAction(item.status, locale)}</Link>
                </li>
              ))}
            </ul>
          )}<CatalogServerPagination page={workspace.serverPage} locale={locale} query={query}/>
          <p className="client-access-note">{c.goodPractices}</p>
        </article>
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{createMode || !selected ? c.newRule : selected.title}</h2>
            {selected && !createMode ? <StatusChip status={selected.status} locale={locale} /> : null}
          </header>
          <details className="franchise-builder" id="nouveau" open>
            <summary>{c.createRule}</summary>
            <RuleBuilder
              locale={locale}
              library={{ id: workspace.mandate.libraryId, code: workspace.mandate.libraryCode }}
              messages={messages}
              commandIdentity={commandIdentity}
            />
          </details>
          {selected ? (
            <>
              <p className="franchise-effect" role="note">{c.effectPreview} {firstService ? firstService.title : selected.title}</p>
              <FranchiseCatalogSubmitForm locale={locale} workspace={workspace} item={selected} commandIdentity={commandIdentity} organizationId={organizationId} />
            </>
          ) : null}
        </article>
        <aside className="franchise-home-rail">
          <article className="client-card" id="simulation">
            <header className="client-priority-head">
              <h2><Beaker className="size-4" aria-hidden /> {c.sandbox}</h2>
              <Link href={`/${locale}/franchise/regles${query}#simulation`} className="client-soft-link"><RotateCcw className="size-4" aria-hidden /> {c.resetSimulation}</Link>
            </header>
            <p>{c.sandboxHelp}</p>
            <FranchiseQuestionnaireSandbox locale={locale} workspace={workspace} organizationId={organizationId} selectedQuestionnaireId={workspace.questionnaires[0]?.id ?? null} />
          </article>
          <article className="client-card">
            <header><h2>{c.validationProcess}</h2></header>
            <ol className="franchise-process">
              {c.validationSteps.map(([title, text], index) => (
                <li key={title}><span className="client-num">{index + 1}</span><span><strong>{title}</strong><small>{text}</small></span></li>
              ))}
            </ol>
            <ul className="franchise-guarantees">
              {c.validationGuarantees.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="franchise-warning" role="note"><Send className="size-4" aria-hidden /> {c.conflictsNote}</p>
          </article>
        </aside>
      </section>
    </main>
  );
}
