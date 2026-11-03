import { quoteStatusLabel } from "@/modules/provider/screens/devis/status-labels";
import { SignedScopePendingNotice } from "@/modules/shared/ui/signed-scope-pending-notice";
import {workflowStatusLabel}from"@/modules/shared/lib/i18n/workflow-statuses";
import { InvoiceFacts } from "@/modules/provider/screens/facturation/invoice-facts";
import type { ProviderInvoiceDossier } from "@/modules/provider/data/billing/dossier";
import { compareQuoteRevisions } from "@/modules/provider/data/quotes/revision-diff";
import type { ProviderQuoteRevision } from "@/modules/provider/data/quotes/repository";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  Building2,
  Calendar,
  Check,
  ClipboardCheck,
  FileText,
  FolderOpen,
  Lock,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Settings2,
  Target,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatMinor } from "@/modules/provider/data/billing/model";
import type { BillingDashboard } from "@/modules/provider/data/billing/model";
import type { ProviderMissionDashboard } from "@/modules/provider/data/missions/model";
import { consultationDocumentHref, type ConsultationPackDocument, type ProviderQuoteDashboard } from "@/modules/provider/data/quotes/model";
import { workbenchCopy } from "@/modules/provider/data/spaces/workbench-copy";
import { ProviderProfileRail } from "@/modules/provider/ui/provider-profile-rail";
import { BillingPanel } from "@/modules/provider/screens/facturation/billing-panel";
import type { BillingMessages } from "@/modules/provider/screens/facturation/messages";
import type { MissionOption } from "@/modules/provider/screens/facturation/options";
import { QuotePanel } from "@/modules/provider/screens/devis/quote-panel";
import type { QuotePrefill } from "@/modules/provider/screens/devis/prefill";
import type { ProviderQuoteMessages } from "@/modules/provider/screens/devis/messages";
import { MissionsPanel } from "@/modules/provider/screens/missions/missions-panel";
import type { ProviderMissionMessages } from "@/modules/provider/screens/missions/messages";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function Crumb({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="client-text-link">{children}</Link>;
}

function CardHead({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <header className="provider-card-head">
      <span className="provider-card-icon" aria-hidden>{icon}</span>
      <h3>{children}</h3>
    </header>
  );
}

function ScopeNote({ locale, query }: { locale: Locale; query: string }) {
  const w = workbenchCopy(locale);
  return (
    <article className="client-card provider-scope-note" role="status">
      <Lock className="size-4" aria-hidden />
      <div>
        <strong>{w.outOfScope}</strong>
        <p>{w.outOfScopeLead}</p>
      </div>
      <Link href={`/${locale}/sous-traitant/consultations${query}`} className="client-ghost-link">
        {w.breadcrumbConsult}
        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
    </article>
  );
}

function formatMedium(locale: Locale, value: string, withTime = false) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    dateStyle: "medium",
    timeZone: "Africa/Casablanca",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

export function ConsultationDetailWorkbench({
  locale,
  query,
  consultationId,
  invitation,
  quotePanel,
}: {
  locale: Locale;
  query: string;
  consultationId: string;
  invitation?: ProviderQuoteDashboard["invitations"][number] | null;
  quotePanel?: ReactNode;
}) {
  const w = workbenchCopy(locale);
  const pack = invitation?.pack;
  const title = invitation?.description ?? w.consultDetailTitle;
  const deadline = invitation ? formatMedium(locale, invitation.deadline, true) : "—";
  const messagesHref = invitation
    ? `/${locale}/sous-traitant/messages${query}${query.includes("?") ? "&" : "?"}rfq=${encodeURIComponent(invitation.rfqId)}`
    : `/${locale}/sous-traitant/messages${query}`;
  const quoteHref = `/${locale}/sous-traitant/devis/${invitation?.quote?.id ?? invitation?.id ?? consultationId}${query}`;
  const objective = pack?.objective ?? invitation?.description ?? w.consultDetailLead;
  const scopeItems = pack?.scope.length
    ? pack.scope
    : invitation?.regionCode && invitation.regionCode !== "—"
      ? [invitation.regionCode]
      : [];
  const deliverables = pack?.deliverables ?? [];
  const constraints = pack?.constraints ?? [];
  const documents: ConsultationPackDocument[] = pack?.documents ?? [];
  const region = invitation?.regionCode && invitation.regionCode !== "—" ? invitation.regionCode : w.consultLocationFallback;
  const quoteStatus = invitation?.quote?.status;
  const quoteDecided = quoteStatus === "SELECTED" || quoteStatus === "REJECTED";
  const quoteSent = quoteDecided || quoteStatus === "SUBMITTED" || quoteStatus === "CLARIFICATION_REQUESTED";
  return (
    <main className="client-page provider-workbench provider-consult-detail">
      <p className="provider-breadcrumb">
        <Crumb href={`/${locale}/sous-traitant/consultations${query}`}>{w.breadcrumbConsult}</Crumb>
        <span aria-hidden>›</span>
        <span>{w.breadcrumbConsultDetail}</span>
      </p>
      <header className="provider-workbench-hero">
        <div>
          <p className="client-space-label" dir="ltr">#{consultationId.slice(0, 12)}</p>
          <h2>{title}</h2>
          <p>{w.consultDetailLead}</p>
          <div className="provider-chip-row">
            <span className="provider-meta-chip"><MapPin className="size-3.5" aria-hidden />{region}</span>
            <span className="client-status-chip" data-tone="mint">{w.consultOnInvite}</span>
          </div>
        </div>
        <div className="provider-workbench-meta">
          <span className="provider-deadline-box">
            <Calendar className="size-4" aria-hidden />
            <span>
              <strong>{w.consultDeadlineLabel}</strong>
              <em dir="ltr">{deadline}</em>
            </span>
          </span>
        </div>
      </header>
      <nav className="client-tabs" aria-label={w.consultDetailTitle}>
        <a href="#consult-overview" aria-current="page">{w.consultOverview}</a>
        <a href="#consult-docs">{w.consultDocs}{documents.length ? ` (${documents.length})` : ""}</a>
        <a href={messagesHref}>{w.consultExchanges}</a>
        <a href={quoteHref}>{w.consultMyQuote}</a>
      </nav>
      <section className="provider-workbench-layout" id="consult-overview">
        <div className="provider-workbench-main">
          <div className="provider-consult-cards">
            {invitation?.adminConsultation?<article className="client-card"><h3>{invitation.adminConsultation.subject}</h3><p className="whitespace-pre-wrap">{invitation.adminConsultation.context}</p><p>{locale==="ar"?"تاريخ الرد المطلوب":"Réponse attendue le"} : <time dateTime={invitation.adminConsultation.responseDeadline}>{invitation.adminConsultation.responseDeadline}</time></p></article>:null}
            <article className="client-card">
              <CardHead icon={<Target className="size-4" />}>{w.consultObjectiveTitle}</CardHead>
              <p>{objective}</p>
            </article>
            <article className="client-card">
              <CardHead icon={<Box className="size-4" />}>{w.consultScopeTitle}</CardHead>
              {scopeItems.length === 0 ? <p>{w.consultListEmpty}</p> : (
                <ul className="client-feed">
                  {scopeItems.map((item) => <li key={item}><span>{item}</span></li>)}
                </ul>
              )}
              <p className="client-access-note">{w.consultScopeLimit}</p>
            </article>
            <article className="client-card">
              <CardHead icon={<ClipboardCheck className="size-4" />}>{w.consultDeliverablesTitle}</CardHead>
              {deliverables.length === 0 ? <p>{w.consultListEmpty}</p> : (
                <ul className="client-feed">
                  {deliverables.map((item) => <li key={item}><span>{item}</span></li>)}
                </ul>
              )}
            </article>
            <article className="client-card">
              <CardHead icon={<TriangleAlert className="size-4" />}>{w.consultConstraintsTitle}</CardHead>
              {constraints.length === 0 ? <p>{w.consultListEmpty}</p> : (
                <ul className="client-feed">
                  {constraints.map((item) => <li key={item}><span>{item}</span></li>)}
                </ul>
              )}
            </article>
            <article className="client-card" id="consult-docs">
              <CardHead icon={<FolderOpen className="size-4" />}>{w.consultDocsTitle}{documents.length ? ` (${documents.length})` : ""}</CardHead>
              {documents.length === 0 ? <p>{w.consultDocsEmpty}</p> : (
                <ul className="client-feed provider-doc-list">
                  {documents.map((doc) => {
                    const href = doc.id && invitation ? consultationDocumentHref(invitation.id, doc.id) : null;
                    return (
                      <li key={doc.id ?? doc.title}>
                        <FileText className="size-4" aria-hidden />
                        <span><strong>{doc.title}</strong><small>{[doc.type, doc.size].filter(Boolean).join(" · ")}</small></span>
                        {href ? <a href={href} className="client-feed-download" download aria-label={`${w.download} — ${doc.title}`}>{w.download}</a> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
            <article className="client-card provider-fit">
              <CardHead icon={<Settings2 className="size-4" />}>{w.consultFitTitle}</CardHead>
              <p>{w.consultFitLead}</p>
              <p className="client-access-note" role="status">
                {locale === "ar"
                  ? "لا تُعرض هنا نتيجة أهلية تلقائية. راجعوا نطاق الدعوة والوثائق أعلاه."
                  : "Aucune compatibilité automatique n’est calculée ici. Relisez le périmètre et les documents de l’invitation."}
              </p>
              <ul className="client-feed">
                {invitation?.regionCode && invitation.regionCode !== "—" ? (
                  <li><span><strong>{w.consultFitZone}</strong><small>{invitation.regionCode}</small></span></li>
                ) : null}
                {documents.length > 0 ? (
                  <li><span><strong>{w.consultFitDocs}</strong><small dir="ltr">{documents.length}</small></span></li>
                ) : null}
              </ul>
            </article>
          </div>
        </div>
        <aside className="provider-workbench-rail client-stack">
          <article className="client-card provider-invite-banner">
            <p className="client-status"><strong>{w.consultInProgress}</strong> — {w.consultInviteOpen}</p>
            {quotePanel && (invitation?.status === "INVITED" || invitation?.status === "VIEWED") ? (
              <div className="provider-workbench-actions provider-workbench-actions-stack">
                <a href="#invitation-decision" className="client-cta"><Check className="size-4" aria-hidden />{w.consultAccept}</a>
                <a href="#invitation-decision" className="client-ghost-link">{w.consultDecline}</a>
              </div>
            ) : null}
            <Link href={quoteHref} className="client-cta provider-cta-soft">{w.consultStartQuote}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>
            <p className="client-access-note">{w.consultNoCompetitor}</p>
          </article>
          <article className="client-card">
            <header><h3>{w.consultCalendar}</h3></header>
            <ol className="client-journey provider-timeline">
              <li data-state={quoteSent ? "done" : invitation ? "current" : "todo"}>
                <span><Calendar className="size-4" aria-hidden /></span>
                <small>{w.consultQuoteDue}<em dir="ltr">{deadline}</em></small>
              </li>
              <li data-state={quoteDecided ? "done" : quoteSent ? "current" : "todo"}><span /><small>{w.consultAnalysis}</small></li>
              <li data-state={quoteDecided ? "done" : "todo"}><span /><small>{w.consultDecision}</small></li>
            </ol>
          </article>
          <article className="client-card">
            <header><h3>{w.consultAskTitle}</h3></header>
            <p>{w.consultAskLead}</p>
            <Link href={messagesHref} className="client-cta"><Send className="size-4" aria-hidden />{w.consultSend}</Link>
          </article>
        </aside>
      </section>
      {quotePanel ? <div id="invitation-decision">{quotePanel}</div> : null}
    </main>
  );
}

export function QuoteMultilineWorkbench({
  locale,
  query,
  invitation,
  quotePanel,
  prefill,
}: {
  locale: Locale;
  query: string;
  quoteId: string;
  invitation?: ProviderQuoteDashboard["invitations"][number] | null;
  quotePanel?: ReactNode;
  prefill?: QuotePrefill;
  history?: ProviderQuoteRevision[] | null;
}) {
  const w = workbenchCopy(locale);
  const currency = invitation?.currency ?? invitation?.quote?.currency ?? null;
  const subtotal = invitation?.quote?.subtotalMinor && currency ? formatMinor(invitation.quote.subtotalMinor, currency, locale) : "—";
  const tax = invitation?.quote?.taxMinor && currency ? formatMinor(invitation.quote.taxMinor, currency, locale) : "—";
  const total = invitation?.quote?.totalMinor && currency ? formatMinor(invitation.quote.totalMinor, currency, locale) : "—";
  const createdOn = invitation?.quote?.createdAt ? formatMedium(locale, invitation.quote.createdAt) : "—";
  const validity = invitation?.quote?.validUntil ? formatMedium(locale, invitation.quote.validUntil) : "—";
  return (
    <main className="client-page provider-workbench provider-quote-multiline">
      <p className="provider-breadcrumb">
        <Crumb href={`/${locale}/sous-traitant/devis${query}`}>{w.breadcrumbQuotes}</Crumb>
        <span aria-hidden>›</span>
        <span>{w.breadcrumbQuoteCreate}</span>
      </p>
      <header className="provider-workbench-hero">
        <div>
          <h2>{w.quoteCreateTitle}</h2>
          <p>{w.quoteCreateLead}</p>
        </div>
        <div className="provider-workbench-meta">
          <span className="provider-autosave"><FileText className="size-4" aria-hidden />{invitation?.quote?.currentVersionId ? (locale==="ar"?`نسخة الخادم v${invitation.quote.versionNumber??"—"} محفوظة`:`Version serveur v${invitation.quote.versionNumber??"—"} enregistrée`) : (locale === "ar" ? "لم تحفظ نسخة بعد" : "Aucune version enregistrée")}</span>
          <span className="client-status-chip" data-tone="mint">{invitation?.quote?.status ? quoteStatusLabel(invitation.quote.status, locale) : w.quoteDraftStatus}</span>
        </div>
      </header>
      <section className="provider-quote-meta client-card">
        <div><small>{w.quoteConsultation}</small><strong>{invitation?.description ?? w.quoteCreateTitle}</strong></div>
        <div><small>{w.quoteClient}</small><strong>{w.quoteClientMasked}</strong><p>{w.quoteClientHiddenLead}</p></div>
        <div><small>{w.quoteCreatedOn}</small><strong dir="ltr">{createdOn}</strong></div>
        <div><small>{w.quoteValidity}</small><strong>{validity}</strong></div>
      </section>
      <section className="provider-workbench-layout">
        <div className="provider-workbench-main">
          <article className="client-card">
            <header className="client-priority-head">
              <h3>{w.quoteLines}</h3>
              {invitation ? (
                <Link href={`/${locale}/sous-traitant/devis/${invitation.quote?.id ?? invitation.id}/revision${query}`} className="client-ghost-link">
                  <Plus className="size-4" aria-hidden />{w.quoteAddLine}
                </Link>
              ) : null}
            </header>
            {quotePanel ?? <p role="status">{w.consultListEmpty}</p>}
            {prefill ? (
              <section className="provider-quote-notes">
                {prefill.inclusions ? <article><h4>{w.quoteInclusions}</h4><p>{prefill.inclusions}</p></article> : null}
                {prefill.exclusions ? <article><h4>{w.quoteExclusions}</h4><p>{prefill.exclusions}</p></article> : null}
                {prefill.warranty ? <article><h4>{w.quoteWarranty}</h4><p>{prefill.warranty}</p></article> : null}
              </section>
            ) : null}
          </article>
        </div>
        <aside className="provider-workbench-rail client-stack">
          <article className="client-card">
            <header><h3>{w.quoteRecap}</h3></header>
            <dl className="provider-money">
              <div><dt>{w.quoteSubtotal}</dt><dd dir="ltr">{subtotal}</dd></div>
              <div><dt>{w.quoteTax}</dt><dd dir="ltr">{tax}</dd></div>
              <div className="provider-money-total"><dt>{w.quoteTotal}</dt><dd dir="ltr">{total}</dd></div>
            </dl>
            <p className="client-verified">{w.quoteServerCalc}</p>
            <p className="client-access-note">{w.quoteNoPeerAmounts}</p>
          </article>
          <article className="client-card">
            <header><h3>{w.quoteChecks}</h3></header>
            <ul className="client-feed">
              <li><span>{locale === "ar" ? "تظهر نتائج التحقق في نموذج العرض قبل الحفظ والإرسال." : "Les contrôles du formulaire déterminent les champs manquants avant enregistrement et envoi."}</span></li>
              <li><span>{locale === "ar" ? "حالة النسخة المحفوظة" : "État de la version enregistrée"} : {invitation?.quote?.status ? quoteStatusLabel(invitation.quote.status, locale) : "—"}</span></li>
            </ul>
            <div className="provider-workbench-actions">
              <Link href={`/${locale}/sous-traitant/devis${query}`} className="client-ghost-link">{w.breadcrumbQuotes}</Link>
              {invitation?.quote?.id ? <Link href={`/${locale}/sous-traitant/devis/${invitation.quote.id}/apercu${query}`} className="client-ghost-link">{w.quotePreview}</Link> : null}
              {invitation ? <Link href={`/${locale}/sous-traitant/devis/${invitation.quote?.id ?? invitation.id}/revision${query}`} className="client-cta">{w.quoteContinue}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link> : null}
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}

function revisionFieldLabel(field:string,locale:Locale){
 if(field.startsWith("line:"))return `${locale==="ar"?"السطر":"Ligne"} ${field.slice(5)}`;
 const labels:Record<string,[string,string]>={options:["Options","خيارات"],optionPriceBasis:["Base fiscale des options","القاعدة الضريبية للخيارات"],paymentTerms:["Modalités de paiement","شروط الدفع"],maintenanceTerms:["Maintenance","الصيانة"],attachments:["Pièces jointes","المرفقات"],currency:["Devise","العملة"],solution:["Solution","الحل"],deliverables:["Livrables","المخرجات"],inclusions:["Inclusions","المشمول"],exclusions:["Exclusions","الاستثناءات"],prerequisites:["Prérequis","المتطلبات"],warranty:["Garantie","الضمان"],correctionTerms:["Corrections","التصحيحات"],proposedStartDate:["Début prévu","البداية المتوقعة"],durationDays:["Durée (jours)","المدة بالأيام"],validUntil:["Validité (Casablanca)","الصلاحية بتوقيت الدار البيضاء"]};
 return labels[field]?.[locale==="ar"?1:0]??field;
}

export function QuoteRevisionWorkbench({
  locale,
  query,
  quoteId,
  invitation,
  quotePanel,
  history,
}: {
  locale: Locale;
  query: string;
  quoteId: string;
  invitation?: ProviderQuoteDashboard["invitations"][number] | null;
  quotePanel?: ReactNode;
  prefill?: QuotePrefill;
  history?: ProviderQuoteRevision[] | null;
}) {
  const w = workbenchCopy(locale);
  const currency = invitation?.currency ?? invitation?.quote?.currency ?? null;
  const total = invitation?.quote?.totalMinor && currency ? formatMinor(invitation.quote.totalMinor, currency, locale) : "—";

  return (
    <main className="client-page provider-workbench provider-quote-revision">
      <p className="provider-breadcrumb">
        <Crumb href={`/${locale}/sous-traitant/devis${query}`}>{w.quoteBackToList}</Crumb>
      </p>
      <header className="provider-workbench-hero">
        <div>
          <h2>{w.quoteReviseTitle}</h2>
          <p>{w.quoteReviseLead}</p>
        </div>
        <article className="provider-consult-summary client-card">
          <p><strong>{invitation?.description ?? w.quoteCreateTitle}</strong></p>
          <p dir="ltr">{invitation?.id ? `${locale === "ar" ? "مرجع" : "Réf."} ${invitation.id.slice(0, 8)}` : null}</p>
          <Link href={`/${locale}/sous-traitant/consultations/${invitation?.id ?? quoteId}${query}`} className="client-ghost-link">{w.quoteSeeConsult}<ArrowRight className="size-4 rtl:rotate-180" aria-hidden /></Link>
        </article>
      </header>
      <section className="provider-workbench-layout">
        <div className="provider-workbench-main">
          <article className="client-card">
            <header><h3>{w.quoteVersionHistory}</h3></header>
            {history === null ? <p role="alert">{locale === "ar" ? "تعذر تحميل سجل النسخ." : "Impossible de charger l’historique des versions."}</p> : !history?.length ? <p role="status">{locale === "ar" ? "لا توجد نسخة محفوظة." : "Aucune version enregistrée."}</p> : <ol className="client-journey provider-version-rail">
              {history.map((item,index) => {const previous=history[index+1];const differences=item.snapshot&&previous?.snapshot?compareQuoteRevisions(previous.snapshot,item.snapshot,locale):null;return <li key={item.id} data-state={item.id === invitation?.quote?.currentVersionId ? "current" : "done"}><span>v{item.version}</span><time dateTime={item.createdAt}>{formatMedium(locale, item.createdAt, true)}</time><small>{item.changeReason}</small><small>{locale==="ar"?"المؤلف":"Auteur"}: <code dir="ltr">{item.authorId}</code></small><details><summary>{locale==="ar"?"بصمة النسخة":"Empreinte de la version"}</summary><code dir="ltr">{item.contentHash}</code></details>{previous?<details><summary>{locale==="ar"?"مقارنة":"Comparer"} v{previous.version} → v{item.version}</summary>{differences===null?<p role="status">{locale==="ar"?"تعذر تحميل بيانات المقارنة.":"Données de comparaison indisponibles."}</p>:differences.length===0?<p>{locale==="ar"?"لا اختلاف في المحتوى التجاري.":"Aucun changement de contenu commercial."}</p>:<dl>{differences.map(change=><div key={change.field}><dt>{revisionFieldLabel(change.field,locale)}</dt><dd><del className="whitespace-pre-wrap">{change.before||"—"}</del> → <ins className="whitespace-pre-wrap">{change.after||"—"}</ins></dd></div>)}</dl>}</details>:null}</li>;})}
            </ol>}
            <p className="client-access-note">{w.quoteReviseNotice}</p>
            {quotePanel}
            <p className="client-verified">{w.quoteDoubleClick}</p>
          </article>
        </div>
        <aside className="provider-workbench-rail client-stack">
          <article className="client-card">
            <header><h3>{w.quoteChangeSummary}</h3></header>
            <p>{locale === "ar" ? "يُسجّل سبب كل تغيير مع النسخة غير القابلة للتعديل. راجع البيانات في النموذج قبل حفظ نسخة جديدة." : "Le motif de chaque changement accompagne sa version immuable. Vérifiez les données du formulaire avant d’enregistrer une nouvelle version."}</p>
          </article>
          <article className="client-card">
            <header><h3>{w.quoteSubmitChecklist}</h3></header>
            <p>{locale === "ar" ? "يُتحقق من المبالغ والضريبة والصلاحية عند الحفظ والإرسال." : "Les montants, la fiscalité et la validité sont contrôlés lors de l’enregistrement et de l’envoi."}</p>
            <p className="provider-money-total"><strong dir="ltr">{total}</strong></p>
            <p className="client-access-note">{w.quoteNoPeerAmounts}</p>
            {invitation?.quote?.status === "SUBMITTED" ? <p className="client-verified">{w.quoteSubmitSuccess}</p> : null}
          </article>
        </aside>
      </section>
    </main>
  );
}

export function MissionDeliveryWorkbench({
  locale,
  query,
  missionId,
  mission,
  missionsPanel,
}: {
  locale: Locale;
  query: string;
  missionId: string;
  mission?: ProviderMissionDashboard["missions"][number] | null;
  missionsPanel?: ReactNode;
}) {
  const w = workbenchCopy(locale);
  const title = mission
    ? (mission.deliverables[0]?.label || mission.milestones[0]?.title || mission.id.slice(0, 8))
    : w.missionDeliveryTitle;
  const steps = mission?.milestones.length
    ? mission.milestones.map((item) => ({
        id: item.id,
        title: item.title,
        due: item.dueAt ? formatMedium(locale, item.dueAt) : null,
        state: ["DONE", "COMPLETED"].includes(item.status) ? "done" as const : item.status === "IN_PROGRESS" || item.status === "CURRENT" ? "current" as const : "todo" as const,
      }))
    : [];
  const history = mission?.deliverables.flatMap((item) => item.versions.map((version) => ({
    id: version.id,
    title: item.label,
    detail: `${workflowStatusLabel(version.proofScanStatus,locale)} · v${version.version}`,
  }))) ?? [];
  const messagesHref = `/${locale}/sous-traitant/messages${query}`;
  const current = steps.find((step) => step.state === "current") ?? steps[0];
  return (
    <main className="client-page provider-workbench provider-mission-delivery">
      {mission ? <SignedScopePendingNotice pending={mission.signedScopePending} locale={locale} audience="provider" contractId={mission.contractId} query={query} /> : null}
      <p className="provider-breadcrumb">
        <Crumb href={`/${locale}/sous-traitant/missions${query}`}>{w.breadcrumbMissions}</Crumb>
        <span aria-hidden>›</span>
        <span dir="ltr">{missionId.slice(0, 12)}</span>
      </p>
      <header className="provider-workbench-hero">
        <div>
          <h2>{w.missionDeliveryTitle}</h2>
          <p>{w.missionDeliveryLead}</p>
        </div>
        <Link href={`/${locale}/sous-traitant/missions${query}`} className="client-ghost-link">{w.missionBack}</Link>
      </header>
      <article className="client-card provider-mission-overview">
        <div>
          <p className="client-space-label" dir="ltr">{missionId.slice(0, 12)}</p>
          <h3>{title}</h3>
          <div className="provider-chip-row">
            <span className="client-status-chip" data-tone="mint">{mission?.status ? workflowStatusLabel(mission.status,locale):w.missionInProgress}</span>
            {mission?.status && /SIGN|ACCEPT|ACTIVE|SIGNED/i.test(mission.status) ? (
              <span className="provider-meta-chip">{w.missionContractSigned}</span>
            ) : null}
          </div>
        </div>
        <div>
          <h4>{w.missionClientAccess}</h4>
          <ul className="client-feed provider-access-checks">
            <li><Link href={`/${locale}/sous-traitant/missions/${missionId}${query}`}><span>{w.missionAccessDeliverables}</span></Link></li>
            <li><Link href={messagesHref}><span>{w.missionAccessMessages}</span></Link></li>
            <li><Link href={`/${locale}/sous-traitant/documents${query}`}><span>{w.missionAccessDocs}</span></Link></li>
            <li><Link href={`/${locale}/sous-traitant/missions/${missionId}${query}`}><span>{w.missionAccessMilestones}</span></Link></li>
          </ul>
        </div>
      </article>
      <section className="client-card">
        <header><h3>{w.missionMilestones}</h3></header>
        {steps.length === 0 ? <p role="status">{w.missionNoMilestones}</p> : (
          <ol className="provider-milestone-rail">
            {steps.map((step, index) => (
              <li key={step.id} data-state={step.state}>
                <span>{index + 1}</span>
                <strong>{step.title}</strong>
                <small>{step.due ?? (step.state === "done" ? "—" : "—")}</small>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="provider-workbench-layout">
        <div className="provider-workbench-main">
          <article className="client-card">
            <header className="client-priority-head">
              <h3>{current ? current.title : w.missionDeliverable}</h3>
              {current?.state === "current" ? <span className="client-status-chip" data-tone="sky">{w.missionInProgress}</span> : null}
            </header>
            <p>{w.missionDeliverableHelp}</p>
            {missionsPanel ?? <p role="status">{w.missionNoFile}</p>}
            <div className="provider-workbench-actions">
              <Link href={messagesHref} className="client-ghost-link"><MessageSquare className="size-4" aria-hidden />{w.missionAskClarification}</Link>
            </div>
          </article>
        </div>
        <aside className="provider-workbench-rail client-stack">
          <article className="client-card">
            <header><h3>{w.missionHistory}</h3></header>
            {history.length === 0 ? <p role="status">{w.missionNoHistory}</p> : (
              <ul className="client-feed">
                {history.map((item) => (
                  <li key={item.id}><span className="client-feed-icon" data-tone="mint" /><span><strong>{item.title}</strong><small>{item.detail}</small></span></li>
                ))}
              </ul>
            )}
            <p className="client-access-note">{w.missionGoodToKnow}</p>
          </article>
        </aside>
      </section>
    </main>
  );
}

export function InvoiceSettlementWorkbench({
  locale,
  query,
  invoiceId,
  invoice,
  billingPanel,
  dossier,
}: {
  locale: Locale;
  query: string;
  invoiceId: string;
  invoice?: BillingDashboard["invoices"][number] | null;
  billingPanel?: ReactNode;
  dossier?:ProviderInvoiceDossier|null;
}) {
  const w = workbenchCopy(locale);
  const currency = invoice?.currency ?? null;
  const total = invoice && currency ? formatMinor(invoice.totalMinor, currency, locale) : "—";
  const paid = invoice && currency ? formatMinor(invoice.paidMinor, currency, locale) : "—";
  const outstanding = invoice && currency ? formatMinor(invoice.outstandingMinor, currency, locale) : "—";
  const settled = Boolean(invoice && invoice.outstandingMinor === "0");
  const declared = Boolean(invoice && invoice.paidMinor !== "0");
  return (
    <main className="client-page provider-workbench provider-invoice-settlement">
      <p className="provider-breadcrumb">
        <Crumb href={`/${locale}/sous-traitant/facturation${query}`}>{w.breadcrumbBilling}</Crumb>
        <span aria-hidden>›</span>
        <span>{w.breadcrumbInvoice}</span>
      </p>
      <header className="provider-workbench-hero">
        <div>
          <h2>{w.invoiceTitle}</h2>
          <p>{w.invoiceLead}</p>
        </div>
      </header>
      <section className="provider-invoice-top">
        <article className="client-card provider-invoice-summary">
          <header className="client-priority-head">
            <div>
              <p className="client-space-label" dir="ltr">{invoice?.number ?? invoiceId.slice(0, 12)}</p>
              <span className="client-status-chip" data-tone={settled ? "mint" : "peach"}>{settled ? w.invoiceSettled : (invoice?workflowStatusLabel(invoice.paymentStatus,locale):"—")}</span>
            </div>
          </header>
          <dl className="provider-money">
            <div><dt>{w.invoiceTtc}</dt><dd dir="ltr">{total}</dd></div>
            <div><dt>{w.invoiceStepDeclared}</dt><dd dir="ltr">{paid}</dd></div>
            <div><dt>{w.invoiceOutstanding}</dt><dd dir="ltr">{outstanding}</dd></div>
          </dl>
          {invoice ? null : <p role="status">{w.invoiceNoAmount}</p>}
        </article>
        <article className="client-card provider-blocker" data-scope="service">
          <TriangleAlert className="size-4" aria-hidden />
          <p>{w.invoicePaymentNotProof}</p>
          <div className="provider-workbench-actions">
            <Link href="#provider-payment-proof" className="client-cta">{w.invoiceAddProof}</Link>
            <Link href={`/${locale}/sous-traitant/messages${query}`} className="client-ghost-link">{w.invoiceReportGap}</Link>
          </div>
        </article>
      </section>
      {dossier && currency ? <InvoiceFacts dossier={dossier} locale={locale} currency={currency} query={query}/> : <p role="alert">{locale === "ar" ? "تعذر تحميل تفاصيل الملف. لا يمكن تأكيد الوثائق أو التسليمات." : "Le détail du dossier est indisponible. Les documents et livraisons ne peuvent pas être confirmés."}</p>}
      <section className="provider-invoice-bottom">
        <article className="client-card">
          <header><h3>{w.invoiceFollow}</h3></header>
          <ol className="client-journey provider-invoice-steps">
            <li data-state={invoice?.editionStatus==="READY" ? "done" : "todo"}><span><ClipboardCheck className="size-4" aria-hidden /></span><small>{invoice?.editionStatus==="READY"?(locale === "ar" ? "الفاتورة متاحة" : "Facture disponible"):(locale === "ar" ? "إصدار الفاتورة قيد الانتظار" : "Édition de la facture en attente")}</small></li>
            <li data-state={declared ? "done" : "todo"}><span><Check className="size-4" aria-hidden /></span><small>{locale === "ar" ? "تخصيص الدفع" : "Paiement affecté"}</small></li>
            <li data-state={settled ? "current" : "todo"}><span><Check className="size-4" aria-hidden /></span><small>{locale === "ar" ? "الرصيد صفر" : "Solde nul"}</small></li>
          </ol>
        </article>
        <article className="client-card">
          <header><h3>{w.invoiceProofs}</h3></header>
          <p className="client-access-note">{w.invoiceReconcileNote}</p>
        </article>
      </section>
      {billingPanel}
    </main>
  );
}

export function MessagesNotificationsWorkbench({
  locale,
  query,
}: {
  locale: Locale;
  query: string;
  threadId?: string;
}) {
  const w = workbenchCopy(locale);
  return (
    <main className="client-page provider-workbench provider-messages">
      <header className="provider-workbench-hero">
        <div>
          <h2>{w.messagesTitle}</h2>
          <p>{w.messagesLead}</p>
        </div>
      </header>
      <nav className="client-tabs" aria-label={w.messagesTitle}>
        <Link href={`/${locale}/sous-traitant/messages${query}`} aria-current="page">{w.messagesTab}</Link>
        <Link href={`/${locale}/notifications${query}`}>{w.notifTab}</Link>
      </nav>
      <section className="provider-messages-grid" id="messages">
        <article className="client-card">
          <p role="status">{w.notifEmpty}</p>
          <Link href={`/${locale}/sous-traitant/messages${query}`} className="client-cta">{w.messagesTab}</Link>
        </article>
        <aside className="client-stack" id="notifications">
          <article className="client-card">
            <header><h3>{w.notifTab}</h3></header>
            <p role="status">{w.notifEmpty}</p>
            <Link href={`/${locale}/notifications${query}`} className="client-text-link">{w.managePrefs}</Link>
          </article>
        </aside>
      </section>
    </main>
  );
}

export function CompanySecurityWorkbench({
  locale,
  query,
  organizationName,
  userEmail,
  mfaEnabled = null,
  sessions = [],
  members = [],
  sessionsUnavailable = false,
  membersUnavailable = false,
  securityUnavailable = false,
}: {
  locale: Locale;
  query: string;
  organizationName?: string | null;
  userEmail?: string | null;
  mfaEnabled?: boolean | null;
  sessions?: readonly { id: string; label: string; lastSeen: string; isCurrent: boolean }[];
  members?: readonly { id: string; name: string; role: string }[];
  sessionsUnavailable?: boolean;
  membersUnavailable?: boolean;
  securityUnavailable?: boolean;
}) {
  const w = workbenchCopy(locale);
  const name = organizationName ?? (locale === "ar" ? "مؤسستكم" : "Votre entreprise");
  const mfaLabel = mfaEnabled === true ? w.mfaOn : mfaEnabled === false ? w.mfaOff : "—";
  return (
    <main className="client-page provider-workbench provider-company-security">
      <div className="provider-settings-layout">
      <ProviderProfileRail locale={locale} query={query} active="company" />
      <div className="client-stack">
      <p className="provider-breadcrumb"><span>{w.companyTitle}</span><span aria-hidden>›</span><span>{w.tabSecurity}</span></p>
      <header className="provider-workbench-hero">
        <div>
          <h2>{w.companyTitle}</h2>
          <p>{w.companyLead}</p>
        </div>
        <p className="client-access-note">{locale === "ar" ? "تابعوا حالة حماية الحساب والفريق المصرح به أدناه." : "Consultez ci-dessous la protection du compte et l’équipe autorisée."}</p>
      </header>
      <nav className="client-tabs" aria-label={w.companyTitle}>
        <Link href={`/${locale}/sous-traitant/identite${query}`}>{w.tabProfile}</Link>
        <Link href={`/${locale}/organisation/roles${query}`}>{w.tabTeam}</Link>
        <Link href={`/${locale}/organisation/roles${query}`}>{w.tabRoles}</Link>
        <Link href={`/${locale}/organisation/roles${query}`}>{w.tabInvites}</Link>
        <Link href={`/${locale}/securite/compte${query}`} aria-current="page">{w.tabSecurity}</Link>
        <Link href={`/${locale}/securite/sessions${query}`}>{w.tabSessions}</Link>
        <Link href={`/${locale}/notifications${query}`}>{w.tabPrefs}</Link>
      </nav>
      <section className="provider-company-layout">
        <div className="client-stack">
          <article className="client-card" id="profil">
            <header className="client-priority-head">
              <h3>{w.companyIdentity}</h3>
              <Link href={`/${locale}/sous-traitant/entreprise/contrat${query}`} className="client-text-link">{locale === "ar" ? "عقد الشراكة" : "Contrat partenaire"}</Link>
            </header>
            <ul className="client-feed">
              <li><Building2 className="size-4" aria-hidden /><span><strong>{name}</strong></span></li>
              <li><span><strong>{w.companyLegalName}</strong><small>{name}</small></span></li>
              <li><span><strong>{w.companySector}</strong><small>—</small></span></li>
            </ul>
          </article>
          <article className="client-card">
            <header className="client-priority-head"><h3>{w.companyAccounting}</h3><Link href={`/${locale}/organisation${query}`} className="client-text-link">{w.companyEdit}</Link></header>
            <p dir="ltr">{userEmail ?? "—"}</p>
          </article>
          <article className="client-card" id="equipe">
            <header className="client-priority-head"><h3>{w.companyOrgScope}</h3><span className="client-status-chip" data-tone="mint">{w.companyPrimaryOrg}</span></header>
            {membersUnavailable ? <p role="alert">{locale === "ar" ? "تعذر تحميل الفريق. أعد تحميل الصفحة للمحاولة مجددا." : "Chargement de l’équipe indisponible. Rechargez la page pour réessayer."}</p> : members.length === 0 ? <p role="status">{locale === "ar" ? "لا يوجد عضو ظاهر في هذا النطاق." : "Aucun membre visible dans ce périmètre."}</p> : (
              <ul className="client-feed">
                {members.map((member) => (
                  <li key={member.id}><span><strong>{member.name}</strong><small>{member.role}</small></span></li>
                ))}
              </ul>
            )}
            <p className="client-access-note">{w.companyNoOtherOrg}</p>
          </article>
        </div>
        <div className="client-stack">
          <article className="client-card">
            <header><h3>{w.authSecurity}</h3></header>
            <p>{w.authSecurityLead}</p>
            {securityUnavailable ? <p role="alert">{locale === "ar" ? "حالة حماية الحساب غير متاحة حاليا." : "État de protection du compte indisponible."}</p> : null}
            <ul className="client-feed">
              <li><Lock className="size-4" aria-hidden /><span><strong>{w.mfaTitle}</strong><small>{w.mfaLead}</small></span><em className="client-status-chip" data-tone={mfaEnabled ? "mint" : "peach"}>{mfaLabel}</em></li>
              <li><span><strong>{w.verifyMethods}</strong><small>{w.verifyApp}</small></span><Link href={`/${locale}/securite/compte${query}`} className="client-text-link">{w.modify}</Link></li>
            </ul>
          </article>
          <article className="client-card" id="sessions">
            <header className="client-priority-head"><h3>{w.activeSessions}</h3><Link href={`/${locale}/securite/sessions${query}`} className="client-text-link">{w.seeHistory}</Link></header>
            {sessionsUnavailable ? <p role="alert">{locale === "ar" ? "تعذر تحميل الجلسات. راجعوا سجل الجلسات أو أعيدوا المحاولة." : "Chargement des sessions indisponible. Consultez leur historique ou réessayez."}</p> : sessions.length === 0 ? <p role="status">{w.sessionsEmpty}</p> : (
              <div className="client-table-wrap">
                <table className="client-space-table">
                  <thead><tr><th>{w.sessionDevice}</th><th>{w.sessionLast}</th><th>{w.sessionStatus}</th></tr></thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td>{session.label}</td>
                        <td>{session.lastSeen}</td>
                        <td><span className="client-status-chip" data-tone={session.isCurrent ? "mint" : "sky"}>{session.isCurrent ? w.sessionCurrent : w.sessionActive}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          <article className="client-card">
            <header className="client-priority-head"><h3>{w.securityHistory}</h3><Link href={`/${locale}/securite/compte${query}`} className="client-text-link">{w.seeHistory}</Link></header>
            <p>{locale === "ar" ? "راجعوا أحداث الحماية في صفحة أمان الحساب." : "Consultez les événements de sécurité dans la page de protection du compte."}</p>
          </article>
        </div>
      </section>
      </div>
      </div>
    </main>
  );
}

export function ProviderOutOfScope({ locale, query }: { locale: Locale; query: string }) {
  return (
    <main className="client-page">
      <ScopeNote locale={locale} query={query} />
    </main>
  );
}

export function ProviderLiveQuotePanel(props: {
  dashboard: ProviderQuoteDashboard;
  locale: Locale;
  m: ProviderQuoteMessages;
  identities: Record<string, { decision: string; revision: string; submit: string; correlation: string }>;
  prefills?: Record<string, QuotePrefill>;
}) {
  return <section className="provider-live-ops"><QuotePanel {...props} /></section>;
}

export function ProviderLiveMissionsPanel(props: {
  dashboard: ProviderMissionDashboard;
  locale: Locale;
  messages: ProviderMissionMessages;
}) {
  return <section className="provider-live-ops"><MissionsPanel {...props} /></section>;
}

export function ProviderLiveBillingPanel(props: {
  dashboard: BillingDashboard;
  missions: MissionOption[];
  locale: Locale;
  m: BillingMessages;
  keys: string[];
}) {
  return <section className="provider-live-ops"><BillingPanel {...props} /></section>;
}
