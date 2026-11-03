"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, ArrowRight, FileText, Info, Scale } from "lucide-react";
import { formatMinorExact, type QuoteComparison, type QuoteComparisonRow } from "@/modules/client/data/rfq/model";
import { canApplyDemoOffer } from "@/modules/client/data/rfq/quote-detail-demo";
import { formatCompletenessBasisPoints, type QuoteCompleteness } from "@/modules/client/data/rfq/quote-completeness";
import type { ComparisonOfferFacts } from "@/modules/client/data/rfq/comparison-facts";
import { demoClientSpaces } from "@/modules/client/data/spaces/demo";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ClientRfqMessages } from "./messages";
import { AssistanceCue } from "@/modules/client/screens/diagnostics/assistance-cue";
import { compareQuotesAction, selectQuoteAction, type ActionState, type ComparisonState } from "./actions";

const compareIdle: ComparisonState = { status: "idle" };
const actionIdle: ActionState = { status: "idle" };

const WEIGHTS = [
  { id: "price", key: "weighPrice", value: 30 },
  { id: "delay", key: "weighDelay", value: 20 },
  { id: "scope", key: "weighScope", value: 20 },
  { id: "warranty", key: "weighWarranty", value: 10 },
  { id: "maintenance", key: "weighMaintenance", value: 10 },
  { id: "payment", key: "weighPayment", value: 10 },
] as const;


function letterFor(index: number, locale: Locale) {
  const letters = locale === "ar" ? ["أ", "ب", "ج", "د", "هـ"] : ["A", "B", "C", "D", "E"];
  return letters[index] ?? String(index + 1);
}

function formatDuration(days: number, locale: Locale) {
  if (days > 0 && days % 7 === 0) {
    const weeks = days / 7;
    return locale === "ar" ? `${weeks} أسابيع` : `${weeks} semaine${weeks > 1 ? "s" : ""}`;
  }
  return locale === "ar" ? `${days} أيام` : `${days} jours`;
}

type CompareColumn = {
  key: string;
  quoteId: string;
  quoteVersionId: string;
  letter: string;
  tagline: string;
  recommended: boolean;
  price: string;
  taxBase: string;
  duration: string;
  deliverables: string[];
  exclusions: string[];
  guarantees: string;
  maintenance: string;
  corrections: string;
  recurring: string[];
  recurringSubtotal: string;
  payment: string;
  why: string;
  expired: boolean;
  selectable: boolean;
  completeness: QuoteCompleteness | null;
  revisionInProgress?:boolean;
};

