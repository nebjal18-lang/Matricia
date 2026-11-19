"use client";

import { useActionState, useId, useState, type FormEvent, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/modules/shared/ui/alert";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { formatMinorAmount } from "@/modules/shared/lib/format/display";
import type { MoroccoTaxDashboard } from "@/modules/shared/lib/morocco-tax/model";
import { decideTaxRule, proposeTaxRule, simulateTax, type TaxActionState } from "./actions";
import type { MoroccoTaxMessages } from "./messages";

const initial: TaxActionState = { status: "idle" };
const control = "h-10 w-full rounded-md border bg-background px-3";
const commandId = () => crypto.randomUUID();

function label(values: Record<string, string>, code: string, unknown: string) {
  return values[code] ?? unknown;
}
function formatPercent(bps: number, locale: "fr" | "ar") {
  const whole = Math.trunc(bps / 100);
  const frac = bps % 100;
  if (frac === 0) return `${whole}\u00a0%`;
  const decimals = String(frac).padStart(2, "0");
  return locale === "ar" ? `${whole}.${decimals}\u00a0%` : `${whole},${decimals}\u00a0%`;
}
function percentInputDefault(bps: number) {
  const whole = Math.trunc(bps / 100);
  const frac = bps % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0")}`;
}
/** Exact percent → basis points (no float money path). */
function percentToBasisPoints(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const bps = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
  return bps >= 0 && bps <= 10_000 ? bps : null;
}
/** MAD → minor units as integer string. */
function madToMinor(raw: string): string | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  const minor = Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0") || "0");
  return String(sign * minor);
}
function formatDate(value: string, locale: "fr" | "ar") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
function categoryName(dashboard: MoroccoTaxDashboard, code: string, locale: "fr" | "ar") {
  const category = dashboard.categories.find((value) => value.code === code);
  return category ? (locale === "ar" ? category.nameAr : category.nameFr) : code;
}
function Feedback({ state, m }: { state: TaxActionState; m: MoroccoTaxMessages }) {
  if (state.status === "idle") return null;
  const message =
    state.status === "success"
      ? m.success
      : ({ VALIDATION: m.invalid, FORBIDDEN: m.forbidden, AAL2_REQUIRED: m.aal2, CONFLICT: m.conflict, UNAUTHENTICATED: m.forbidden, FAILED: m.failed } as const)[state.reason];
  return (
    <Alert variant={state.status === "error" ? "destructive" : "default"} role={state.status === "error" ? "alert" : "status"} aria-live="polite">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
function Field({ id, label: text, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{text}</Label>
      {children}
    </div>
  );
}
function TaxContextFields({ context }: { context: MoroccoTaxDashboard["context"] }) {
  return (
    <>
      <input type="hidden" name="contextKind" value={context.kind} />
      {context.kind === "ORGANIZATION" ? <input type="hidden" name="organizationId" value={context.organizationId} /> : null}
    </>
  );
}
function PercentField({ id, label: text, defaultBps, name = "rateBasisPoints" }: { id: string; label: string; defaultBps: number; name?: string }) {
  const [bps, setBps] = useState(defaultBps);
  return (
    <Field id={id} label={text}>
      <Input
        id={id}
        inputMode="decimal"
        defaultValue={percentInputDefault(defaultBps)}
        required
        onChange={(event) => {
          const next = percentToBasisPoints(event.target.value);
          if (next !== null) setBps(next);
        }}
        onBlur={(event) => {
          const next = percentToBasisPoints(event.target.value);
          if (next === null) event.target.setCustomValidity("0–100");
          else {
            event.target.setCustomValidity("");
            setBps(next);
          }
        }}
      />
      <input type="hidden" name={name} value={bps} />
    </Field>
  );
}

export function TaxPanel({ dashboard, locale, m, keys }: { dashboard: MoroccoTaxDashboard; locale: "fr" | "ar"; m: MoroccoTaxMessages; keys: Record<string, string> }) {
  const prefix = useId();
  const [changeFor, setChangeFor] = useState<string | null>(null);
  const drafts = dashboard.rules.filter((rule) => rule.status === "DRAFT");
  const active = dashboard.rules.filter((rule) => rule.status === "ACTIVE");
  const retired = dashboard.rules.filter((rule) => rule.status === "RETIRED");
  // Si la base n’a plus d’ACTIVE (ex. démo retirée), on montre quand même le dernier taux connu pour pouvoir le changer.
  const activeCategories = new Set(active.map((rule) => rule.categoryCode));
  const fallbackRetired = retired.filter((rule) => !activeCategories.has(rule.categoryCode));
  const listed = [...active, ...(active.length === 0 ? retired : fallbackRetired)];
  const archived = active.length === 0 ? [] : retired.filter((rule) => activeCategories.has(rule.categoryCode));

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">{m.demoNote}</p>

      <section className="space-y-3" aria-labelledby={`${prefix}-active`}>
        <h2 id={`${prefix}-active`} className="text-xl font-semibold">
          {m.rules}
        </h2>
        {listed.length === 0 ? (
          <p className="text-muted-foreground">{m.noRules}</p>
        ) : (
          <ul className="space-y-3">
            {listed.map((rule) => (
              <li key={rule.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {categoryName(dashboard, rule.categoryCode, locale)} · {label(m.codes.types, rule.ruleType, m.codes.unknown)}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      <bdi>{formatPercent(rule.rateBasisPoints, locale)}</bdi>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <Badge variant={rule.status === "ACTIVE" ? "default" : "secondary"}>{label(m.codes.statuses, rule.status, m.codes.unknown)}</Badge>
                      {" · "}
                      {m.period} {formatDate(rule.effectiveFrom, locale)}
                      {rule.effectiveTo ? ` → ${formatDate(rule.effectiveTo, locale)}` : ""} · {m.version}
                      {rule.version} · {label(m.codes.validations, rule.validationStatus, m.codes.unknown)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => setChangeFor(changeFor === rule.id ? null : rule.id)}>
                      {changeFor === rule.id ? m.cancelChange : m.change}
                    </Button>
                  </div>
                </div>
                {changeFor === rule.id ? (
                  <ChangeForm rule={rule} dashboard={dashboard} locale={locale} m={m} onDone={() => setChangeFor(null)} />
                ) : null}
                {rule.status === "ACTIVE" ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-muted-foreground">{m.retire}</summary>
                    <DecisionForm rule={rule} dashboard={dashboard} locale={locale} m={m} commandKey={keys[rule.id] ?? commandId()} mode="retire" />
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="client-card p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">{m.drafts}</summary>
      <section className="mt-4 space-y-3" aria-labelledby={`${prefix}-drafts`}>
        <h2 id={`${prefix}-drafts`} className="sr-only">
          {m.drafts}
        </h2>
        {drafts.length === 0 ? (
          <p className="text-muted-foreground">{m.noDrafts}</p>
        ) : (
          <ul className="space-y-3">
            {drafts.map((rule) => (
              <li key={rule.id} className="rounded-lg border border-dashed p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {categoryName(dashboard, rule.categoryCode, locale)} · {label(m.codes.types, rule.ruleType, m.codes.unknown)}
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      <bdi>{formatPercent(rule.rateBasisPoints, locale)}</bdi>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {m.from} {formatDate(rule.effectiveFrom, locale)} · <Badge variant="secondary">{label(m.codes.statuses, rule.status, m.codes.unknown)}</Badge>
                    </p>
                  </div>
                </div>
                <DecisionForm rule={rule} dashboard={dashboard} locale={locale} m={m} commandKey={keys[rule.id] ?? commandId()} mode="draft" />
              </li>
            ))}
          </ul>
        )}
      </section>
      </details>

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">{m.newRule}</summary>
        <p className="mt-2 text-sm text-muted-foreground">{m.newRuleHint}</p>
        <NewRuleForm dashboard={dashboard} locale={locale} m={m} commandKey={keys.proposal ?? commandId()} />
      </details>

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer font-medium">{m.simulation}</summary>
        <p className="mt-2 text-sm text-muted-foreground">{m.simulationHint}</p>
        <SimulationForm dashboard={dashboard} locale={locale} m={m} />
      </details>

      {archived.length > 0 ? (
        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer font-medium">
            {m.retired} ({archived.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {archived.map((rule) => (
              <li key={rule.id}>
                {categoryName(dashboard, rule.categoryCode, locale)} · {label(m.codes.types, rule.ruleType, m.codes.unknown)} · <bdi>{formatPercent(rule.rateBasisPoints, locale)}</bdi> · {formatDate(rule.effectiveFrom, locale)}
                {rule.effectiveTo ? ` → ${formatDate(rule.effectiveTo, locale)}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ChangeForm({
  rule,
  dashboard,
  locale,
  m,
  onDone,
}: {
  rule: MoroccoTaxDashboard["rules"][number];
  dashboard: MoroccoTaxDashboard;
  locale: "fr" | "ar";
  m: MoroccoTaxMessages;
  onDone: () => void;
}) {
  const prefix = useId();
  const [idempotencyKey] = useState(() => commandId());
  const [state, action, pending] = useActionState(async (prev: TaxActionState, form: FormData) => {
    const result = await proposeTaxRule(prev, form);
    if (result.status === "success") onDone();
    return result;
  }, initial);
  return (
    <form action={action} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      <TaxContextFields context={dashboard.context} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="categoryCode" value={rule.categoryCode} />
      <input type="hidden" name="ruleType" value={rule.ruleType} />
      <input type="hidden" name="priority" value="100" />
      <p className="sm:col-span-2 text-sm text-muted-foreground">
        {m.currentRate}: <bdi>{formatPercent(rule.rateBasisPoints, locale)}</bdi>
      </p>
      <PercentField id={`${prefix}-rate`} label={m.newRate} defaultBps={rule.rateBasisPoints} />
      <Field id={`${prefix}-from`} label={m.from}>
        <Input id={`${prefix}-from`} name="effectiveFrom" type="date" required />
      </Field>
      <div className="sm:col-span-2">
        <Field id={`${prefix}-legal`} label={m.legal}>
          <Input id={`${prefix}-legal`} name="legalReference" minLength={10} defaultValue={rule.legalReference} required />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id={`${prefix}-reason`} label={m.reason}>
          <Input id={`${prefix}-reason`} name="changeReason" minLength={10} required />
        </Field>
      </div>
      <Button disabled={pending} className="sm:col-span-2">
        {pending ? m.pending : m.proposeChange}
      </Button>
      <div className="sm:col-span-2">
        <Feedback state={state} m={m} />
      </div>
    </form>
  );
}

function DecisionForm({
  rule,
  dashboard,
  locale,
  m,
  commandKey,
  mode,
}: {
  rule: MoroccoTaxDashboard["rules"][number];
  dashboard: MoroccoTaxDashboard;
  locale: "fr" | "ar";
  m: MoroccoTaxMessages;
  commandKey: string;
  mode: "draft" | "retire";
}) {
  const prefix = useId();
  const [state, action, pending] = useActionState(decideTaxRule, initial);
  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      <TaxContextFields context={dashboard.context} />
      <input type="hidden" name="taxRuleVersionId" value={rule.id} />
      <input type="hidden" name="rowVersion" value={rule.rowVersion} />
      <input type="hidden" name="idempotencyKey" value={commandKey} />
      {mode === "retire" ? (
        <input type="hidden" name="decision" value="RETIRE" />
      ) : (
        <Field id={`${prefix}-decision`} label={m.decision}>
          <select id={`${prefix}-decision`} name="decision" className={control}>
            <option value="APPROVE">{m.approve}</option>
            <option value="REJECT">{m.reject}</option>
          </select>
        </Field>
      )}
      <Field id={`${prefix}-validation`} label={m.validation}>
        <select id={`${prefix}-validation`} name="professionalValidationStatus" className={control} defaultValue={rule.validationStatus === "VALIDATED" ? "VALIDATED" : "DEMO"}>
          <option value="DEMO">{m.codes.validations.DEMO}</option>
          <option value="VALIDATED">{m.codes.validations.VALIDATED}</option>
        </select>
      </Field>
      <Field id={`${prefix}-reference`} label={m.validationReference}>
        <Input id={`${prefix}-reference`} name="validationReference" minLength={3} defaultValue="REVUE-ADMIN" required />
      </Field>
      <Field id={`${prefix}-reason`} label={m.reason}>
        <Input id={`${prefix}-reason`} name="reason" minLength={10} required />
      </Field>
      <Button disabled={pending} className="sm:col-span-2">
        {pending ? m.pending : mode === "retire" ? m.retire : m.execute}
      </Button>
      <div className="sm:col-span-2">
        <Feedback state={state} m={m} />
      </div>
    </form>
  );
}

function NewRuleForm({ dashboard, locale, m, commandKey }: { dashboard: MoroccoTaxDashboard; locale: "fr" | "ar"; m: MoroccoTaxMessages; commandKey: string }) {
  const prefix = useId();
  const [state, action, pending] = useActionState(proposeTaxRule, initial);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      <TaxContextFields context={dashboard.context} />
      <input type="hidden" name="idempotencyKey" value={commandKey} />
      <Field id={`${prefix}-category`} label={m.category}>
        <select id={`${prefix}-category`} name="categoryCode" className={control} required>
          {dashboard.categories.map((value) => (
            <option key={value.code} value={value.code}>
              {locale === "ar" ? value.nameAr : value.nameFr}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${prefix}-type`} label={m.type}>
        <select id={`${prefix}-type`} name="ruleType" className={control}>
          {Object.entries(m.codes.types).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </Field>
      <PercentField id={`${prefix}-rate`} label={m.newRate} defaultBps={2000} />
      <Field id={`${prefix}-priority`} label={m.priority}>
        <Input id={`${prefix}-priority`} name="priority" type="number" min="1" max="10000" defaultValue="100" required />
      </Field>
      <Field id={`${prefix}-from`} label={m.from}>
        <Input id={`${prefix}-from`} name="effectiveFrom" type="date" required />
      </Field>
      <Field id={`${prefix}-to`} label={m.to}>
        <Input id={`${prefix}-to`} name="effectiveTo" type="date" />
      </Field>
      <div className="sm:col-span-2">
        <Field id={`${prefix}-legal`} label={m.legal}>
          <Input id={`${prefix}-legal`} name="legalReference" minLength={10} required />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field id={`${prefix}-reason`} label={m.reason}>
          <Input id={`${prefix}-reason`} name="changeReason" minLength={10} required />
        </Field>
      </div>
      <Button disabled={pending} className="sm:col-span-2">
        {pending ? m.pending : m.propose}
      </Button>
      <div className="sm:col-span-2">
        <Feedback state={state} m={m} />
      </div>
    </form>
  );
}

function SimulationForm({ dashboard, locale, m }: { dashboard: MoroccoTaxDashboard; locale: "fr" | "ar"; m: MoroccoTaxMessages }) {
  const prefix = useId();
  const [state, action, pending] = useActionState(simulateTax, initial);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const mad = (form.elements.namedItem("netMad") as HTMLInputElement).value;
    const minor = madToMinor(mad);
    if (minor === null) {
      event.preventDefault();
      (form.elements.namedItem("netMad") as HTMLInputElement).setCustomValidity("MAD");
      (form.elements.namedItem("netMad") as HTMLInputElement).reportValidity();
      return;
    }
    (form.elements.namedItem("netMad") as HTMLInputElement).setCustomValidity("");
    (form.elements.namedItem("netMinor") as HTMLInputElement).value = minor;
  }
  return (
    <form action={action} onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="netMinor" value="0" />
      <Field id={`${prefix}-category`} label={m.category}>
        <select id={`${prefix}-category`} name="categoryCode" className={control} required>
          {dashboard.categories.map((value) => (
            <option key={value.code} value={value.code}>
              {locale === "ar" ? value.nameAr : value.nameFr}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${prefix}-date`} label={m.date}>
        <Input id={`${prefix}-date`} name="effectiveOn" type="date" required />
      </Field>
      <Field id={`${prefix}-net`} label={m.netMad}>
        <Input id={`${prefix}-net`} name="netMad" inputMode="decimal" required />
      </Field>
      <Field id={`${prefix}-source`} label={m.sourceRule}>
        <Input id={`${prefix}-source`} name="sourceRuleVersionId" dir="ltr" />
      </Field>
      <Button disabled={pending} className="sm:col-span-2">
        {pending ? m.pending : m.simulate}
      </Button>
      <div className="sm:col-span-2">
        <Feedback state={state} m={m} />
        {state.status === "success" && state.simulation ? (
          <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg border p-4 text-sm">
            <dt>{m.category}</dt>
            <dd>{categoryName(dashboard, state.simulation.categoryCode, locale)}</dd>
            <dt>{m.type}</dt>
            <dd>{label(m.codes.types, state.simulation.ruleType, m.codes.unknown)}</dd>
            <dt>{m.rate}</dt>
            <dd>
              <bdi>{formatPercent(state.simulation.rateBasisPoints, locale)}</bdi>
            </dd>
            <dt>{m.netMad}</dt>
            <dd>
              <bdi>{formatMinorAmount(state.simulation.netMinor, "MAD", locale)}</bdi>
            </dd>
            <dt>{m.taxAmount}</dt>
            <dd>
              <bdi>{formatMinorAmount(state.simulation.taxMinor, "MAD", locale)}</bdi>
            </dd>
            <dt>{m.grossAmount}</dt>
            <dd>
              <bdi>{formatMinorAmount(state.simulation.grossMinor, "MAD", locale)}</bdi>
            </dd>
          </dl>
        ) : null}
      </div>
    </form>
  );
}
