import { FranchiseRuleEditor } from "./rule-editor";
import { QuestionnaireCompositionEditor } from "./composition-editor";
import Link from "next/link";
import {
  Beaker,
  Check,
  CheckCircle2,
  FileText,
  Send,
} from "lucide-react";
import { QuestionnaireBuilder } from "@/modules/admin/screens/catalogue/questionnaire-builder";
import { getBuilderMessages } from "@/modules/admin/screens/catalogue/messages";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import type { FranchiseCatalogRow, FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { MandateBanner, StatusChip } from "./library-boards";
import { FranchiseCatalogSubmitForm } from "./catalog-commands";
import { FranchiseServiceCommandForms, FranchiseServiceDraftForm } from "./service-builder";
import { FranchiseQuestionnaireSandbox } from "./sandbox-form";

function Stepper({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol className="franchise-stepper" aria-label="Étapes">
      {steps.map((label, index) => (
        <li key={label} data-active={index === current ? "true" : undefined} data-done={index < current ? "true" : undefined}>
          <em>{index < current ? <Check className="size-3.5" aria-hidden /> : index + 1}</em>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function BuilderFooter({
  locale,
  cancelHref,
  simulateHref,
  submitHref,
}: {
  locale: Locale;
  query: string;
  cancelHref: string;
  simulateHref: string;
  submitHref: string;
  draftSaved: boolean;
}) {
  const c = libraryCopy(locale);
  return (
    <footer className="franchise-builder-footer">
      <Link href={cancelHref} className="franchise-tool">{c.cancel}</Link>
      <p className="franchise-autosave" role="status">{locale === "ar" ? "يُحفظ التعديل من خلال النموذج أدناه." : "Les modifications sont enregistrées depuis le formulaire de cette version."}</p>
      <div className="franchise-builder-actions">
        <Link href={cancelHref} className="franchise-tool">{locale === "ar" ? "العودة إلى المسودات" : "Retour aux brouillons"}</Link>
        <Link href={simulateHref} className="franchise-tool franchise-tool-mint"><Beaker className="size-4" aria-hidden /> {c.simulate}</Link>
        <Link href={submitHref} className="franchise-tool franchise-tool-primary"><Send className="size-4" aria-hidden /> {c.submitMatricia}</Link>
      </div>
    </footer>
  );
}

export function FranchiseServiceConstructor({
  locale,
  query,
  workspace,
  service,
  createMode,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  service: FranchiseCatalogRow | null;
  createMode: boolean;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const steps = c.serviceSteps;
  const title = service?.title ?? c.createService;
  const description = service?.description ?? c.servicePreviewFallback;
  const storedDeliverables=service?.command?.fulfillmentConfig.deliverables;
  const deliverables=Array.isArray(storedDeliverables)?storedDeliverables.flatMap((item:unknown)=>{if(typeof item==="string")return[item];if(item&&typeof item==="object"){const text=(item as Record<string,unknown>)[locale==="ar"?"label_ar":"label_fr"];return typeof text==="string"?[text]:[];}return[];}):[];
  return (
    <main className="client-page">
      <MandateBanner locale={locale} name={workspace.mandate.libraryName} />
      <header className="franchise-builder-head">
        <div>
          <h2>{c.serviceConstructorTitle}</h2>
          <p>{c.serviceConstructorLead}</p>
        </div>
        {service ? <StatusChip status={service.status} locale={locale} /> : <em className="client-status-chip" data-tone="violet">{c.validationPending}</em>}
      </header>
      <Stepper steps={steps} current={0} />
      <section className="franchise-constructor-grid">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.generalInfo}</h2>
            <span className="franchise-lang-toggle" aria-hidden><em data-active="true">FR</em><em>AR</em></span>
          </header>
          {createMode || !service ? (
            <FranchiseServiceDraftForm locale={locale} workspace={workspace} commandIdentity={commandIdentity} organizationId={organizationId} />
          ) : service.command ? (
            <FranchiseServiceCommandForms locale={locale} workspace={workspace} service={service} commandIdentity={commandIdentity} organizationId={organizationId} />
          ) : (
            <dl className="franchise-props">
              <div><dt>{c.labelFr}</dt><dd>{service.nameFr ?? service.title}</dd></div>
              <div><dt>{c.labelAr}</dt><dd dir="rtl" lang="ar">{service.nameAr ?? "—"}</dd></div>
              <div><dt>{c.linked}</dt><dd>{service.category ?? "—"} / {service.subcategory ?? "—"}</dd></div>
              <div><dt>{c.version}</dt><dd>{service.versionLabel ?? "—"}</dd></div>
            </dl>
          )}
          <section className="franchise-deliverables">
            <h3>{c.expectedDeliverables}</h3>
            <ul>
              {deliverables.map((item) => (
                <li key={item}>
                  <strong>{item}</strong>
                </li>
              ))}
            </ul>
            <p className="client-access-note">{deliverables.length?c.addDeliverableHint:locale==="ar"?"لم تُحفظ مخرجات لهذا الإصدار بعد.":"Aucun livrable n’a encore été enregistré pour cette version."}</p>
          </section>
        </article>
        <aside className="client-card franchise-client-preview">
          <header className="client-priority-head">
            <h2>{c.clientPreview}</h2>
            <span className="franchise-lang-toggle" aria-hidden><em data-active="true">FR</em><em>AR</em></span>
          </header>
          <article className="franchise-preview-card">
            <span className="franchise-kpi-icon" data-tone="violet"><FileText className="size-4" aria-hidden /></span>
            <div>
              <strong>{title}</strong>
              <em className="client-status-chip" data-tone="mint">{c.serviceKind}</em>
            </div>
            <p>{description}</p>
            <h3>{c.includedDeliverables}</h3>
            <ul className="franchise-check-list">
              {deliverables.map((item) => (
                <li key={item}><CheckCircle2 className="size-4" aria-hidden />{item}</li>
              ))}
            </ul>
          </article>
          <p className="franchise-mandate-banner" role="note">{c.previewIndicative}</p>
        </aside>
      </section>
      <BuilderFooter
        locale={locale}
        query={query}
        cancelHref={`/${locale}/franchise/services${query}`}
        simulateHref={service ? `/${locale}/franchise/services/${service.id}/simulation${query}` : `/${locale}/franchise/services${query}`}
        submitHref={service ? `/${locale}/franchise/services/${service.id}/validation${query}` : `/${locale}/franchise/validations${query}`}
        draftSaved
      />
    </main>
  );
}

export function FranchiseQuestionnaireConstructor({
  locale,
  query,
  workspace,
  selectedId,
  createMode,
  commandIdentity,
  organizationId = null,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  selectedId: string | null;
  createMode: boolean;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId?: string | null;
}) {
  const c = libraryCopy(locale);
  const selected = workspace.questionnaires.find((item) => item.id === selectedId) ?? workspace.questionnaires[0] ?? null;
  return <main className="client-page">
    <MandateBanner locale={locale} name={workspace.mandate.libraryName} />
    {createMode || !selected ? <QuestionnaireBuilder locale={locale} messages={getBuilderMessages(locale)} library={{ id: workspace.mandate.libraryId, code: workspace.mandate.libraryCode, currentReleaseId: workspace.mandate.currentReleaseId }} commandIdentity={commandIdentity} /> : <QuestionnaireCompositionEditor key={selected.draftVersionId ?? selected.id} workspace={workspace} selected={selected} locale={locale} organizationId={organizationId} />}
    <Link href={`/${locale}/franchise/questionnaires${query}`} className="franchise-tool">{c.cancel}</Link>
  </main>;
}

export function FranchiseClientPreviewBranches({
  locale,
  query,
  workspace,
  questionnaireId,
  organizationId = null,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  questionnaireId: string | null;
  organizationId?: string | null;
}) {
  const selected = workspace.questionnaires.find((item) => item.id === questionnaireId) ?? workspace.questionnaires[0] ?? null;
  return <main className="client-page"><MandateBanner locale={locale} name={workspace.mandate.libraryName}/>
    <header className="franchise-builder-head"><div><h2>{locale === "ar" ? "محاكاة الاستبيان" : "Simulation du questionnaire"}</h2><p>{locale === "ar" ? "أدخلوا إجابات السيناريو لتقييم قواعد هذا الإصدار في الخادم. لا تؤثر المحاكاة على التشخيصات الحقيقية." : "Saisissez les réponses du scénario pour évaluer les règles de cette version sur le serveur. La simulation ne modifie aucun diagnostic réel."}</p></div></header>
    <section className="client-card"><FranchiseQuestionnaireSandbox key={selected?.id} locale={locale} workspace={workspace} organizationId={organizationId} selectedQuestionnaireId={selected?.id ?? null}/></section>
    <Link href={`/${locale}/franchise/questionnaires${query}`} className="franchise-tool">{locale === "ar" ? "العودة إلى الاستبيانات" : "Retour aux questionnaires"}</Link>
  </main>;
}

export function FranchiseRuleConstructor({
  locale,
  query,
  workspace,
  selectedId,
  createMode,
  commandIdentity,
  organizationId = null,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  selectedId: string | null;
  createMode: boolean;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId?: string | null;
}) {
  const selected = createMode ? null : workspace.rules.find((item) => item.id === selectedId) ?? workspace.rules[0] ?? null;
  return <main className="client-page"><MandateBanner locale={locale} name={workspace.mandate.libraryName}/>
    <FranchiseRuleEditor key={selected?.id??"new"} locale={locale} workspace={workspace} selected={selected} organizationId={organizationId}/>
    {selected ? <FranchiseCatalogSubmitForm locale={locale} workspace={workspace} item={selected} commandIdentity={commandIdentity} organizationId={organizationId}/> : null}
    <Link href={`/${locale}/franchise/regles${query}`} className="franchise-tool">{locale === "ar"?"العودة إلى القواعد":"Retour aux règles"}</Link>
  </main>;
}