export function ComparisonPanel({
  locale,
  requestId,
  rfqId,
  messages,
  canManage,
  initialComparison,
  nowIso,
  compareKey,
  selectKeys,
  selectedQuery,
  requestTitle,
  requestHref,
  organizationName,
  offerFacts = {},
  assistanceHref,
  revisingQuoteIds=[],
}: {
  locale: Locale;
  requestId: string;
  rfqId: string;
  messages: ClientRfqMessages;
  canManage: boolean;
  initialComparison: QuoteComparison | null;
  nowIso: string;
  compareKey: string;
  selectKeys: string[];
  selectedQuery: string;
  requestTitle: string;
  requestHref: string;
  organizationName?: string | null;
  offerFacts?: Record<string, ComparisonOfferFacts>;
  assistanceHref?: string;
  revisingQuoteIds?:string[];
}) {
  const [state, action, pending] = useActionState(compareQuotesAction, compareIdle);
  const c = spaceCopy(locale);
  const demo = demoClientSpaces(locale, selectedQuery);
  const rows = state.status === "success" ? state.rows : initialComparison?.rows ?? [];
  const preferDemo = canApplyDemoOffer(organizationName ?? null) && rows.length === 0;
  const columns: CompareColumn[] = (preferDemo
    ? demo.compareOffers.map((offer, index) => {
        const quoteId = offer.slot === "c" ? `demo:${requestId}:c` : `${requestId}-${offer.slot}`;
        return {
          key: quoteId,
          quoteId,
          quoteVersionId: `${quoteId}-version`,
          letter: letterFor(index, locale),
          tagline: offer.tagline,
          recommended: offer.recommended,
          price: formatMinorExact(offer.priceMinor, "MAD", locale),
          taxBase: offer.taxIncl ? c.taxIncl : c.taxExcl,
          duration: locale === "ar" ? `${offer.weeks} أسابيع` : `${offer.weeks} semaine${offer.weeks > 1 ? "s" : ""}`,
          deliverables: offer.deliverables,
          exclusions: offer.exclusions,
          guarantees: offer.guarantees,
          maintenance: offer.maintenance,
          corrections:"",recurring:[],recurringSubtotal:formatMinorExact("0","MAD",locale),
          payment: offer.payment,
          why: offer.why,
          expired: false,
          selectable: false,
          completeness: null,
        };
      })
    : rows.map((row, index) => mapRow(row, index, locale, c, messages, nowIso, offerFacts[row.quoteVersionId]))).map(column=>({...column,revisionInProgress:revisingQuoteIds.includes(column.quoteId),selectable:column.selectable&&!revisingQuoteIds.includes(column.quoteId)}));
  const snapshotId = state.status === "success" ? state.snapshotId : initialComparison?.snapshotId ?? "";
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  const askHref = `/${locale}/messagerie${selectedQuery}`;
  const dash = locale === "ar" ? "—" : "—";

  return (
    <div className="client-compare-page">
      <Link href={requestHref} className="client-text-link">
        <BackIcon className="size-4" aria-hidden />
        {c.backQuotes}
      </Link>
      <article className="client-card client-compare-request">
        <div className="client-compare-request-body">
          <span className="client-feed-icon" data-tone="violet"><FileText className="size-4" aria-hidden /></span>
          <div>
            <p>{c.need} : <strong>{requestTitle}</strong></p>
            <small>{c.sameScope} · {columns.length} {locale === "ar" ? "عروض في المقارنة" : "offres dans la comparaison"}{revisingQuoteIds.length?` · ${revisingQuoteIds.length} ${locale==="ar"?"مراجعات قيد الإعداد":"révisions en préparation"}`:""}</small>
          </div>
        </div>
        <Link href={requestHref} className="client-soft-link">{c.seeRequest}</Link>
      </article>
      {assistanceHref ? <AssistanceCue locale={locale} href={assistanceHref} context="quotes" /> : null}
      {canManage ? (
        <form action={action} className="client-compare-refresh">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="rfqId" value={rfqId} />
          <input type="hidden" name="idempotencyKey" value={compareKey} />
          <button type="submit" disabled={pending} className="client-ghost-link">
            {pending ? messages.comparing : initialComparison ? messages.refreshComparison : messages.compare}
          </button>
        </form>
      ) : (
        <p role="status" className="client-access-note">{messages.readOnly}</p>
      )}
      {state.status === "error" ? <p role="alert" className="client-access-note">{messages.actionError}</p> : null}
      {preferDemo ? <p role="status" className="client-access-note">{messages.demoSelectionDisabled}</p> : <p className="client-access-note">{messages.contactsHidden}</p>}
      {initialComparison && state.status !== "success" ? (
        <p className="client-access-note">
          {messages.snapshot}: <time dateTime={initialComparison.createdAt}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(initialComparison.createdAt))}</time>
        </p>
      ) : null}
      {columns.length === 0 ? (
        <p className="client-card">{messages.noComparison}</p>
      ) : (
        <section className="client-compare-layout">
          <div className="client-compare-grid" aria-live="polite">
            {columns.map((column, index) => (
              <QuoteColumn
                key={column.key}
                column={column}
                locale={locale}
                requestId={requestId}
                selectedQuery={selectedQuery}
                messages={messages}
                canManage={canManage}
                selectKey={selectKeys[index] ?? selectKeys[0]}
                snapshotId={snapshotId}
                askHref={askHref}
                dash={dash}
              />
            ))}
          </div>
          <aside className="client-card client-weight-aside">
            <header>
              <h2><Scale className="size-4" aria-hidden />{locale==="ar"?"معايير المقارنة":"Critères de comparaison"}</h2>
            </header>
            <p>{locale==="ar"?"قارنوا السعر والأجل والنطاق والشروط قبل الاختيار. الترتيب المعروض يعتمد على السعر فقط.":"Comparez le prix, le délai, le périmètre et les conditions avant de choisir. Le classement affiché porte uniquement sur le prix."}</p>
            <ul className="client-weight-list">{WEIGHTS.map(item=><li key={item.id}>{c[item.key]}</li>)}</ul>
            <p className="client-weight-note"><Info className="size-4" aria-hidden />{locale==="ar"?"لا يشكل أقل سعر توصية بالجودة. اطلبوا توضيح أي شرط غير محدد.":"Le prix le plus bas ne constitue pas une recommandation de qualité. Demandez une clarification pour toute condition non renseignée."}</p>
          </aside>
        </section>
      )}
    </div>
  );
}

