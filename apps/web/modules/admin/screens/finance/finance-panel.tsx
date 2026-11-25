"use client";

import { useActionState, useId, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Building2 } from "lucide-react";
import type { AdminFinanceDashboard } from "@/modules/admin/data/finance/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatDateTimeCasablanca, shortReference } from "@/modules/shared/lib/format/display";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { reconcilePaymentAction, type FinanceActionState } from "./actions";
import type { AdminFinanceMessages } from "./messages";

const idle: FinanceActionState = { status: "idle" };
const activatable = new Set(["TRIAL_ACTIVE", "TRIAL_EXPIRED", "PAST_DUE", "SUSPENDED"]);
const control = "min-h-11 w-full rounded-md border border-[var(--client-line,var(--mat-border))] bg-background px-3 text-base";

type FlowFilter = "all" | "in" | "out";
type TriageKind = "intent" | "subscription" | "payment" | "invoice";
type TriageRow =
  | { kind: "intent"; key: string; sort: number; flow: "in"; item: AdminFinanceDashboard["payment_intents"][number] }
  | { kind: "subscription"; key: string; sort: number; flow: "in"; item: AdminFinanceDashboard["subscriptions"][number] }
  | { kind: "payment"; key: string; sort: number; flow: "out"; item: AdminFinanceDashboard["provider_payments"][number] }
  | { kind: "invoice"; key: string; sort: number; flow: "out"; item: AdminFinanceDashboard["provider_invoices"][number] };

function stamp(value: string, locale: Locale) {
  return formatDateTimeCasablanca(value, locale);
}

function sumMinor(values: string[]): string {
  return values.reduce((acc, value) => acc + BigInt(value), BigInt(0)).toString();
}

function buildTriageRows(dashboard: AdminFinanceDashboard): TriageRow[] {
  const intents = dashboard.payment_intents
    .filter((item) => item.status === "PENDING_VERIFICATION")
    .map((item): TriageRow => ({ kind: "intent", key: `intent:${item.id}`, sort: 2, flow: "in", item }));
  const subscriptions = dashboard.subscriptions
    .filter((item) => activatable.has(item.status))
    .map((item): TriageRow => ({
      kind: "subscription",
      key: `subscription:${item.id}`,
      sort: item.status === "PAST_DUE" || item.status === "SUSPENDED" ? 3 : 4,
      flow: "in",
      item,
    }));
  const payments = dashboard.provider_payments
    .filter((item) => BigInt(item.unallocated_minor) > BigInt(0))
    .map((item): TriageRow => ({ kind: "payment", key: `payment:${item.id}`, sort: 0, flow: "out", item }));
  const invoices = dashboard.provider_invoices
    .filter((item) => BigInt(item.outstanding_minor) > BigInt(0))
    .map((item): TriageRow => ({
      kind: "invoice",
      key: `invoice:${item.id}`,
      sort: item.payment_status === "OVERDUE" ? 0 : 1,
      flow: "out",
      item,
    }));
  return [...payments, ...invoices, ...intents, ...subscriptions].sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort;
    const kindRank = { payment: 0, invoice: 1, intent: 2, subscription: 3 } as const;
    if (a.kind !== b.kind) return kindRank[a.kind] - kindRank[b.kind];
    return a.key.localeCompare(b.key);
  });
}

function ActionStatus({ state, m }: { state: FinanceActionState; m: AdminFinanceMessages }) {
  if (state.status === "idle") return <p role="status" aria-live="polite" className="min-h-5 text-sm" />;
  if (state.status === "success") {
    return (
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-[var(--client-cta)]">
        {m.success} {m.batch}: <bdi dir="ltr">{shortReference(state.batchId)}</bdi>
      </p>
    );
  }
  return <p role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">{m.errors[state.reason]}</p>;
}

