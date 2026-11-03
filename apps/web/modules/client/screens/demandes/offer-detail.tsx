import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  MessageSquare,
  Paperclip,
  Scale,
  Shield,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatMinorExact } from "@/modules/client/data/rfq/model";
import { offerDetailMessages, unitLabel } from "@/modules/client/data/rfq/quote-detail-copy";
import type { ClientOfferDetail, ClientOfferDocument, ClientOfferPoint } from "@/modules/client/data/rfq/quote-detail-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function offerPointTitle(id: ClientOfferPoint["id"], locale: Locale) {
  const titles = {
    fr: { scope: "Périmètre", timeline: "Délais", exclusions: "Exclusions", terms: "Conditions" },
    ar: { scope: "النطاق", timeline: "الآجال", exclusions: "الاستثناءات", terms: "الشروط" },
  } as const;
  return titles[locale][id];
}

function PointIcon({ id }: { id: ClientOfferPoint["id"] }) {
  if (id === "timeline") return <CalendarDays className="size-4" aria-hidden />;
  if (id === "exclusions") return <AlertTriangle className="size-4" aria-hidden />;
  if (id === "terms") return <Shield className="size-4" aria-hidden />;
  return <FileText className="size-4" aria-hidden />;
}

function pointTone(id: ClientOfferPoint["id"], action: ClientOfferPoint["action"]) {
  if (id === "timeline") return "peach";
  if (id === "exclusions") return "sky";
  if (id === "terms") return "mint";
  return action === "review" ? "violet" : "peach";
}

function DocIcon({ kind }: { kind: ClientOfferDocument["kind"] }) {
  if (kind === "xlsx") return <FileSpreadsheet className="size-4" aria-hidden />;
  if (kind === "docx") return <FileText className="size-4" aria-hidden />;
  if (kind === "pdf") return <FileText className="size-4" aria-hidden />;
  return <Paperclip className="size-4" aria-hidden />;
}

