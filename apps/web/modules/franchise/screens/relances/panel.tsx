"use client";
import { useActionState, useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import type { FollowupDashboard } from "@/modules/franchise/data/followups/model";
import { FOLLOWUP_STAGES } from "@/modules/franchise/data/followups/model";
import { isDirectoryFixture, personDisplayLabel } from "@/modules/shared/lib/directory-presentation";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { workflowStatusLabel } from "@/modules/shared/lib/i18n/workflow-statuses";
import { formatDateTimeCasablanca } from "@/modules/shared/lib/format/display";
import { franchiseStageLabel } from "@/modules/franchise/data/spaces/labels";
import { configurePreference, decidePolicy, proposePolicy, type FollowupActionState } from "./actions";
import type { FollowupMessages } from "./messages";

const idle: FollowupActionState = { status: "idle" };

function stableStamp(value: string, locale: Locale) {
  return formatDateTimeCasablanca(value, locale);
}

function Feedback({ s, m }: { s: FollowupActionState; m: FollowupMessages }) {
  return s.status === "idle" ? null : (
    <p aria-live="polite" className={s.status === "success" ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
      {s.status === "success" ? m.success : m.error}
    </p>
  );
}

export function FollowupPanel({
  dashboard: d,
  locale,
  m,
  keys,
}: {
  dashboard: FollowupDashboard;
  locale: Locale;
  m: FollowupMessages;
  keys: { propose: Record<string, string>; preference: Record<string, string>; decision: Record<string, string> };
}) {
  const [state, act, pending] = useActionState(proposePolicy, idle);
  const prefix = useId();
  return (
    <div className="space-y-8">
      <AlertBox text={m.noSanction} />
      <section>
        <h2 className="text-2xl font-semibold">{m.policy}</h2>
        {d.franchises.filter((f) => f.canWrite).map((f) => (
          <form action={act} key={f.id} className="mt-4 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
            <input type="hidden" name="uiLocale" value={locale} />
            <input type="hidden" name="franchiseId" value={f.id} />
            <input type="hidden" name="idempotencyKey" value={keys.propose[f.id]} />
            <p className="font-semibold sm:col-span-2" dir="ltr">{f.operatorCode}</p>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 font-medium">{m.stages}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {FOLLOWUP_STAGES.map((s) => (
                  <label key={s} className="flex min-h-11 items-center gap-2">
                    <input type="checkbox" name="eligibleStages" value={s} defaultChecked={s !== "RFQ_STARTED"} />
                    <span>{franchiseStageLabel(s, locale)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Field id={`${prefix}-delays-${f.id}`} name="reminderDelaysMinutes" label={m.delays} defaultValue="0,1440,4320" />
            <Field id={`${prefix}-retries-${f.id}`} name="retryDelaysMinutes" label={m.retries} defaultValue="15,60,240" />
            <Field id={`${prefix}-attempts-${f.id}`} name="maximumAttempts" label={m.attempts} type="number" defaultValue="4" />
            <Field id={`${prefix}-weekly-${f.id}`} name="maximumRemindersPer7Days" label={m.weekly} type="number" defaultValue="3" />
            <Field id={`${prefix}-lease-${f.id}`} name="leaseSeconds" label={m.lease} type="number" defaultValue="120" />
            <Field id={`${prefix}-from-${f.id}`} name="effectiveFrom" label={m.effectiveFrom} type="datetime-local" />
            <Field id={`${prefix}-until-${f.id}`} name="effectiveUntil" label={m.effectiveUntil} type="datetime-local" required={false} />
            <Field id={`${prefix}-reason-${f.id}`} name="changeReason" label={m.reason} />
            <Button className="w-full sm:w-auto" disabled={pending}>{pending ? m.pending : m.propose}</Button>
            <Feedback s={state} m={m} />
          </form>
        ))}
      </section>
      <section>
        <h2 className="text-2xl font-semibold">{m.prospects}</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {d.prospects.filter((p) => !isDirectoryFixture({ displayName: p.displayName })).map((p) => <Preference key={p.id} p={p} locale={locale} m={m} keyValue={keys.preference[p.id]} />)}
        </div>
      </section>
      <section>
        <h2 className="text-2xl font-semibold">{m.jobs}</h2>
        <div className="mt-4 space-y-2">
          {d.jobs.map((j) => (
            <div key={j.id} className="grid gap-2 rounded-xl border bg-card p-3 text-sm sm:grid-cols-3">
              <span>{m.status}: {m.jobStatusLabels[j.status] ?? workflowStatusLabel(j.status, locale)} · #{j.reminderOrdinal}</span>
              <span>{j.attemptCount} {locale === "ar" ? "محاولات" : "tentatives"}</span>
              <time dateTime={j.nextAttemptAt}>{m.next}: {stableStamp(j.nextAttemptAt, locale)}</time>
            </div>
          ))}
        </div>
      </section>
      {d.canApprove ? (
        <section>
          <h2 className="text-2xl font-semibold">{m.policy}</h2>
          {d.policies.filter((p) => p.status === "PENDING_APPROVAL" && p.proposedBy !== d.currentUserId).map((p) => (
            <Decision key={p.id} id={p.id} locale={locale} m={m} keyValue={keys.decision[p.id]} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  defaultValue,
  required = true,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  );
}

function Preference({
  p,
  locale,
  m,
  keyValue,
}: {
  p: FollowupDashboard["prospects"][number];
  locale: Locale;
  m: FollowupMessages;
  keyValue: string;
}) {
  const [s, a, b] = useActionState(configurePreference, idle);
  const id = useId();
  return (
    <form action={a} className="rounded-2xl border bg-card p-4">
      <input type="hidden" name="uiLocale" value={locale} />
      <input type="hidden" name="prospectId" value={p.id} />
      <input type="hidden" name="idempotencyKey" value={keyValue} />
      <h3 className="font-semibold">{personDisplayLabel({ displayName: p.displayName }, locale)}</h3>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="contactAllowed" defaultChecked={p.preference?.contactAllowed ?? false} />
        {m.contactAllowed}
      </label>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="emailAllowed" defaultChecked={p.preference?.emailAllowed ?? false} />
        {m.emailAllowed}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${id}-tz`} name="timeZone" label={m.timeZone} defaultValue={p.preference?.timeZone ?? "Africa/Casablanca"} />
        <Field id={`${id}-limit`} name="maximumRemindersPer7Days" label={m.weekly} type="number" defaultValue={String(p.preference?.weeklyLimit ?? 3)} />
        <Field id={`${id}-start`} name="quietHoursStart" label={m.quietStart} type="time" defaultValue={p.preference?.quietStart?.slice(0, 5) ?? "20:00"} />
        <Field id={`${id}-end`} name="quietHoursEnd" label={m.quietEnd} type="time" defaultValue={p.preference?.quietEnd?.slice(0, 5) ?? "08:00"} />
        <label>
          {m.locale}
          <select name="notificationLocale" defaultValue={p.preference?.locale ?? locale} className="mt-1 min-h-11 w-full rounded-md border bg-background px-3">
            <option value="fr">FR</option>
            <option value="ar">AR</option>
          </select>
        </label>
        <Field id={`${id}-reason`} name="changeReason" label={m.reason} />
      </div>
      <Button className="mt-3 w-full sm:w-auto" disabled={b}>{b ? m.pending : m.save}</Button>
      <Feedback s={s} m={m} />
    </form>
  );
}

function Decision({
  id,
  locale,
  m,
  keyValue,
}: {
  id: string;
  locale: Locale;
  m: FollowupMessages;
  keyValue: string;
}) {
  const [s, a, b] = useActionState(decidePolicy, idle);
  const x = useId();
  return (
    <form action={a} className="mt-3 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto_auto]">
      <input type="hidden" name="uiLocale" value={locale} />
      <input type="hidden" name="policyVersionId" value={id} />
      <input type="hidden" name="idempotencyKey" value={keyValue} />
      <Field id={x} name="reason" label={m.reason} />
      <Button name="decision" value="APPROVE" disabled={b}>{m.approve}</Button>
      <Button name="decision" value="REJECT" variant="destructive" disabled={b}>{m.reject}</Button>
      <Feedback s={s} m={m} />
    </form>
  );
}

function AlertBox({ text }: { text: string }) {
  return <p className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">{text}</p>;
}
