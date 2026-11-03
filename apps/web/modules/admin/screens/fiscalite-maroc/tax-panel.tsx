"use client";

import { useActionState, useId, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/modules/shared/ui/alert";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import type { MoroccoTaxDashboard } from "@/modules/shared/lib/morocco-tax/model";
import { decideTaxRule, proposeTaxRule, simulateTax, type TaxActionState } from "./actions";
import type { MoroccoTaxMessages } from "./messages";

const initial: TaxActionState = { status: "idle" };
const control = "h-10 w-full rounded-md border bg-background px-3";
const commandId = () => crypto.randomUUID();
function label(values: Record<string, string>, code: string, unknown: string) { return values[code] ?? unknown; }
function exact(value: string, locale: "fr" | "ar") { return BigInt(value).toLocaleString(locale === "ar" ? "ar-MA" : "fr-MA"); }
function integer(value: number, locale: "fr" | "ar") { return new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", { maximumFractionDigits: 0 }).format(value); }
function date(value: string, locale: "fr" | "ar") { return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function categoryName(dashboard: MoroccoTaxDashboard, code: string, locale: "fr" | "ar") { const category = dashboard.categories.find(value => value.code === code); return category ? locale === "ar" ? category.nameAr : category.nameFr : code; }
function Feedback({ state, m }: { state: TaxActionState; m: MoroccoTaxMessages }) { if (state.status === "idle") return null; const message = state.status === "success" ? m.success : ({ VALIDATION: m.invalid, FORBIDDEN: m.forbidden, AAL2_REQUIRED: m.aal2, CONFLICT: m.conflict, UNAUTHENTICATED: m.forbidden, FAILED: m.failed } as const)[state.reason]; return <Alert variant={state.status === "error" ? "destructive" : "default"} role={state.status === "error" ? "alert" : "status"} aria-live="polite"><AlertDescription>{message}</AlertDescription></Alert>; }
function Field({ id, label: text, children }: { id: string; label: string; children: ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{text}</Label>{children}</div>; }

function TaxContextFields({context}:{context:MoroccoTaxDashboard["context"]}) {
  return <><input type="hidden" name="contextKind" value={context.kind}/>{context.kind === "ORGANIZATION" ? <input type="hidden" name="organizationId" value={context.organizationId}/> : null}</>;
}

export function TaxPanel({ dashboard, locale, m, keys }: { dashboard: MoroccoTaxDashboard; locale: "fr" | "ar"; m: MoroccoTaxMessages; keys: Record<string, string> }) {
  const prefix = useId(), [simulation, simulateAction, simPending] = useActionState(simulateTax, initial), [proposal, proposeAction, proposalPending] = useActionState(proposeTaxRule, initial);
  return <div className="space-y-6">
    <Alert><AlertDescription>{m.exact}</AlertDescription></Alert>
    <section className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>{m.simulation}</CardTitle><CardDescription>{m.exact}</CardDescription></CardHeader><CardContent>
        <form action={simulateAction} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="locale" value={locale}/>
          <Field id={`${prefix}-simulation-category`} label={m.category}><select id={`${prefix}-simulation-category`} name="categoryCode" className={control} required>{dashboard.categories.map(value => <option key={value.code} value={value.code}>{locale === "ar" ? value.nameAr : value.nameFr}</option>)}</select></Field>
          <Field id={`${prefix}-simulation-date`} label={m.date}><Input id={`${prefix}-simulation-date`} name="effectiveOn" type="date" required/></Field>
          <Field id={`${prefix}-simulation-net`} label={m.netMinor}><Input id={`${prefix}-simulation-net`} name="netMinor" inputMode="numeric" pattern="-?[0-9]+" required/></Field>
          <Field id={`${prefix}-simulation-source`} label={m.sourceRule}><Input id={`${prefix}-simulation-source`} name="sourceRuleVersionId" dir="ltr"/></Field>
          <Button disabled={simPending} className="sm:col-span-2">{simPending ? m.pending : m.simulate}</Button>
          <div className="sm:col-span-2"><Feedback state={simulation} m={m}/>{simulation.status === "success" && simulation.simulation ? <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg border p-4 text-sm">
            <dt>{m.category}</dt><dd>{categoryName(dashboard, simulation.simulation.categoryCode, locale)}</dd>
            <dt>{m.type}</dt><dd>{label(m.codes.types, simulation.simulation.ruleType, m.codes.unknown)}</dd>
            <dt>{m.rate}</dt><dd><bdi>{integer(simulation.simulation.rateBasisPoints, locale)}</bdi> {m.codes.basisPointsUnit}</dd>
            <dt>{m.netMinor}</dt><dd><bdi>{exact(simulation.simulation.netMinor, locale)}</bdi> {m.codes.minorUnit}</dd>
            <dt>{m.codes.taxAmount}</dt><dd><bdi>{exact(simulation.simulation.taxMinor, locale)}</bdi> {m.codes.minorUnit}</dd>
            <dt>{m.codes.grossAmount}</dt><dd><bdi>{exact(simulation.simulation.grossMinor, locale)}</bdi> {m.codes.minorUnit}</dd>
          </dl> : null}</div>
        </form>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{m.proposal}</CardTitle><CardDescription>{m.subtitle}</CardDescription></CardHeader><CardContent>
        <form action={proposeAction} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="locale" value={locale}/><TaxContextFields context={dashboard.context}/><input type="hidden" name="idempotencyKey" value={keys.proposal ?? commandId()}/>
          <Field id={`${prefix}-proposal-category`} label={m.category}><select id={`${prefix}-proposal-category`} name="categoryCode" className={control} required>{dashboard.categories.map(value => <option key={value.code} value={value.code}>{locale === "ar" ? value.nameAr : value.nameFr}</option>)}</select></Field>
          <Field id={`${prefix}-proposal-type`} label={m.type}><select id={`${prefix}-proposal-type`} name="ruleType" className={control}>{Object.entries(m.codes.types).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field>
          <Field id={`${prefix}-proposal-rate`} label={m.rate}><Input id={`${prefix}-proposal-rate`} name="rateBasisPoints" type="number" min="0" max="10000" required/></Field>
          <Field id={`${prefix}-proposal-priority`} label={m.priority}><Input id={`${prefix}-proposal-priority`} name="priority" type="number" min="1" max="10000" defaultValue="100" required/></Field>
          <Field id={`${prefix}-proposal-from`} label={m.from}><Input id={`${prefix}-proposal-from`} name="effectiveFrom" type="date" required/></Field>
          <Field id={`${prefix}-proposal-to`} label={m.to}><Input id={`${prefix}-proposal-to`} name="effectiveTo" type="date"/></Field>
          <div className="sm:col-span-2"><Field id={`${prefix}-proposal-legal`} label={m.legal}><Input id={`${prefix}-proposal-legal`} name="legalReference" minLength={10} required/></Field></div>
          <div className="sm:col-span-2"><Field id={`${prefix}-proposal-reason`} label={m.reason}><Input id={`${prefix}-proposal-reason`} name="changeReason" minLength={10} required/></Field></div>
          <Button disabled={proposalPending} className="sm:col-span-2">{proposalPending ? m.pending : m.propose}</Button><div className="sm:col-span-2"><Feedback state={proposal} m={m}/></div>
        </form>
      </CardContent></Card>
    </section>
    <section aria-labelledby={`${prefix}-rules`}><h2 id={`${prefix}-rules`} className="mb-3 text-xl font-semibold">{m.rules}</h2>{dashboard.rules.length === 0 ? <p className="text-muted-foreground">{m.noRules}</p> : <div className="grid gap-4 lg:grid-cols-2">{dashboard.rules.map(rule => <RuleCard key={rule.id} rule={rule} dashboard={dashboard} locale={locale} m={m} commandKey={keys[rule.id] ?? commandId()}/>)}</div>}</section>
  </div>;
}

function RuleCard({ rule, dashboard, locale, m, commandKey }: { rule: MoroccoTaxDashboard["rules"][number]; dashboard: MoroccoTaxDashboard; locale: "fr" | "ar"; m: MoroccoTaxMessages; commandKey: string }) {
  const prefix = useId(), [state, action, pending] = useActionState(decideTaxRule, initial);
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{categoryName(dashboard, rule.categoryCode, locale)} · {m.version} {integer(rule.version, locale)}</CardTitle><Badge variant={rule.status === "ACTIVE" ? "default" : "secondary"}>{label(m.codes.statuses, rule.status, m.codes.unknown)}</Badge></div><CardDescription>{label(m.codes.types, rule.ruleType, m.codes.unknown)} · {integer(rule.rateBasisPoints, locale)} {m.codes.basisPointsUnit} · {label(m.codes.validations, rule.validationStatus, m.codes.unknown)}</CardDescription></CardHeader><CardContent className="space-y-4">
    <p className="text-sm">{rule.legalReference}</p><p className="text-sm text-muted-foreground">{m.period}: {date(rule.effectiveFrom, locale)} — {rule.effectiveTo ? date(rule.effectiveTo, locale) : "∞"}</p>
    {rule.status === "DRAFT" || rule.status === "ACTIVE" ? <form action={action} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="locale" value={locale}/><TaxContextFields context={dashboard.context}/><input type="hidden" name="taxRuleVersionId" value={rule.id}/><input type="hidden" name="rowVersion" value={rule.rowVersion}/><input type="hidden" name="idempotencyKey" value={commandKey}/>
      <Field id={`${prefix}-decision`} label={m.decision}><select id={`${prefix}-decision`} name="decision" className={control}>{rule.status === "DRAFT" ? <><option value="APPROVE">{m.approve}</option><option value="REJECT">{m.reject}</option></> : <option value="RETIRE">{m.retire}</option>}</select></Field>
      <Field id={`${prefix}-validation`} label={m.validation}><select id={`${prefix}-validation`} name="professionalValidationStatus" className={control}><option value="DEMO">{m.codes.validations.DEMO}</option><option value="VALIDATED">{m.codes.validations.VALIDATED}</option></select></Field>
      <Field id={`${prefix}-reference`} label={m.validationReference}><Input id={`${prefix}-reference`} name="validationReference" minLength={3} required/></Field>
      <Field id={`${prefix}-reason`} label={m.reason}><Input id={`${prefix}-reason`} name="reason" minLength={10} required/></Field>
      <Button disabled={pending} className="sm:col-span-2">{pending ? m.pending : m.execute}</Button><div className="sm:col-span-2"><Feedback state={state} m={m}/></div>
    </form> : null}
  </CardContent></Card>;
}
