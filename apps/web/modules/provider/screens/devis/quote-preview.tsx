import {workflowStatusLabel}from"@/modules/shared/lib/i18n/workflow-statuses";
import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { formatMinorExact } from "@/modules/client/data/rfq/model";
import type { ProviderQuoteDashboard } from "@/modules/provider/data/quotes/model";
import { workbenchCopy } from "@/modules/provider/data/spaces/workbench-copy";
import type { QuotePrefill } from "@/modules/provider/screens/devis/prefill";
import { getProviderQuoteMessages } from "@/modules/provider/screens/devis/messages";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ReactNode } from "react";

function lines(value: string): string[] {
  return value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);
}

function formatDay(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(value));
}

export function QuotePreviewWorkbench({
  locale,
  query,
  quoteId,
  invitation,
  prefill,
  organizationName,
  submitPanel,
}: {
  locale: Locale;
  query: string;
  quoteId: string;
  invitation: ProviderQuoteDashboard["invitations"][number] | null;
  prefill?: QuotePrefill;
  organizationName: string;
  submitPanel?: ReactNode;
}) {
  const w = workbenchCopy(locale);
  const m = getProviderQuoteMessages(locale);
  const quote = invitation?.quote ?? null;
  const currency = invitation?.currency ?? quote?.currency ?? null;
  const editHref = `/${locale}/sous-traitant/devis/${quote?.id ?? quoteId}${query}`;
  const lineCount = prefill?.lines.length ?? 0;
  const checklist = [
    { ok: Boolean(organizationName), label: w.quoteCheckOrg, detail: organizationName || "—" },
    { ok: true, label: w.quoteCheckClient, detail: w.quoteClientMasked },
    { ok: Boolean(quote?.id), label: w.quoteCheckRef, detail: quote ? `${quote.id.slice(0, 8)} (v${quote.versionNumber})` : "—" },
    { ok: lineCount > 0 && quote?.totalMinor != null, label: w.quoteCheckItems, detail: `${lineCount} ${w.quoteLinesCount}` },
    { ok: Boolean(prefill?.proposedStartDate || prefill?.durationDays), label: w.quoteCheckPlanning, detail: prefill?.proposedStartDate ? formatDay(locale, prefill.proposedStartDate) : "—" },
    { ok: Boolean(prefill?.inclusions && prefill.exclusions), label: w.quoteCheckTerms, detail: w.quoteFilled },
    { ok: Boolean(prefill?.warranty && prefill.validUntil), label: w.quoteCheckWarranty, detail: prefill?.warranty ?? "—" },
    { ok: Boolean(prefill?.deliverables), label: w.quoteCheckAttachments, detail: prefill?.deliverables ? w.quoteFilled : "—" },
  ];
  const allOk = checklist.every((item) => item.ok);

  return (
    <main className="client-page provider-workbench provider-quote-preview">
      <p className="provider-breadcrumb">
        <Link href={`/${locale}/sous-traitant/devis${query}`} className="client-text-link">{w.quoteBackToList}</Link>
      </p>
      <header className="provider-workbench-hero">
        <div>
          <div className="provider-chip-row">
            <h2>{w.quotePreviewTitle}{quote?.id ? <span className="client-space-label" dir="ltr">{quote.id.slice(0, 12)}</span> : null}</h2>
            {quote?.status ? <span className="client-status-chip" data-tone="violet">{workflowStatusLabel(quote.status,locale)}</span> : null}
          </div>
          <p>{invitation?.description ?? w.quotePreviewLead}</p>
        </div>
      </header>
      <ol className="provider-quote-steps" aria-label={w.quotePreviewTitle}>
        <li data-state="done"><span><Check className="size-3.5" aria-hidden /></span><small>{w.quoteStepInfo}</small></li>
        <li data-state="done"><span><Check className="size-3.5" aria-hidden /></span><small>{w.quoteStepLines}</small></li>
        <li data-state="done"><span><Check className="size-3.5" aria-hidden /></span><small>{w.quoteStepTerms}</small></li>
        <li data-state="current"><span>4</span><small>{w.quoteStepPreview}</small></li>
        <li data-state="todo"><span>5</span><small>{w.quoteStepSubmit}</small></li>
      </ol>
      {!prefill || !quote || !currency || !invitation ? (
        <article className="client-card" role="status">
          <p>{w.quotePreviewEmpty}</p>
          <Link href={editHref} className="client-cta">{w.quoteBackToEdit}</Link>
        </article>
      ) : (
        <>
          <section className="provider-preview-layout">
            <article className="client-card provider-preview-checklist">
              <header>
                <h3>{w.quoteSubmitChecklist}</h3>
                <p>{w.quotePreviewLead}</p>
              </header>
              <ul className="provider-check-rows">
                {checklist.map((item) => (
                  <li key={item.label} data-ok={item.ok ? "true" : "false"}>
                    <Check className="size-4" aria-hidden />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </li>
                ))}
              </ul>
              <p className={allOk ? "client-verified" : "client-access-note"}>
                <ShieldCheck className="size-4" aria-hidden />
                <span><strong>{allOk ? w.quoteReadyTitle : w.quoteChecks}</strong> — {w.quoteReadyToSubmit}</span>
              </p>
            </article>
            <article className="client-card provider-doc-sheet">
              <header className="provider-doc-toggle">
                <span className="client-status-chip" data-tone="sky" aria-current="page">{w.quoteClientView}</span>
                <span className="provider-meta-chip">{w.quoteInternalView}</span>
              </header>
              <div className="provider-doc-paper">
                <p className="provider-doc-watermark" aria-hidden>{w.quoteDraftMark}</p>
                <div className="provider-doc-parties">
                  <div>
                    <small>{w.quoteIssuer}</small>
                    <strong>{organizationName}</strong>
                  </div>
                  <div>
                    <small>{w.quoteClient}</small>
                    <strong>{w.quoteClientMasked}</strong>
                  </div>
                </div>
                <dl className="provider-quote-identity">
                  <div><dt>{w.quoteConsultation}</dt><dd>{invitation.description}</dd></div>
                  <div><dt>{w.quoteObject}</dt><dd>{prefill.solution}</dd></div>
                  <div><dt>{w.quoteValidityLabel}</dt><dd dir="ltr">{prefill.validUntil ? formatDay(locale, prefill.validUntil) : "—"}</dd></div>
                </dl>
                <div className="client-table-wrap">
                  <table className="client-space-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{m.line}</th>
                        <th>{m.quantity}</th>
                        <th>{m.unit}</th>
                        <th>{m.unitPrice}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prefill.lines.map((line, index) => (
                        <tr key={`${line.label}-${index}`}>
                          <td dir="ltr">{index + 1}</td>
                          <td>{line.label}</td>
                          <td dir="ltr">{line.quantity}</td>
                          <td dir="ltr">{line.unitCode}</td>
                          <td dir="ltr">{line.unitPrice} {currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <dl className="provider-money provider-doc-totals">
                  <div><dt>{m.subtotal}</dt><dd dir="ltr">{quote.subtotalMinor ? formatMinorExact(quote.subtotalMinor, currency, locale) : "—"}</dd></div>
                  <div><dt>{m.taxAmount}</dt><dd dir="ltr">{quote.taxMinor ? formatMinorExact(quote.taxMinor, currency, locale) : "—"}</dd></div>
                  <div className="provider-money-total"><dt>{m.total}</dt><dd dir="ltr">{quote.totalMinor ? formatMinorExact(quote.totalMinor, currency, locale) : "—"}</dd></div>
                </dl>
                <p className="client-verified">{w.quoteServerCalc}</p>
                <section className="provider-quote-notes">
                  <article><h4>{w.quoteInclusions}</h4><ul>{lines(prefill.inclusions).map((item) => <li key={item}>{item}</li>)}</ul></article>
                  <article><h4>{w.quoteExclusions}</h4><ul>{lines(prefill.exclusions).map((item) => <li key={item}>{item}</li>)}</ul></article>
                  <article><h4>{w.quoteWarranty}</h4><p>{prefill.warranty}</p></article>
                </section>
              </div>
            </article>
          </section>
          <footer className="provider-preview-actions">
            <Link href={editHref} className="client-ghost-link">{w.quoteBackToEdit}</Link>
            <div className="provider-workbench-actions">
              <Link href={editHref} className="client-ghost-link">{w.quoteDownloadDraft}</Link>
              {submitPanel}
            </div>
          </footer>
        </>
      )}
    </main>
  );
}
