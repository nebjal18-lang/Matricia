"use client";
import {commerceIdle}from"@/modules/admin/screens/finance/commerce-state";

import { useActionState } from "react";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import type { AdminBoxesDashboard } from "@/modules/admin/data/boxes/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import {
  activateBenefitAction,
  activateBoxAction,
  createBenefitAction,
  createBoxAction,
  ensureWalletAction,
  linkPlanBoxAction,
  type CommerceActionState,
} from "./commerce-actions";
import type { CommerceMessages } from "./commerce-messages";
import {BoxConfigurationApproval} from "./box-approval-panel";
import {ManualCreditGrantPanel} from "./manual-credit-panel";
import {SubscriptionGrantPanel} from "./subscription-grant-panel";

const control = "min-h-11 w-full rounded-md border bg-background px-3";
const types = ["PLATFORM_FEATURE", "SERVICE_UNIT", "CREDIT_SERVICE", "PRIORITY", "QUOTA", "ACCESS_RIGHT", "SERVICE_SUBSIDY", "CONSULTATION", "REPORT", "CUSTOM"];
const modes = ["AUTOMATED_PLATFORM", "MATRICIA_INTERNAL", "DIRECT_PROVIDER", "SUBCONTRACTOR_POOL", "VOLUME_POOL", "RFQ"];
const boxTypes = ["FIXED", "SEMI_CUSTOM", "CUSTOM", "ENTERPRISE", "MULTI_USER", "MULTI_LIBRARY"];

function Feedback({ state, m }: { state: CommerceActionState; m: CommerceMessages }) {
  if (state.status === "idle") return null;
  if (state.status === "success") return <p role="status" className="text-sm text-primary">{m.success} {state.outcome}</p>;
  return <p role="alert" className="text-sm text-destructive">{m.errors[state.reason]}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm">{label}{children}</label>;
}

