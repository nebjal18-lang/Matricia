import type { AdminFinanceDashboard } from "@/modules/admin/data/finance/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import type { AdminFinanceMessages } from "./messages";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

/** Ledger lecture for open provider invoices + recorded payments (used by tests and secondary surfaces). */
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
    <section id="sorties-ledger" className="admin-finance-zone scroll-mt-24 space-y-5" aria-labelledby="finance-sorties-title">
      <div className="admin-table-tools">
        <div>
          <h2 id="finance-sorties-title">{m.sorties}</h2>
          <p>{m.sortiesHint}</p>
        </div>
      </div>

      <article className="client-card space-y-3 p-4">
        <h3 className="text-base font-semibold">{m.openInvoices}</h3>
        {openInvoices.length === 0 ? (
          <p role="status" className="admin-finance-empty">{m.empty}</p>
        ) : (
          <div className="client-table-wrap" tabIndex={0} role="region" aria-label={m.openInvoices}>
            <table className="client-space-table admin-org-table">
              <thead>
                <tr>
                  <th>{m.organization}</th>
                  <th>{m.status}</th>
                  <th>{m.outstanding}</th>
                  <th>{m.dueOn}</th>
                </tr>
              </thead>
              <tbody>
                {openInvoices.map((invoice) => (
                  <tr key={invoice.id} data-overdue={invoice.payment_status === "OVERDUE" ? "true" : undefined}>
                    <td>
                      <span className="client-doc-cell">
                        <span className="client-avatar" data-tone={invoice.payment_status === "OVERDUE" ? "coral" : "peach"}>
                          {invoice.organization_name.slice(0, 1)}
                        </span>
                        <span>
                          <strong>{invoice.organization_name}</strong>
                          <small dir="ltr">{invoice.invoice_number}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="client-status-chip" data-tone={invoice.payment_status === "OVERDUE" ? "coral" : "peach"}>
                        {m.states[invoice.payment_status]}
                      </span>
                    </td>
                    <td dir="ltr">{formatMinor(invoice.outstanding_minor, invoice.currency, locale)}</td>
                    <td>
                      <time dateTime={invoice.due_on}>{formatDate(invoice.due_on)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="client-card space-y-3 p-4">
        <h3 className="text-base font-semibold">{m.recordedPayments}</h3>
        {payments.length === 0 ? (
          <p role="status" className="admin-finance-empty">{m.empty}</p>
        ) : (
          <div className="client-table-wrap" tabIndex={0} role="region" aria-label={m.recordedPayments}>
            <table className="client-space-table admin-org-table">
              <thead>
                <tr>
                  <th>{m.organization}</th>
                  <th>{m.reference}</th>
                  <th>{m.amount}</th>
                  <th>{m.unallocated}</th>
                  <th>{m.paid}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.organization_name}</strong>
                    </td>
                    <td dir="ltr">{payment.payment_reference}</td>
                    <td dir="ltr">{formatMinor(payment.amount_minor, payment.currency, locale)}</td>
                    <td dir="ltr">{formatMinor(payment.unallocated_minor, payment.currency, locale)}</td>
                    <td>
                      <time dateTime={payment.paid_on}>{formatDate(payment.paid_on)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