function CheckList({
  title,
  items,
  empty,
  tone,
  icon,
}: {
  title: string;
  items: readonly string[];
  empty: string;
  tone: "mint" | "violet" | "sky" | "teal";
  icon: ReactNode;
}) {
  return (
    <div className="client-offer-block" data-tone={tone}>
      <h3>
        <span className="client-feed-icon" data-tone={tone === "teal" ? "mint" : tone}>{icon}</span>
        {title}
      </h3>
      <ul>
        {(items.length > 0 ? items : [empty]).map((item) => (
          <li key={item}>
            <CheckCircle2 className="size-4" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ClientOfferDetailView({
  locale,
  selectedQuery,
  detail,
}: {
  locale: Locale;
  selectedQuery: string;
  detail: ClientOfferDetail;
}): ReactNode {
  const copy = offerDetailMessages(locale);
  const BackIcon = locale === "ar" ? ArrowRight : ArrowLeft;
  return (
    <main className="client-page">
      {detail.revisionInProgress?<article className="client-card" role="status"><h2>{locale==="ar"?"يجري إعداد مراجعة للعرض":"Révision du devis en cours"}</h2><p>{locale==="ar"?"هذه نسخة منشورة سابقة محفوظة للاطلاع. المسودة الجديدة خاصة بمقدم الخدمة؛ لا يمكن اختيار العرض حتى إعادة نشر النسخة الجديدة وتحديث المقارنة.":"Vous consultez une version publiée conservée dans l’historique. Le nouveau brouillon reste privé au prestataire ; la sélection attend sa republication et une comparaison actualisée."}</p></article>:null}
      {detail.publishedVersions?.length?<nav className="client-card" aria-label={locale==="ar"?"النسخ المنشورة للعرض":"Versions publiées du devis"}><p>{locale==="ar"?"نسخة العرض المعروضة":"Version du devis affichée"} : {detail.displayedVersionNumber}</p><ul>{detail.publishedVersions.map(version=><li key={version.id}><Link aria-current={version.id===detail.quoteVersionId?"page":undefined} className="client-text-link" href={`/${locale}/client/demandes/${detail.requestId}/offres/${detail.quoteId}?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(selectedQuery.replace(/^\?/,""))),versionId:version.id})}`}>{locale==="ar"?"النسخة":"Version"} {version.version} — {new Intl.DateTimeFormat(locale==="ar"?"ar-MA":"fr-MA",{dateStyle:"medium",timeZone:"Africa/Casablanca"}).format(new Date(version.submittedAt))}</Link></li>)}</ul></nav>:null}

      <nav className="client-crumb" aria-label={copy.crumbDetail}>
        <Link href={`/${locale}/client/demandes${selectedQuery}`}>{copy.crumbRequests}</Link>
        <span aria-hidden>/</span>
        <Link href={detail.comparisonHref}>{copy.crumbCompare}</Link>
        <span aria-hidden>/</span>
        <span>{copy.crumbDetail}</span>
      </nav>

      <header className="client-mast client-offer-mast">
        <div>
          <h1>
            {copy.title}
            {detail.label ? <em>{detail.label}</em> : null}
          </h1>
          <p>{copy.lead}</p>
        </div>
        <div className="client-offer-actions">
          <Link href={detail.comparisonHref} className="client-ghost-link">
            <BackIcon className="size-4" aria-hidden />
            {copy.backCompare}
          </Link>
          <Link href={detail.askHref} className="client-cta">
            <MessageSquare className="size-4" aria-hidden />
            {copy.askQuestion}
          </Link>
        </div>
      </header>

      <section className="client-offer-layout">
        <div className="client-offer-main">
          <article className="client-card" aria-labelledby="cover-title">
            <header>
              <h2 id="cover-title">
                <FileText className="size-4" aria-hidden />
                {copy.coverTitle}
              </h2>
            </header>
            <div className="client-offer-cover">
              <CheckList title={copy.scope} items={detail.inclusions} empty={copy.emptyList} tone="mint" icon={<CheckCircle2 className="size-4" aria-hidden />} />
              <CheckList title={copy.deliverables} items={detail.deliverables} empty={copy.emptyList} tone="violet" icon={<FileText className="size-4" aria-hidden />} />
              <CheckList title={copy.delays} items={detail.delays} empty={copy.emptyList} tone="sky" icon={<CalendarDays className="size-4" aria-hidden />} />
              <CheckList title={copy.conditions} items={detail.conditions} empty={copy.emptyList} tone="teal" icon={<Shield className="size-4" aria-hidden />} />
            </div>
          </article>

          <article className="client-card client-compare" aria-labelledby="quote-title">
            <header>
              <h2 id="quote-title">
                <FileSpreadsheet className="size-4" aria-hidden />
                {copy.quoteTitle}
              </h2>
            </header>
            {detail.lines.length === 0 ? (
              <p>{copy.emptyList}</p>
            ) : (
              <div className="client-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{copy.label}</th>
                      <th>{copy.quantity}</th>
                      <th>{copy.unit}</th>
                      <th>{copy.tax}</th>
                      <th>{copy.total}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.label}</td>
                        <td dir="ltr">{line.quantity}</td>
                        <td>{unitLabel(line.unitCode, locale)}</td>
                        <td dir="ltr">{line.taxLabel}</td>
                        <td dir="ltr">{formatMinorExact(line.totalMinor, detail.currency, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="client-card" aria-labelledby="flags-title">
            <header>
              <h2 id="flags-title">
                <AlertTriangle className="size-4" aria-hidden />
                {copy.flagsTitle}
              </h2>
            </header>
            {detail.flags.length === 0 ? (
              <p>{copy.noFlags}</p>
            ) : (
              <ul className="client-offer-flags">
                {detail.flags.map((flag) => (
                  <li key={flag.id}>
                    <span className="client-feed-icon" data-tone={flag.tone === "clarify" ? "peach" : "sky"}>
                      {flag.tone === "clarify" ? <AlertTriangle className="size-4" aria-hidden /> : <Info className="size-4" aria-hidden />}
                    </span>
                    <span>{flag.text}</span>
                    <em className="client-status-chip" data-tone={flag.tone === "clarify" ? "peach" : "sky"}>
                      {flag.tone === "clarify" ? copy.clarify : copy.confirm}
                    </em>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <aside className="client-offer-aside">
          <article className="client-card" aria-labelledby="summary-title">
            <header>
              <h2 id="summary-title">
                <Scale className="size-4" aria-hidden />
                {copy.summaryTitle}
              </h2>
            </header>
            <p>{copy.summaryLead}</p>
            <ul className="client-offer-points">
              {detail.points.map((point) => (
                <li key={point.id}>
                  <span className="client-feed-icon" data-tone={pointTone(point.id, point.action)}>
                    <PointIcon id={point.id} />
                  </span>
                  <span>
                    <strong>{offerPointTitle(point.id, locale)}</strong>
                    <small>{point.hint}</small>
                  </span>
                  <em className="client-status-chip" data-tone={point.action === "review" ? "violet" : point.id === "terms" ? "mint" : "peach"}>
                    {point.action === "review" ? copy.review : copy.compare}
                  </em>
                </li>
              ))}
            </ul>
          </article>

          {detail.options?.length?<article className="client-card"><h2>{locale==="ar"?"خيارات غير مشمولة في الإجمالي الأساسي":"Options hors total de base"}</h2><ul>{detail.options.map(option=><li key={option.id}><span dir="auto">{option.label}</span> — <span dir="ltr">{formatMinorExact(option.amountMinor,detail.currency,locale)}</span> {detail.optionPriceBasis==="EXCLUDING_TAX"?(locale==="ar"?"دون الضريبة":"HT"):(locale==="ar"?"— يجب توضيح المعالجة الضريبية لهذه النسخة السابقة":"— base fiscale de cette option historique à clarifier")}</li>)}</ul><p>{locale==="ar"?"يتطلب إدراج خيار نسخة عرض جديدة ببنود محسوبة الضريبة قبل الاختيار.":"L’intégration d’une option au périmètre nécessite une nouvelle version du devis avec des lignes fiscalisées avant sélection."}</p></article>:null}
          <article className="client-card" aria-labelledby="docs-title">
            <header>
              <h2 id="docs-title">
                <Paperclip className="size-4" aria-hidden />
                {copy.documentsTitle}
              </h2>
            </header>
            <p>{copy.documentsLead}</p>
            {detail.documents.length === 0 ? (
              <p>{copy.noDocuments}</p>
            ) : (
              <ul className="client-feed">
                {detail.documents.map((document) => (
                  <li key={document.id}>
                    <Link href={document.href}>
                      <span className="client-feed-icon" data-tone={document.kind === "pdf" ? "rose" : document.kind === "xlsx" ? "mint" : "sky"}>
                        <DocIcon kind={document.kind} />
                      </span>
                      <span>
                        <strong>{document.fileName}</strong>
                        <small>{document.kind.toUpperCase()}</small>
                      </span>
                      <em>{copy.openDocument}</em>
                      <Download className="size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="client-card client-offer-hint" aria-labelledby="hint-title">
            <h2 id="hint-title" className="client-offer-hint-title">
              <Info className="size-4" aria-hidden />
              {copy.compareHint}
            </h2>
            <p>{copy.compareHintBody}</p>
            <Link href={detail.comparisonHref} className="client-text-link">
              {copy.backCompare}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </article>
        </aside>
      </section>

      <footer className="client-offer-foot">
        <p>{copy.footnote}</p>
        <p>{copy.morocco}</p>
      </footer>
    </main>
  );
}
