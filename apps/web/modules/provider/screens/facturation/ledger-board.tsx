import{PagedBillingTable}from"./paged-history";
import{workflowStatusLabel}from"@/modules/shared/lib/i18n/workflow-statuses";
import Link from "next/link";
import { formatMinor, type BillingDashboard, type ProviderCommissionReceipt } from "@/modules/provider/data/billing/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { getBillingMessages, type BillingMessages } from "@/modules/provider/screens/facturation/messages";
import { SchedulePlanForm } from "./schedule-plan-form";

export type LedgerKind = "pre-releve" | "factures" | "echeancier" | "commissions";

function eventLabel(type: string, m: BillingMessages) {
  if (type === "CLIENT_RECEIPT_CONFIRMED") return m.receiptConfirmed;
  if (type === "COMMISSION_ACCRUAL") return m.commission;
  if (type === "PENALTY_ACCRUAL") return m.penalty;
  if (type === "ADJUSTMENT") return m.adjustment;
  return type.replaceAll("_", " ");
}

export function ledgerHref(locale: Locale, kind: LedgerKind, query: string) {
  const segment = kind === "pre-releve" ? "pre-releve" : kind === "factures" ? "factures-matricia" : kind === "echeancier" ? "echeancier" : "commissions";
  return `/${locale}/sous-traitant/facturation/${segment}${query}`;
}

