"use client";
import {commerceIdle}from"@/modules/admin/screens/finance/commerce-state";

import { useActionState } from "react";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import type { AdminPnlDashboard } from "@/modules/admin/data/pnl/model";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { closePnlAction } from "./commerce-actions";
import type { CommerceMessages } from "./commerce-messages";

const control = "min-h-11 w-full rounded-md border bg-background px-3";

export function PnlPanel({ locale, dashboard, m, keyValue }: { locale: Locale; dashboard: AdminPnlDashboard; m: CommerceMessages; keyValue: string }) {
  const [state, action, pending] = useActionState(closePnlAction, commerceIdle);
  const openBooks = dashboard.books.filter((item) => item.status === "OPEN");
  return (
    <section id="pnl" className="scroll-mt-24 space-y-4">
      <h2 className="text-xl font-semibold">{m.pnl}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{m.pnlHint}</p>
      {dashboard.books.length === 0 ? <p>{m.empty}</p> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {dashboard.books.map((book) => (
            <article key={book.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">{book.library_code} · {book.organization_name}</h3>
                <Badge>{book.franchise_type} · {book.status}</Badge>
              </div>
              <p className="mt-2 text-sm">{book.operator_code} · {book.currency}</p>
              {book.latest_closure ? (
                <dl className="mt-3 grid gap-1 text-sm">
                  <div>{m.revenueLabel}: <span dir="ltr">{formatMinor(book.latest_closure.gross_revenue_ex_tax_minor, book.currency, locale)}</span></div>
                  <div>{m.costs}: <span dir="ltr">{formatMinor(book.latest_closure.costs_and_refunds_minor, book.currency, locale)}</span></div>
                  <div>{m.profit}: <strong dir="ltr">{formatMinor(book.latest_closure.distributable_profit_minor, book.currency, locale)}</strong></div>
                  <div>{book.latest_closure.period_start} — {book.latest_closure.period_end}</div>
                </dl>
              ) : <p className="mt-2 text-sm text-muted-foreground">{m.empty}</p>}
              <ul className="mt-2 text-sm">{book.allocations.map((item) => <li key={item.beneficiary_code}>{item.beneficiary_code}: <span dir="ltr">{formatMinor(item.amount_minor, book.currency, locale)}</span></li>)}</ul>
            </article>
          ))}
        </div>
      )}
      {dashboard.capabilities.can_close && openBooks.length > 0 ? (
        <form action={action} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2">
          <h3 className="font-semibold md:col-span-2">{m.closePeriod}</h3>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="idempotencyKey" value={keyValue} />
          <label className="grid gap-1 text-sm">{m.book}
            <select name="bookId" required className={control}>{openBooks.map((book) => <option key={book.id} value={book.id}>{book.library_code} · {book.organization_name}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm">{m.plan}
            <select name="ruleVersionId" required className={control}>{dashboard.rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.franchise_type} v{rule.version}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm">{m.periodStart}<Input name="periodStart" type="date" required className="min-h-11" /></label>
          <label className="grid gap-1 text-sm">{m.periodEnd}<Input name="periodEnd" type="date" required className="min-h-11" /></label>
          <label className="grid gap-1 text-sm">{m.cutoff}<Input name="entryCutoffAt" type="datetime-local" className="min-h-11" /></label>
          <label className="grid gap-1 text-sm md:col-span-2">{m.reason}<Input name="reason" required minLength={10} className="min-h-11" /></label>
          <Button type="submit" disabled={pending} className="min-h-11 md:col-span-2">{pending ? m.processing : m.save}</Button>
          {state.status === "success" ? <p role="status" className="text-sm text-primary md:col-span-2">{m.success} {state.outcome}</p> : null}
          {state.status === "error" ? <p role="alert" className="text-sm text-destructive md:col-span-2">{m.errors[state.reason]}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
