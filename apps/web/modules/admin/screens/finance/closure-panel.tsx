"use client";
import {commerceIdle}from"@/modules/admin/screens/finance/commerce-state";

import { useActionState } from "react";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import type { AdminClosureDashboard } from "@/modules/admin/data/closure/model";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { issueStatementAction } from "./commerce-actions";
import type { CommerceMessages } from "./commerce-messages";

const control = "min-h-11 w-full rounded-md border bg-background px-3";

export function ClosurePanel({ locale, dashboard, m, keyValue }: { locale: Locale; dashboard: AdminClosureDashboard; m: CommerceMessages; keyValue: string }) {
  const [state, action, pending] = useActionState(issueStatementAction, commerceIdle);
  return (
    <section id="cloture" className="scroll-mt-24 space-y-4">
      <h2 className="text-xl font-semibold">{m.closure}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{m.closureHint}</p>
      <div className="grid gap-3 lg:grid-cols-3">
        <Block title={m.unstatemented} empty={m.empty} items={dashboard.unstatemented.map((item) => (
          <article key={`${item.provider_organization_id}-${item.currency}`} className="rounded-xl border bg-card p-4 text-sm">
            <h3 className="font-semibold">{item.organization_name}</h3>
            <p>{m.events}: {item.event_count}</p>
            <p dir="ltr">{formatMinor(item.total_minor, item.currency, locale)}</p>
          </article>
        ))} />
        <Block title={m.statements} empty={m.empty} items={dashboard.statements.map((item) => (
          <article key={item.id} className="rounded-xl border bg-card p-4 text-sm">
            <div className="flex justify-between gap-2"><h3 className="font-semibold">{item.statement_number}</h3><Badge>{item.invoiced ? m.invoiced : "ISSUED"}</Badge></div>
            <p>{item.organization_name}</p>
            <p dir="ltr">{formatMinor(item.total_minor, item.currency, locale)}</p>
          </article>
        ))} />
        <Block title={m.overdue} empty={m.empty} items={dashboard.overdue_invoices.map((item) => (
          <article key={item.id} className="rounded-xl border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold">{item.invoice_number}</h3>
              {item.blocks_new_opportunities ? <Badge>{m.overdueBlocksNew}</Badge> : null}
            </div>
            <p>{item.organization_name}</p>
            <p>{m.outstanding}: <span dir="ltr">{formatMinor(item.outstanding_minor, item.currency, locale)}</span></p>
            <time dateTime={item.due_on}>{item.due_on}</time>
            {item.blocks_new_opportunities ? <p className="mt-2 text-muted-foreground">{m.overdueHint}</p> : null}
          </article>
        ))} />
      </div>
      {dashboard.capabilities.can_issue_statement && dashboard.unstatemented.length > 0 ? (
        <form action={action} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2">
          <h3 className="font-semibold md:col-span-2">{m.issueStatement}</h3>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="idempotencyKey" value={keyValue} />
          <label className="grid gap-1 text-sm">{m.organization}
            <select name="providerOrganizationId" required className={control}>
              {dashboard.unstatemented.map((item) => <option key={`${item.provider_organization_id}-${item.currency}`} value={item.provider_organization_id}>{item.organization_name} · {item.currency}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">{m.currency}
            <select name="currency" required className={control}>
              {[...new Set(dashboard.unstatemented.map((item) => item.currency))].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">{m.statementNumber}<Input name="statementNumber" required minLength={3} className="min-h-11" dir="ltr" /></label>
          <label className="grid gap-1 text-sm">{m.periodStart}<Input name="periodStart" type="date" required className="min-h-11" /></label>
          <label className="grid gap-1 text-sm">{m.periodEnd}<Input name="periodEnd" type="date" required className="min-h-11" /></label>
          <Button type="submit" disabled={pending} className="min-h-11 md:col-span-2">{pending ? m.processing : m.save}</Button>
          {state.status === "success" ? <p role="status" className="text-sm text-primary md:col-span-2">{m.success} {state.outcome}</p> : null}
          {state.status === "error" ? <p role="alert" className="text-sm text-destructive md:col-span-2">{m.errors[state.reason]}</p> : null}
        </form>
      ) : null}
    </section>
  );
}

function Block({ title, empty, items }: { title: string; empty: string; items: React.ReactNode[] }) {
  return <div className="space-y-3"><h3 className="font-semibold">{title}</h3>{items.length ? items : <p className="rounded-xl border bg-card p-4">{empty}</p>}</div>;
}
