import type { AdminFinanceDashboard } from "@/modules/admin/data/finance/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import type { AdminFinanceMessages } from "./messages";

function formatDate(value: string, _locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function FinanceSorties({
  locale,
  dashboard,
  m,
}: {
  locale: Locale;
  dashboard: AdminFinanceDashboard;
  m: AdminFinanceMessages;
}) {
  const openInvoices = dashboard.provider_invoices.filter((invoice) => BigInt(invoice.outstanding_minor) > BigInt(0));
  const payments = dashboard.provider_payments;

  return (
    <section id="sorties" className="space-y-5" aria-labelledby="finance-sorties-title">
      <div className="admin-section-head">
        <div>
          <h2 id="finance-sorties-title">{m.sorties}</h2>
          <p>{m.sortiesHint}</p>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <article className="admin-panel space-y-3">
          <h3 className="text-base font-semibold">{m.openInvoices}</h3>
          {openInvoices.length === 0 ? (
            <p role="status" className="text-sm text-[var(--ad-muted)]">
              {m.empty}
            </p>
          ) : (
            <ul className="grid gap-3">
              {openInvoices.map((invoice) => (
                <li key={invoice.id} className="rounded-xl border border-[var(--ad-border)] bg-[var(--mat-canvas)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{invoice.organization_name}</p>
                    <span className="admin-badge" data-tone={invoice.payment_status === "OVERDUE" ? "critical" : "warn"}>
                      {m.states[invoice.payment_status]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm" dir="ltr">
                    {invoice.invoice_number}
                  </p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--ad-muted)]">{m.outstanding}</dt>
                      <dd dir="ltr">{formatMinor(invoice.outstanding_minor, invoice.currency, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--ad-muted)]">{m.dueOn}</dt>
                      <dd>
                        <time dateTime={invoice.due_on}>{formatDate(invoice.due_on, locale)}</time>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="admin-panel space-y-3">
          <h3 className="text-base font-semibold">{m.recordedPayments}</h3>
          {payments.length === 0 ? (
            <p role="status" className="text-sm text-[var(--ad-muted)]">
              {m.empty}
            </p>
          ) : (
            <ul className="grid gap-3">
              {payments.map((payment) => (
                <li key={payment.id} className="rounded-xl border border-[var(--ad-border)] bg-[var(--mat-canvas)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold">{payment.organization_name}</p>
                    <span className="admin-badge">{m.states.PAID}</span>
                  </div>
                  <p className="mt-2 text-sm" dir="ltr">
                    {m.reference} · {payment.payment_reference}
                  </p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--ad-muted)]">{m.amount}</dt>
                      <dd dir="ltr">{formatMinor(payment.amount_minor, payment.currency, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--ad-muted)]">{m.allocated}</dt>
                      <dd dir="ltr">{formatMinor(payment.allocated_minor, payment.currency, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--ad-muted)]">{m.unallocated}</dt>
                      <dd dir="ltr">{formatMinor(payment.unallocated_minor, payment.currency, locale)}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--ad-muted)]">{m.paid}</dt>
                      <dd>
                        <time dateTime={payment.paid_on}>{formatDate(payment.paid_on, locale)}</time>
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
