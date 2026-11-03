"use client";
import {commerceIdle}from"@/modules/admin/screens/finance/commerce-state";

import { useActionState } from "react";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import type { AdminVolumeDashboard } from "@/modules/admin/data/volume/model";
import { formatExactUnits, formatMinorExact } from "@/modules/shared/lib/volume-procurement/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { activateFrameworkPoolAction, createFrameworkAction } from "@/modules/admin/screens/finance/commerce-actions";
import { getCommerceMessages } from "@/modules/admin/screens/finance/commerce-messages";

const control = "min-h-11 w-full rounded-md border bg-background px-3";

export function VolumeNegotiatePanel({
  locale, dashboard, ownerOrganizationId, keys, providerOptions = [],
}: {
  locale: Locale;
  dashboard: AdminVolumeDashboard;
  ownerOrganizationId: string | null;
  providerOptions?: Array<{ id: string; name: string }>;
  keys: { negotiate: string; activate: string };
}) {
  const m = getCommerceMessages(locale);
  const [draftState, draftAction, drafting] = useActionState(createFrameworkAction, commerceIdle);
  const [poolState, poolAction, activating] = useActionState(activateFrameworkPoolAction, commerceIdle);
  const skus = dashboard.skus ?? [];
  const agreements = dashboard.agreements ?? [];
  const profitability = dashboard.profitability ?? [];
  const activatable = agreements.filter((item) => (item.status === "DRAFT" || item.status === "ACTIVE") && !item.pool_id);
  const canWrite = dashboard.capabilities.can_negotiate !== false && Boolean(ownerOrganizationId) && skus.length > 0;
  const canActivate = dashboard.capabilities.can_activate_pool !== false && activatable.length > 0;

  return (
    <div className="mt-8 space-y-6">
      <section aria-labelledby="volume-agreements">
        <h2 id="volume-agreements" className="mb-3 text-xl font-semibold">{m.agreements}</h2>
        {agreements.length === 0 ? <p>{m.empty}</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {agreements.map((item) => (
              <article key={item.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-semibold">{item.agreement_code}</h3>
                  <Badge>{item.pool_status ?? item.status}</Badge>
                </div>
                <p className="mt-2 text-sm">{item.sku_code} · {item.payment_model ?? "—"} · {item.currency ?? "—"}</p>
                {item.forecast_units ? <p className="text-sm" dir="ltr">{formatExactUnits(item.forecast_units, locale)}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="volume-profit">
        <h2 id="volume-profit" className="mb-3 text-xl font-semibold">{m.profitability}</h2>
        {profitability.length === 0 ? <p>{m.empty}</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {profitability.map((item) => (
              <article key={`${item.agreement_code}-${item.sku_code}`} className="rounded-xl border bg-card p-4 text-sm">
                <h3 className="font-semibold">{item.agreement_code} · {item.sku_code}</h3>
                <p>{m.consumedCost}: <span dir="ltr">{formatMinorExact(item.consumed_cost_minor, item.currency, locale)}</span></p>
                <p>{m.referenceCost}: <span dir="ltr">{formatMinorExact(item.reference_cost_minor, item.currency, locale)}</span></p>
                <p dir="ltr">{formatExactUnits(item.consumed_units, locale)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
      {canWrite ? (
        <form action={draftAction} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2">
          <h3 className="font-semibold md:col-span-2">{m.negotiate}</h3>
          <p className="text-sm text-muted-foreground md:col-span-2">{m.negotiateHint}</p>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="idempotencyKey" value={keys.negotiate} />
          <input type="hidden" name="ownerOrganizationId" value={ownerOrganizationId!} />
          <label className="grid gap-1 text-sm">{m.sku}
            <select name="skuId" required className={control}>{skus.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.unit_code}</option>)}</select>
          </label>
          <label className="grid gap-1 text-sm">{m.agreementCode}<Input name="agreementCode" required minLength={3} className="min-h-11" dir="ltr" /></label>
          <label className="grid gap-1 text-sm">{m.periodStart}<Input name="validFrom" type="date" required className="min-h-11" /></label>
          <label className="grid gap-1 text-sm">{m.periodEnd}<Input name="validTo" type="date" required className="min-h-11" /></label>
          <label className="grid gap-1 text-sm">{m.forecast}<Input name="forecastUnits" required dir="ltr" className="min-h-11" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?" /></label>
          <label className="grid gap-1 text-sm">{m.minCommit}<Input name="minimumCommitmentUnits" required dir="ltr" defaultValue="0" className="min-h-11" /></label>
          <label className="grid gap-1 text-sm">{m.maxUnits}<Input name="maximumUnits" required dir="ltr" className="min-h-11" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?" /></label>
          <label className="grid gap-1 text-sm">{m.paymentModel}
            <select name="paymentModel" required className={control}>
              <option value="PAY_PER_USE">PAY_PER_USE</option>
              <option value="PREPAID">PREPAID</option>
              <option value="HYBRID">HYBRID</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">{m.currency}<Input name="currency" required defaultValue="MAD" maxLength={3} className="min-h-11" dir="ltr" /></label>
          <label className="grid gap-1 text-sm">{m.unitPrice}<Input name="unitPriceMinor" required inputMode="numeric" pattern="[0-9]+" className="min-h-11" dir="ltr" /></label>
          <Button type="submit" disabled={drafting} className="min-h-11 md:col-span-2">{drafting ? m.processing : m.save}</Button>
          {draftState.status === "success" ? <p role="status" className="text-sm text-primary md:col-span-2">{m.success} {draftState.outcome}</p> : null}
          {draftState.status === "error" ? <p role="alert" className="text-sm text-destructive md:col-span-2">{m.errors[draftState.reason]}</p> : null}
        </form>
      ) : null}
      {canActivate ? (
        <form action={poolAction} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2">
          <h3 className="font-semibold md:col-span-2">{m.activatePool}</h3>
          <p className="text-sm text-muted-foreground md:col-span-2">{m.activatePoolHint}</p>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="idempotencyKey" value={keys.activate} />
          <label className="grid gap-1 text-sm">{m.agreements}
            <select name="agreementId" required className={control}>
              {activatable.map((item) => <option key={item.id} value={item.id}>{item.agreement_code} · {item.status}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">{m.contracted}<Input name="contractedUnits" dir="ltr" className="min-h-11" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?" /></label>
          <label className="grid gap-1 text-sm">{m.threshold}<Input name="lowStockThresholdUnits" required dir="ltr" defaultValue="0" className="min-h-11" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?" /></label>
          <label className="grid gap-1 text-sm">{m.ttlHours}<Input name="reservationTtlHours" required inputMode="numeric" defaultValue="168" className="min-h-11" dir="ltr" pattern="[1-9][0-9]*" /></label>
          <label className="grid gap-1 text-sm">{m.providerOrg}
            <select name="providerOrganizationId" className={control} defaultValue="">
              <option value="">{m.noProvider}</option>
              {providerOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">{m.providerCapacity}<Input name="providerCapacityUnits" dir="ltr" className="min-h-11" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?" /></label>
          <label className="grid gap-1 text-sm">{m.unitPrice}<Input name="unitPriceMinor" inputMode="numeric" pattern="[0-9]+" className="min-h-11" dir="ltr" /></label>
          <Button type="submit" disabled={activating} className="min-h-11 md:col-span-2">{activating ? m.processing : m.activatePool}</Button>
          {poolState.status === "success" ? <p role="status" className="text-sm text-primary md:col-span-2">{m.success} {poolState.outcome}</p> : null}
          {poolState.status === "error" ? <p role="alert" className="text-sm text-destructive md:col-span-2">{m.errors[poolState.reason]}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