export function LedgerCycleNav({ locale, query, active }: { locale: Locale; query: string; active: LedgerKind }) {
  const m = getBillingMessages(locale);
  const items: Array<[LedgerKind, string]> = [
    ["pre-releve", m.preReleve],
    ["factures", m.facturesMatricia],
    ["echeancier", m.echeancier],
    ["commissions", m.commissionsTitle],
  ];
  return (
    <nav className="client-tabs" aria-label={m.ledgerNav}>
      {items.map(([kind, label]) => (
        <Link key={kind} href={ledgerHref(locale, kind, query)} aria-current={kind === active ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}

export function ProviderLedgerBoard({
  locale,
  query,
  kind,
  dashboard,
  receipts,
  planKey,
}: {
  locale: Locale;
  query: string;
  kind: LedgerKind;
  dashboard: BillingDashboard;
  receipts?: ProviderCommissionReceipt[];
  planKey?: string;
}) {
  const m = getBillingMessages(locale);
  const title = kind === "pre-releve" ? m.preReleve : kind === "factures" ? m.facturesMatricia : kind === "echeancier" ? m.echeancier : m.commissionsTitle;
  const lead = kind === "pre-releve" ? m.preReleveLead : kind === "factures" ? m.facturesMatriciaLead : kind === "echeancier" ? m.echeancierLead : m.commissionsLead;
  return (
    <main className="client-page">
      <LedgerCycleNav locale={locale} query={query} active={kind} />
      <article className="client-card">
        <header><h2>{title}</h2></header>
        <p>{lead}</p>
        {kind === "pre-releve" ? <PayablesTable locale={locale} dashboard={dashboard} m={m} /> : null}
        {kind === "factures" ? <InvoicesTable locale={locale} query={query} dashboard={dashboard} m={m} /> : null}
        {kind === "echeancier" ? <ScheduleTables locale={locale} query={query} dashboard={dashboard} m={m} planKey={planKey} /> : null}
        {kind === "commissions" ? <CommissionsTable locale={locale} query={query} receipts={receipts ?? []} m={m} /> : null}
      </article>
    </main>
  );
}

function PayablesTable({ locale, dashboard, m }: { locale: Locale; dashboard: BillingDashboard; m: BillingMessages }) {
  if (dashboard.payables.length === 0) return <p>{m.empty}</p>;
  return (
    <PagedBillingTable locale={locale}>
      <thead><tr><th>{m.date}</th><th>{m.event}</th><th>{m.amount}</th></tr></thead>
      <tbody>
        {dashboard.payables.map((row) => (
          <tr key={row.id}>
            <td dir="ltr">{row.occurredOn}</td>
            <td>{eventLabel(row.eventType, m)}</td>
            <td dir="ltr">{formatMinor(row.totalDueMinor, row.currency, locale)}</td>
          </tr>
        ))}
      </tbody>
    </PagedBillingTable>
  );
}

function InvoicesTable({ locale, query, dashboard, m }: { locale: Locale; query: string; dashboard: BillingDashboard; m: BillingMessages }) {
  if (dashboard.invoices.length === 0) return <p>{m.empty}</p>;
  return (
    <PagedBillingTable locale={locale}>
      <thead><tr><th>{m.number}</th><th>{m.due}</th><th>{m.amount}</th><th>{m.outstanding}</th><th>{m.status}</th></tr></thead>
      <tbody>
        {dashboard.invoices.map((row) => (
          <tr key={row.id}>
            <td><Link href={`/${locale}/sous-traitant/facturation/${row.id}${query}`} className="client-text-link" dir="ltr">{row.number}</Link></td>
            <td dir="ltr">{row.dueOn}</td>
            <td dir="ltr">{formatMinor(row.totalMinor, row.currency, locale)}</td>
            <td dir="ltr">{formatMinor(row.outstandingMinor, row.currency, locale)}</td>
            <td>{workflowStatusLabel(row.paymentStatus,locale)}</td>
          </tr>
        ))}
      </tbody>
    </PagedBillingTable>
  );
}

function ScheduleTables({ locale, query, dashboard, m, planKey }: { locale: Locale; query: string; dashboard: BillingDashboard; m: BillingMessages; planKey?: string }) {
  const open = dashboard.invoices.filter((row) => row.outstandingMinor !== "0").slice().sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return (
    <div className="client-stack">
      {open.length === 0 ? <p>{m.empty}</p> : (
        <PagedBillingTable locale={locale}>
          <thead><tr><th>{m.invoice}</th><th>{m.dueSoon}</th><th>{m.outstanding}</th><th>{m.status}</th></tr></thead>
          <tbody>
            {open.map((row) => (
              <tr key={row.id}>
                <td><Link href={`/${locale}/sous-traitant/facturation/${row.id}${query}`} className="client-text-link" dir="ltr">{row.number}</Link></td>
                <td dir="ltr">{row.dueOn}</td>
                <td dir="ltr">{formatMinor(row.outstandingMinor, row.currency, locale)}</td>
                <td>{workflowStatusLabel(row.paymentStatus,locale)}</td>
              </tr>
            ))}
          </tbody>
        </PagedBillingTable>
      )}
      <h3>{m.paymentPlans}</h3>
      {dashboard.paymentPlans.length === 0 ? <p>{m.empty}</p> : (
        <PagedBillingTable locale={locale}>
          <thead><tr><th>{m.invoice}</th><th>{m.status}</th><th>{m.installment}</th></tr></thead>
          <tbody>
            {dashboard.paymentPlans.map((plan) => (
              <tr key={plan.id}>
                <td dir="ltr">{plan.invoiceNumber}</td>
                <td>{workflowStatusLabel(plan.status,locale)}</td>
                <td>{plan.installments.map((item) => `${item.dueOn} · ${(plan.currency?formatMinor(item.amountMinor,plan.currency,locale):(locale==="ar"?"المبلغ غير متاح: عملة الفاتورة غير محملة":"Montant indisponible : devise de la facture non chargée"))}`).join(" · ")}</td>
              </tr>
            ))}
          </tbody>
        </PagedBillingTable>
      )}
      {planKey ? <SchedulePlanForm dashboard={dashboard} locale={locale} m={m} keyValue={planKey} /> : null}
      <h3>{m.payments}</h3>
      {dashboard.payments.length === 0 ? <p>{m.empty}</p> : (
        <PagedBillingTable locale={locale}>
          <thead><tr><th>{m.reference}</th><th>{m.paidOn}</th><th>{m.amount}</th></tr></thead>
          <tbody>
            {dashboard.payments.map((row) => (
              <tr key={row.id}>
                <td dir="ltr">{row.reference}</td>
                <td dir="ltr">{row.paidOn}</td>
                <td dir="ltr">{formatMinor(row.amountMinor, row.currency, locale)}</td>
              </tr>
            ))}
          </tbody>
        </PagedBillingTable>
      )}
    </div>
  );
}

function CommissionsTable({ locale, query, receipts, m }: { locale: Locale; query: string; receipts: ProviderCommissionReceipt[]; m: BillingMessages }) {
  if (receipts.length === 0) return <p>{m.empty}</p>;
  return (
    <PagedBillingTable locale={locale}>
      <thead><tr><th>{m.receipt}</th><th>{m.invoice}</th><th>{m.commission}</th><th>{m.tax}</th><th>{m.date}</th></tr></thead>
      <tbody>
        {receipts.map((row) => (
          <tr key={row.id}>
            <td dir="ltr">{row.reference}</td>
            <td><Link href={`/${locale}/sous-traitant/facturation/${row.invoiceId}${query}`} className="client-text-link" dir="ltr">{row.invoiceNumber}</Link></td>
            <td dir="ltr">{formatMinor(row.commissionMinor, row.currency, locale)}</td>
            <td dir="ltr">{formatMinor(row.taxMinor, row.currency, locale)}</td>
            <td dir="ltr">{row.recordedAt.slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </PagedBillingTable>
  );
}