function ReconcileForm({
  locale,
  m,
  identity,
  payments,
  invoices,
  selectedPaymentId,
  selectedInvoiceId,
}: {
  locale: Locale;
  m: AdminFinanceMessages;
  identity: { idempotencyKey: string; correlationId: string };
  payments: AdminFinanceDashboard["provider_payments"];
  invoices: AdminFinanceDashboard["provider_invoices"];
  selectedPaymentId?: string;
  selectedInvoiceId?: string;
}) {
  const prefix = useId();
  const [state, action, pending] = useActionState(reconcilePaymentAction, idle);
  const initialInvoice = invoices.find((item) => item.id === selectedInvoiceId);
  const [paymentId, setPaymentId] = useState(selectedPaymentId ?? payments.find((item) => initialInvoice && item.organization_id === initialInvoice.organization_id && item.currency === initialInvoice.currency)?.id ?? payments[0]?.id);
  const [invoiceId, setInvoiceId] = useState(selectedInvoiceId);
  const payment = payments.find((item) => item.id === paymentId) ?? payments[0];
  const compatibleInvoices = invoices.filter((item) => item.organization_id === payment?.organization_id && item.currency === payment.currency);
  const invoice = compatibleInvoices.find((item) => item.id === invoiceId) ?? compatibleInvoices[0];
  const suggested =
    payment && invoice
      ? BigInt(payment.unallocated_minor) < BigInt(invoice.outstanding_minor)
        ? payment.unallocated_minor
        : invoice.outstanding_minor
      : "";

  if (!payments.length || !invoices.length) {
    return <p role="status" className="client-access-note">{m.empty}</p>;
  }

  return (
    <form action={action} id="rapprochements" className="admin-triage-forms grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="idempotencyKey" value={identity.idempotencyKey} />
      <input type="hidden" name="correlationId" value={identity.correlationId} />
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-payment`}>{m.payment}</Label>
        <select
          id={`${prefix}-payment`}
          name="paymentId"
          required
          className={control}
          value={payment?.id ?? ""}
          onChange={(event) => setPaymentId(event.target.value)}
        >
          {payments.map((item) => (
            <option key={item.id} value={item.id}>
              {item.organization_name} · {item.payment_reference} · {formatMinor(item.unallocated_minor, item.currency, locale)}
            </option>
          ))}
        </select>
        {payment ? (
          <p className="text-sm font-semibold" dir="ltr">
            {formatMinor(payment.unallocated_minor, payment.currency, locale)}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-invoice`}>{m.invoice}</Label>
        <select
          id={`${prefix}-invoice`}
          name="invoiceId"
          required
          className={control}
          value={invoice?.id ?? ""}
          onChange={(event) => setInvoiceId(event.target.value)}
        >
          {!compatibleInvoices.length ? <option value="">{m.empty}</option> : null}
          {compatibleInvoices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.organization_name} · {item.invoice_number} · {formatMinor(item.outstanding_minor, item.currency, locale)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}-amount`}>{m.allocation}</Label>
        <Input
          id={`${prefix}-amount`}
          name="amountMinor"
          inputMode="numeric"
          pattern="[1-9][0-9]*"
          required
          className="min-h-11"
          dir="ltr"
          defaultValue={suggested ? String(suggested) : undefined}
          key={`amount:${payment?.id ?? ""}:${invoice?.id ?? ""}:${suggested}`}
        />
      </div>
      <label className="flex min-h-11 items-start gap-3 rounded-md border border-[var(--client-line)] p-3 text-sm">
        <input key={`confirm:${payment?.id}:${invoice?.id}`} type="checkbox" name="confirmed" value="yes" required className="mt-0.5 size-5 accent-primary" />
        <span>{m.confirm}</span>
      </label>
      <button type="submit" disabled={pending || !payment || !invoice} className="admin-primary-cta min-h-11 w-full">
        {pending ? m.reconciling : m.reconcile}
      </button>
      <ActionStatus state={state} m={m} />
    </form>
  );
}

export function FinancePanel({
  locale,
  dashboard,
  m,
  identity,
  organizationQuery = "",
}: {
  locale: Locale;
  dashboard: AdminFinanceDashboard;
  m: AdminFinanceMessages;
  identity: { idempotencyKey: string; correlationId: string };
  organizationQuery?: string;
}) {
  const prefix = useId();
  const [filter, setFilter] = useState<FlowFilter>("all");
  const rows = useMemo(() => buildTriageRows(dashboard), [dashboard]);
  const visible = rows.filter((row) => filter === "all" || row.flow === filter);
  const defaultKey = visible[0]?.key ?? rows[0]?.key ?? null;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeKey = selectedKey && visible.some((row) => row.key === selectedKey)
    ? selectedKey
    : selectedKey && rows.some((row) => row.key === selectedKey)
      ? selectedKey
      : defaultKey;
  const selected = rows.find((row) => row.key === activeKey) ?? null;

  const unallocated = dashboard.provider_payments.filter((item) => BigInt(item.unallocated_minor) > BigInt(0));
  const openInvoices = dashboard.provider_invoices.filter((item) => BigInt(item.outstanding_minor) > BigInt(0));
  const currency = unallocated[0]?.currency ?? openInvoices[0]?.currency ?? dashboard.payment_events[0]?.currency ?? "MAD";

  const inflowMinor = sumMinor([
    ...dashboard.payment_events.map((item) => item.amount_minor),
    ...dashboard.payment_intents.filter((item) => item.status === "PENDING_VERIFICATION").map((item) => item.amount_minor),
  ]);
  const providerMinor = sumMinor(openInvoices.map((item) => item.outstanding_minor));
  const q = organizationQuery;

  function operationLabel(kind: TriageKind) {
    if (kind === "payment") return m.opReconcile;
    if (kind === "invoice") return m.opPay;
    if (kind === "intent") return m.opIntent;
    return m.opSubscription;
  }

  function stateLabel(row: TriageRow) {
    if (row.kind === "payment") return m.stateReconcile;
    if (row.kind === "invoice") return m.statePay;
    if (row.kind === "intent") return m.stateVerify;
    return m.stateActivate;
  }

  function stateTone(row: TriageRow): "coral" | "peach" | "sky" | "violet" | "mint" {
    if (row.kind === "invoice" && row.item.payment_status === "OVERDUE") return "coral";
    if (row.kind === "invoice") return "peach";
    if (row.kind === "payment") return "sky";
    if (row.kind === "intent") return "peach";
    return "violet";
  }

  function amountOf(row: TriageRow) {
    if (row.kind === "payment") return formatMinor(row.item.unallocated_minor, row.item.currency, locale);
    if (row.kind === "invoice") return formatMinor(row.item.outstanding_minor, row.item.currency, locale);
    if (row.kind === "intent") return formatMinor(row.item.amount_minor, row.item.currency, locale);
    return "—";
  }

  function dueOf(row: TriageRow) {
    if (row.kind === "payment") return row.item.paid_on;
    if (row.kind === "invoice") return row.item.due_on;
    if (row.kind === "intent") return stamp(row.item.created_at, locale);
    return stamp(row.item.current_period_end ?? row.item.updated_at, locale);
  }

  return (
    <div id="finance-aujourdhui" className="admin-finance-panel scroll-mt-24 space-y-6">
      <p className="admin-finance-asof" role="status">
        {m.asOf}{" "}
        <time dateTime={dashboard.as_of} dir="ltr">{stamp(dashboard.as_of, locale)}</time>
      </p>

      <section className="admin-finance-kpi" aria-label={m.summary}>
        <article className="admin-finance-kpi-card" data-tone="mint">
          <span>{m.kpiInflows}</span>
          <strong dir="ltr">{formatMinor(inflowMinor, currency, locale)}</strong>
        </article>
        <article className="admin-finance-kpi-card" data-tone="peach">
          <span>{m.kpiProviders}</span>
          <strong dir="ltr">{formatMinor(providerMinor, currency, locale)}</strong>
        </article>
        <article className="admin-finance-kpi-card" data-tone="sky">
          <span>{m.kpiReconcile}</span>
          <strong dir="ltr">{unallocated.length}</strong>
        </article>
      </section>

      <section className="admin-org-layout" aria-label={m.summary}>
        <article className="client-card" id="paiements">
          <div id="abonnements" className="admin-table-tools">
            <div>
              <h2 id={`${prefix}-summary`}>
                {m.summary} <span dir="ltr">({visible.length})</span>
              </h2>
            </div>
            <div className="admin-finance-filters" role="group" aria-label={m.summary}>
              {([
                ["all", m.filterAll],
                ["in", m.filterIn],
                ["out", m.filterOut],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "admin-soft-cta" : "client-ghost-link"}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="admin-empty-card">
              <h3>{m.empty}</h3>
            </div>
          ) : (
            <div className="client-table-wrap" tabIndex={0} role="region" aria-label={m.summary}>
              <table className="client-space-table admin-org-table">
                <thead>
                  <tr>
                    <th>{m.organization}</th>
                    <th>{m.operation}</th>
                    <th>{m.status}</th>
                    <th>{m.amount}</th>
                    <th>{m.dueOn}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const selectedRow = activeKey === row.key;
                    const name = row.item.organization_name;
                    return (
                      <tr
                        key={row.key}
                        data-selected={selectedRow ? "true" : undefined}
                        data-kind={row.kind}
                        data-overdue={row.kind === "invoice" && row.item.payment_status === "OVERDUE" ? "true" : undefined}
                      >
                        <td>
                          <button type="button" className="admin-triage-select" aria-pressed={selectedRow} onClick={() => setSelectedKey(row.key)}>
                            <span className="client-doc-cell">
                              <span className="client-avatar" data-tone={stateTone(row)}>{name.slice(0, 1)}</span>
                              <span>
                                <strong>{name}</strong>
                                <small>
                                  {row.kind === "payment"
                                    ? row.item.payment_reference
                                    : row.kind === "invoice"
                                      ? row.item.invoice_number
                                      : row.kind === "intent"
                                        ? row.item.gateway
                                        : row.item.plan_code ?? "—"}
                                </small>
                              </span>
                            </span>
                          </button>
                        </td>
                        <td>{operationLabel(row.kind)}</td>
                        <td>
                          <span className="client-status-chip" data-tone={stateTone(row)}>{stateLabel(row)}</span>
                        </td>
                        <td dir="ltr">{amountOf(row)}</td>
                        <td dir="ltr">{dueOf(row)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <aside className="client-card admin-treat-rail" aria-label={m.focusToday}>
          <h2>{m.focusToday}</h2>
          {!selected ? (
            <>
              <p>{m.selectPrompt}</p>
              <p className="client-access-note">{m.selectLead}</p>
            </>
          ) : (
            <>
              <div className="admin-triage-selected">
                <strong>{selected.item.organization_name}</strong>
                <small>{operationLabel(selected.kind)} · {stateLabel(selected)}</small>
                <Link href={`/${locale}/administration/entreprises/${selected.item.organization_id}${q}`} className="client-ghost-link">
                  {m.openEnterprise}
                </Link>
              </div>
              {selected.kind === "payment" || selected.kind === "invoice" ? (
                <ReconcileForm
                  key={selected.key}
                  locale={locale}
                  m={m}
                  identity={identity}
                  payments={unallocated}
                  invoices={openInvoices}
                  selectedPaymentId={selected.kind === "payment" ? selected.item.id : undefined}
                  selectedInvoiceId={selected.kind === "invoice" ? selected.item.id : undefined}
                />
              ) : (
                <p className="client-access-note">{selected.kind === "subscription" ? m.automatic : m.states.PENDING_VERIFICATION}</p>
              )}
            </>
          )}
        </aside>
      </section>

      <details className="client-card p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">{m.sorties}</summary>
        <div className="mt-4 space-y-6">
      <section id="sorties" className="scroll-mt-24 space-y-3" aria-labelledby={`${prefix}-sorties`}>
        <div className="admin-table-tools">
          <div>
            <h2 id={`${prefix}-sorties`}>{m.sorties}</h2>
            <p>{m.sortiesHint}</p>
          </div>
        </div>
        {openInvoices.length === 0 ? (
          <p role="status" className="admin-finance-empty">{m.empty}</p>
        ) : (
          <div className="client-table-wrap" tabIndex={0} role="region" aria-label={m.sorties}>
            <table className="client-space-table admin-org-table">
              <thead>
                <tr>
                  <th>{m.provider}</th>
                  <th>{m.invoiceLabel}</th>
                  <th>{m.dueOn}</th>
                  <th>{m.outstanding}</th>
                  <th>{m.status}</th>
                  <th>{m.action}</th>
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
                        </span>
                      </span>
                    </td>
                    <td dir="ltr">{invoice.invoice_number}</td>
                    <td dir="ltr">{invoice.due_on}</td>
                    <td dir="ltr">{formatMinor(invoice.outstanding_minor, invoice.currency, locale)}</td>
                    <td>
                      <span className="client-status-chip" data-tone={invoice.payment_status === "OVERDUE" ? "coral" : "peach"}>
                        {m.states[invoice.payment_status]}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="admin-soft-cta min-h-11"
                        onClick={() => {
                          setFilter("out");
                          setSelectedKey(`invoice:${invoice.id}`);
                          document.getElementById("finance-aujourdhui")?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        {m.treat}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-finance-history" aria-labelledby={`${prefix}-history`}>
        <h2 id={`${prefix}-history`} className="mb-3 text-lg font-semibold">{m.historyTitle}</h2>
        <div className="admin-finance-history-grid">
          <article className="client-card p-4">
            <h3 className="mb-3 font-semibold">{m.events}</h3>
            {dashboard.payment_events.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">{m.empty}</p>
            ) : (
              <ul className="space-y-3">
                {dashboard.payment_events.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--client-cta)]" aria-hidden />
                    <span>
                      <strong>{item.organization_name}</strong>
                      <small className="mt-0.5 block text-muted-foreground" dir="ltr">
                        {formatMinor(item.amount_minor, item.currency, locale)} · {stamp(item.received_at, locale)}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="client-card p-4">
            <h3 className="mb-3 font-semibold">{m.cycles}</h3>
            {dashboard.cycles.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">{m.empty}</p>
            ) : (
              <ul className="space-y-3">
                {dashboard.cycles.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex gap-3 text-sm">
                    <FileText className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <strong>{item.organization_name}</strong>
                      <small className="mt-0.5 block text-muted-foreground" dir="ltr">
                        {m.cycle} {item.cycle_number} · {formatMinor(item.amount_minor, item.currency, locale)}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
          <article className="client-card p-4">
            <h3 className="mb-3 font-semibold">{m.subscriptions}</h3>
            {dashboard.subscriptions.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">{m.empty}</p>
            ) : (
              <ul className="space-y-3">
                {dashboard.subscriptions.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex gap-3 text-sm">
                    <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      <strong>{item.organization_name}</strong>
                      <small className="mt-0.5 block">
                        <span className="client-status-chip" data-tone={item.status === "ACTIVE" ? "mint" : "peach"}>{m.states[item.status]}</span>
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>
        </div>
      </details>
    </div>
  );
}