function mapRow(
  row: QuoteComparisonRow,
  index: number,
  locale: Locale,
  c: ReturnType<typeof spaceCopy>,
  messages: ClientRfqMessages,
  nowIso: string,
  facts?: ComparisonOfferFacts,
): CompareColumn {
  const expired = Date.parse(row.validUntil) <= Date.parse(nowIso);
  const taxZero = row.taxMinor === "0";
  const complete = Boolean(facts && facts.completeness.basisPoints === 10_000);
  return {
    key: row.quoteVersionId,
    quoteId: row.quoteId,
    quoteVersionId: row.quoteVersionId,
    letter: letterFor(index, locale),
    tagline: locale==="ar"?`ترتيب السعر ${row.priceRank}`:`Rang de prix ${row.priceRank}`,
    recommended: false,
    price: formatMinorExact(row.totalMinor, row.currency, locale),
    taxBase: taxZero ? c.taxIncl : c.taxExcl,
    duration: formatDuration(row.durationDays, locale),
    deliverables: facts?.deliverables.length ? facts.deliverables : [`${row.deliverablesCount} ${messages.deliverables}`],
    exclusions: facts?.exclusions ?? [],
    guarantees: facts?.warranty ?? "",
    maintenance: facts?.maintenanceTerms??"",
    corrections: facts?.corrections ?? "",
    recurringSubtotal: formatMinorExact(row.recurringSubtotalMinor, row.currency, locale),
    recurring: facts?.recurringLines?.map(line=>`${line.label} : ${formatMinorExact(line.subtotalMinor,row.currency,locale)} / ${{MONTH:locale==="ar"?"شهر":"mois",QUARTER:locale==="ar"?"ربع سنة":"trimestre",YEAR:locale==="ar"?"سنة":"an"}[line.interval]}`) ?? [],
    payment: facts?.paymentTerms || (locale==="ar"?"غير محددة في العرض — اطلب توضيحاً قبل الاختيار.":"Non renseignées dans le devis — demander une clarification avant de choisir."),
    why: "",
    expired,
    selectable: complete,
    completeness: facts?.completeness ?? null,
  };
}