export function BoxesPanel({
  locale, dashboard, m, auditOrganizationId, keys,
}: {
  locale: Locale;
  dashboard: AdminBoxesDashboard;
  m: CommerceMessages;
  auditOrganizationId: string | null;
  keys: Record<string, string>;
}) {
  const name = (fr: string, ar: string) => (locale === "ar" ? ar : fr);
  const draftBenefits = dashboard.benefits.filter((item) => item.status === "DRAFT" || item.status === "UNDER_REVIEW");
  const draftBoxes = dashboard.boxes.filter((item) => item.status === "DRAFT" || item.status === "UNDER_REVIEW");
  const activeBoxes = dashboard.boxes.filter((item) => item.status === "ACTIVE");
  const canWrite = dashboard.capabilities.can_write && Boolean(auditOrganizationId);

  return (
    <div className="space-y-6">
      <p className="text-sm leading-6 text-muted-foreground">{m.boxesHint}</p>
      <a className="inline-flex min-h-11 items-center rounded border px-3 underline" href={`/${locale}/administration/avantages/regles`}>{locale==="ar"?"مراجعة قواعد الأهلية والحصص والقدرات":"Revoir les règles d’admission, quotas et capacités"}</a>
      <a className="inline-flex min-h-11 items-center rounded border px-3 underline" href={`/${locale}/administration/avantages/livraisons`}>{locale==="ar"?"تنفيذ المزايا ومراجعة أدلة التسليم":"Exécuter les avantages et revoir les preuves de livraison"}</a>
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label={m.benefits} value={dashboard.benefits.length} />
        <Metric label={m.boxBuilder} value={dashboard.boxes.length} />
        <Metric label={m.wallets} value={dashboard.wallets.length} />
      </section>

      <DataList title={m.boxes} empty={m.empty}>
        {dashboard.boxes.map((item) => (
          <article key={item.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-semibold">{name(item.name_fr, item.name_ar)}</h3>
              <Badge variant={item.needs_approval ? "destructive" : "outline"}>{item.status} · v{item.version}</Badge>
            </div>
            <p className="mt-2 text-sm" dir="ltr">{item.code} · {item.box_type} · {item.credit_budget} cr</p>
            <p className="mt-1 text-sm" dir="ltr">{formatMinor(item.cost_low_minor, item.currency, locale)} / {formatMinor(item.cost_expected_minor, item.currency, locale)} / {formatMinor(item.cost_full_minor, item.currency, locale)}</p>
            {item.needs_approval ? <p className="mt-2 text-sm text-destructive">{m.needsApproval}</p> : null}
            <ul className="mt-2 text-sm text-muted-foreground">{item.slots.map((slot) => <li key={slot.id}>{slot.slot_code} · {slot.slot_kind} · {slot.minimum_selections}–{slot.maximum_selections}</li>)}</ul>
          </article>
        ))}
      </DataList>

      <p>{locale==="ar"?"يتطلب كل حجز ميزة مدفوع سياسة أهلية معتمدة. راجع حالتها وشروطها من قواعد المزايا.":"Toute réservation payante d’avantage exige une politique d’admission approuvée. Consultez son état et ses conditions dans les règles des avantages."}</p>
      <DataList title={m.benefits} empty={m.empty}>
        {dashboard.benefits.map((item) => (
          <article key={item.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-semibold">{name(item.name_fr, item.name_ar)}</h3>
              <Badge>{item.status} · v{item.version}</Badge>
            </div>
            <p className="mt-2 text-sm" dir="ltr">{item.code} · {item.benefit_type} · {item.credit_cost} cr · {formatMinor(item.internal_cost_minor, item.currency, locale)}</p>
          </article>
        ))}
      </DataList>

      <section id="simulation" className="scroll-mt-24 space-y-3">
        <h3 className="text-lg font-semibold">{locale==="ar"?"روابط الخطط والباقات واعتماد الإعداد":"Liaisons plan/Box et approbations de configuration"}</h3>
        {dashboard.plan_matrix.length === 0 ? <p>{m.empty}</p> : (
          <ul className="grid gap-2 md:grid-cols-2">
            {dashboard.plan_matrix.map((item) => (
              <li key={item.id} className="rounded-xl border bg-card p-4 text-sm"><p>{item.plan_code} v{item.plan_version} → {item.box_code} v{item.box_version}</p><BoxConfigurationApproval ruleId={item.id} locale={locale}/></li>
            ))}
          </ul>
        )}
      </section>

      <DataList title={m.lots} empty={m.empty}>
        {dashboard.lots.map((item) => (
          <article key={item.id} className="rounded-xl border bg-card p-4 text-sm">
            <p>{item.source_type} · {item.quantity}</p>
            <time dateTime={item.expires_at}>{item.expires_at.slice(0, 10)}</time>
          </article>
        ))}
      </DataList>

      <DataList title={m.redemptions} empty={m.empty}>
        {dashboard.redemptions.map((item) => (
          <article key={item.id} className="rounded-xl border bg-card p-4 text-sm">
            <p>{item.status} · {item.reserved_credits} cr</p>
          </article>
        ))}
      </DataList>

      {dashboard.capabilities.can_write ? <><ManualCreditGrantPanel locale={locale} wallets={dashboard.wallets}/><SubscriptionGrantPanel locale={locale} organizations={[...new Map(dashboard.wallets.map(w=>[w.organization_id,{id:w.organization_id,name:w.organization_name}])).values()]}/></> : null}
      {canWrite ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CommandForm title={m.createBenefit} action={createBenefitAction} extra={{effectiveFrom:dashboard.generated_at}} keyValue={keys.benefit} locale={locale} auditOrganizationId={auditOrganizationId!} m={m}>
            <Field label={m.code}><Input name="code" required className={control} dir="ltr" pattern="[A-Z][A-Z0-9_]{2,79}" /></Field>
            <Select name="benefitType" label={m.type} values={types} />
            <Select name="fulfillmentMode" label={m.fulfillment} values={modes} />
            <Field label={m.nameFr}><Input name="nameFr" required minLength={2} className={control} /></Field>
            <Field label={m.nameAr}><Input name="nameAr" required minLength={2} className={control} /></Field>
            <Field label={m.descriptionFr}><Input name="descriptionFr" required minLength={3} className={control} /></Field>
            <Field label={m.descriptionAr}><Input name="descriptionAr" required minLength={3} className={control} /></Field>
            <Field label={m.creditCost}><Input name="creditCost" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
            <Field label={m.referenceValue}><Input name="referenceValueMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
            <Field label={m.internalCost}><Input name="internalCostMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
            <Field label={m.currency}><Input name="currency" required defaultValue="MAD" maxLength={3} className={control} dir="ltr" /></Field>
            <Field label={m.cancelRule}><Input name="cancellationRuleVersion" required defaultValue="CANCEL_V1" className={control} dir="ltr" /></Field>
          </CommandForm>

          <CommandForm title={m.activateBenefit} action={activateBenefitAction} keyValue={keys.activateBenefit} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={draftBenefits.length === 0}>
            <Select name="benefitVersionId" label={m.benefitVersion} values={draftBenefits.map((item) => item.id)} labels={draftBenefits.map((item) => `${item.code} v${item.version}`)} />
          </CommandForm>

          <CommandForm title={m.createBox} action={createBoxAction} extra={{effectiveFrom:dashboard.generated_at}} keyValue={keys.box} locale={locale} auditOrganizationId={auditOrganizationId!} m={m}>
            <Field label={m.code}><Input name="code" required className={control} dir="ltr" pattern="[A-Z][A-Z0-9_]{2,79}" /></Field>
            <Select name="boxType" label={m.boxType} values={boxTypes} />
            <Field label={m.nameFr}><Input name="nameFr" required minLength={2} className={control} /></Field>
            <Field label={m.nameAr}><Input name="nameAr" required minLength={2} className={control} /></Field>
            <Field label={m.budget}><Input name="creditBudget" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
            <Field label={m.rollover}><Input name="rolloverMonths" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
            <Field label={m.costLow}><Input name="costLowMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
            <Field label={m.costExpected}><Input name="costExpectedMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
            <Field label={m.costFull}><Input name="costFullMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
            <Field label={m.currency}><Input name="currency" required defaultValue="MAD" maxLength={3} className={control} dir="ltr" /></Field>
            <Field label={m.slotCode}><Input name="slotCode" className={control} dir="ltr" pattern="[A-Z][A-Z0-9_]{1,39}" /></Field>
            <Select name="slotKind" label={m.slotKind} values={["MANDATORY", "OPTIONAL"]} />
            <Field label={m.slotMin}><Input name="slotMin" className={control} dir="ltr" defaultValue="0" /></Field>
            <Field label={m.slotMax}><Input name="slotMax" className={control} dir="ltr" defaultValue="1" /></Field>
            <fieldset className="grid gap-2 text-sm">
              <legend>{m.allowedBenefits}</legend>
              {dashboard.benefits.length === 0 ? <p className="text-muted-foreground">{m.empty}</p> : dashboard.benefits.map((item) => (
                <label key={item.id} className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" name="allowedBenefitVersionIds" value={item.id} className="size-4" />
                  <span>{name(item.name_fr, item.name_ar)} <span dir="ltr" className="text-muted-foreground">({item.code} v{item.version})</span></span>
                </label>
              ))}
            </fieldset>
          </CommandForm>

          <CommandForm title={m.activateBox} action={activateBoxAction} keyValue={keys.activateBox} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={draftBoxes.length === 0}>
            <Select name="boxVersionId" label={m.boxVersion} values={draftBoxes.map((item) => item.id)} labels={draftBoxes.map((item) => `${item.code} v${item.version}`)} />
            <Field label={m.approval}><Input name="approvalReference" className={control} /></Field>
          </CommandForm>

          <CommandForm title={m.linkPlan} action={linkPlanBoxAction} extra={{effectiveFrom:dashboard.generated_at}} keyValue={keys.link} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={dashboard.plans.length === 0 || activeBoxes.length === 0}>
            <Select name="planVersionId" label={m.plan} values={dashboard.plans.map((item) => item.id)} labels={dashboard.plans.map((item) => `${item.plan_code} v${item.version}`)} />
            <Select name="boxVersionId" label={m.boxVersion} values={activeBoxes.map((item) => item.id)} labels={activeBoxes.map((item) => `${item.code} v${item.version}`)} />
            <Field label={locale==="ar"?"قاعدة الميزانية للدورة الممولة":"Règle du budget par cycle financé"}><select name="budgetRule" required defaultValue="" className={control}><option value="" disabled>{locale==="ar"?"اختر صراحة":"Choisir explicitement"}</option><option value="AT_MOST">{locale==="ar"?"عدم تجاوز الميزانية":"Ne pas dépasser le budget"}</option><option value="EXACT">{locale==="ar"?"استخدام الميزانية بالضبط":"Utiliser exactement le budget"}</option></select></Field>
          </CommandForm>

          <CommandForm title={m.ensureWallet} action={ensureWalletAction} keyValue={keys.wallet} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} extra={{ organizationId: auditOrganizationId! }}>
            <p className="text-sm text-muted-foreground">{m.organization}: <span dir="ltr">{auditOrganizationId}</span></p>
          </CommandForm>


        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold" dir="ltr">{value}</p></div>;
}

function DataList({ title, empty, children, id }: { title: string; empty: string; children: React.ReactNode; id?: string }) {
  const items = Array.isArray(children) ? children : children == null ? [] : [children];
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {items.length ? <div className="grid gap-3 md:grid-cols-2">{items}</div> : <p className="rounded-xl border bg-card p-4">{empty}</p>}
    </section>
  );
}

function Select({ name, label, values, labels }: { name: string; label: string; values: string[]; labels?: string[] }) {
  return (
    <Field label={label}>
      <select name={name} required className={control}>
        {values.map((value, index) => <option key={value} value={value}>{labels?.[index] ?? value}</option>)}
      </select>
    </Field>
  );
}

function CommandForm({
  title, action, keyValue, locale, auditOrganizationId, m, children, disabled, extra,
}: {
  title: string;
  action: (state: CommerceActionState, form: FormData) => Promise<CommerceActionState>;
  keyValue: string;
  locale: Locale;
  auditOrganizationId: string;
  m: CommerceMessages;
  children: React.ReactNode;
  disabled?: boolean;
  extra?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, commerceIdle);
  return (
    <article className="rounded-xl border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="idempotencyKey" value={keyValue} />
        <input type="hidden" name="auditOrganizationId" value={auditOrganizationId} />
        {extra ? Object.entries(extra).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />) : null}
        {children}
        <Button type="submit" disabled={pending || disabled} className="min-h-11">{pending ? m.processing : m.save}</Button>
        <Feedback state={state} m={m} />
      </form>
    </article>
  );
}