function QuoteColumn({
  column,
  locale,
  requestId,
  selectedQuery,
  messages,
  canManage,
  selectKey,
  snapshotId,
  askHref,
  dash,
}: {
  column: CompareColumn;
  locale: Locale;
  requestId: string;
  selectedQuery: string;
  messages: ClientRfqMessages;
  canManage: boolean;
  selectKey: string;
  snapshotId: string;
  askHref: string;
  dash: string;
}) {
  const [state, action, pending] = useActionState(selectQuoteAction, actionIdle);
  const c = spaceCopy(locale);
  const detailHref = `/${locale}/client/demandes/${requestId}/offres/${column.quoteId}?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(selectedQuery.replace(/^\?/,""))),versionId:column.quoteVersionId})}`;
  const canSelect = column.selectable && canManage && !column.expired && Boolean(snapshotId);
  return (
    <article className="client-card client-offer-col" data-recommended={column.recommended ? "true" : undefined}>
      {column.recommended ? <p className="client-offer-badge">{c.recommendedOffer}</p> : null}
      <header>
        <h2>{locale === "ar" ? `العرض ${column.letter}` : `Offre ${column.letter}`}</h2>
        <p>{column.tagline}</p>
      </header>
      <dl className="client-offer-facts">
        <div><dt>{c.providerLabel}</dt><dd>{locale === "ar" ? `العرض ${column.letter}` : `Offre ${column.letter}`}</dd></div>
        <div><dt>{c.priceMad}</dt><dd className="client-offer-price" dir="ltr">{column.price}</dd></div>
        <div><dt>{c.taxBase}</dt><dd>{column.taxBase}</dd></div>
        <div><dt>{c.durationLabel}</dt><dd>{column.duration}</dd></div>
        <div><dt>{locale==="ar"?"التكاليف المتكررة دون ضريبة":"Coûts récurrents hors taxes"}</dt><dd>{column.recurring.length ? <ul>{column.recurring.map((line,index)=><li key={index} dir="auto">{line}</li>)}</ul> : <><span dir="ltr">{column.recurringSubtotal}</span><span className="block text-sm">{locale==="ar"?"راجع دورية البنود في تفاصيل العرض؛ لا يتم افتراض مدة إجمالية.":"Voir la périodicité des lignes dans le détail ; aucune durée totale n’est supposée."}</span></>}</dd></div>
        {column.completeness ? (
          <div>
            <dt>{messages.completeness}</dt>
            <dd dir="ltr">{formatCompletenessBasisPoints(column.completeness.basisPoints, locale)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{c.deliverablesIncl}</dt>
          <dd>
            <ul>{column.deliverables.map((item) => <li key={item}>{item}</li>)}</ul>
          </dd>
        </div>
        <div>
          <dt>{c.exclusions}</dt>
          <dd>
            {column.exclusions.length > 0 ? <ul>{column.exclusions.map((item) => <li key={item}>{item}</li>)}</ul> : dash}
          </dd>
        </div>
        <div><dt>{c.guarantees}</dt><dd>{column.guarantees || dash}</dd></div>
        <div><dt>{c.maintenance}</dt><dd>{column.maintenance || (locale==="ar"?"غير محددة في العرض":"Non renseignée dans le devis")}</dd></div>
        <div><dt>{locale==="ar"?"شروط التصحيح":"Conditions de correction"}</dt><dd>{column.corrections || dash}</dd></div>
        <div><dt>{c.paymentTerms}</dt><dd>{column.payment || dash}</dd></div>
        {column.why ? <div><dt>{c.whyCompatible}</dt><dd>{column.why}</dd></div> : null}
      </dl>
      <div className="client-offer-actions">
        <Link href={detailHref} className="client-ghost-link">{c.seeDetail}</Link>
        <Link href={askHref} className="client-soft-link">{c.askQuestion}</Link>
        {canSelect ? (
          <form action={action} className="client-offer-select">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="quoteId" value={column.quoteId} />
            <input type="hidden" name="quoteVersionId" value={column.quoteVersionId} />
            <input type="hidden" name="comparisonSnapshotId" value={snapshotId} />
            <input type="hidden" name="idempotencyKey" value={selectKey} />
            <label>
              <span>{messages.selectionReason}</span>
              <textarea name="selectionReason" required minLength={3} maxLength={500} rows={3} />
            </label>
            <label>
              <input type="checkbox" name="confirmSelection" required />
              <span>{messages.confirmSelection}</span>
            </label>
            <button type="submit" disabled={pending} className="client-cta" data-recommended={column.recommended ? "true" : undefined}>
              {pending ? messages.selecting : c.chooseOffer}
            </button>
          </form>
        ) : null}
      </div>
      {column.revisionInProgress?<p role="status" className="client-access-note">{locale==="ar"?"المراجعة قيد الإعداد؛ هذه النسخة المنشورة محفوظة للاطلاع ولا يمكن اختيارها.":"Révision en préparation ; cette version publiée reste consultable et ne peut pas être sélectionnée."}</p>:null}
      {!column.completeness ? <p role="alert" className="client-access-note">{locale==="ar"?"تفاصيل المقارنة غير متاحة. أعد تحميل الصفحة قبل الاختيار.":"Les détails nécessaires à la comparaison sont indisponibles. Rechargez la page avant de choisir."}</p>:null}
      {column.completeness && column.completeness.basisPoints < 10_000 ? <p role="status" className="client-access-note">{messages.incompleteQuote}</p> : null}
      {column.expired ? <p role="status" className="client-access-note">{messages.expiredQuote}</p> : null}
      {state.status === "error" ? <p role="alert" className="client-access-note">{state.reason === "VALIDATION" ? messages.validation : messages.actionError}</p> : null}
      {state.status === "approval_required" ? <p role="status" className="client-access-note">{state.approvalStatus==="REJECTED"?(locale==="ar"?"تم رفض طلب الموافقة. راجع القرار قبل المحاولة.":"La demande d’approbation a été refusée. Consultez la décision avant de réessayer."):(locale==="ar"?"أُرسل الطلب إلى المعتمدين. لم يتم اختيار العرض بعد.":"Demande transmise aux approbateurs. Le devis n’est pas encore retenu.")} <Link href={`/${locale}/client/actions${selectedQuery}`}>{locale==="ar"?"عرض الإجراءات":"Consulter les actions"}</Link></p>:null}
      {state.status === "success" ? <p role="status" className="client-access-note">{messages.selected}</p> : null}
    </article>
  );
}
