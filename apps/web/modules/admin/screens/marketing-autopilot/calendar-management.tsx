"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatDateTimeCasablanca } from "@/modules/shared/lib/format/display";
import type { MarketingDashboard } from "@/modules/shared/lib/marketing-autopilot/model";
import { activateScheduleRule, approveAssistedCalendar, createScheduleRule, type MarketingActionState } from "./actions";
import type { MarketingMessages } from "./messages";

const idle: MarketingActionState = { status: "idle" };
const control = "min-h-11 w-full rounded-md border bg-background px-3 text-base";

function Feedback({ state, m }: { state: MarketingActionState; m: MarketingMessages }) {
  const message = state.status === "success" ? m.success : state.status === "error" ? state.reason === "VALIDATION" ? m.validation : state.reason === "FORBIDDEN" ? m.forbidden : state.reason === "CONFLICT" ? m.conflict : m.failed : "";
  return <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={`min-h-5 text-sm ${state.status === "error" ? "text-destructive" : "text-primary"}`}>{message}</p>;
}

function Hidden({ locale, keyValue }: { locale: Locale; keyValue: string }) {
  return <><input type="hidden" name="locale" value={locale}/><input type="hidden" name="idempotencyKey" value={keyValue}/></>;
}

function Submit({ pending, label, m }: { pending: boolean; label: string; m: MarketingMessages }) {
  return <Button disabled={pending} className="min-h-11 w-full sm:w-auto">{pending ? m.pending : label}</Button>;
}

function formatDate(value: string, locale: Locale, withTime = false) {
  if (withTime) return formatDateTimeCasablanca(value, locale);
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export function CalendarManagement({ dashboard, locale, m, keys }: { dashboard: MarketingDashboard; locale: Locale; m: MarketingMessages; keys: Record<string, string> }) {
  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-2">
      <ScheduleRuleForm dashboard={dashboard} locale={locale} m={m} keyValue={keys.scheduleRule}/>
      <ScheduleRuleList dashboard={dashboard} locale={locale} m={m} keys={keys}/>
    </div>
    <CalendarList dashboard={dashboard} locale={locale} m={m} keys={keys}/>
  </div>;
}

function ScheduleRuleForm({ dashboard, locale, m, keyValue }: { dashboard: MarketingDashboard; locale: Locale; m: MarketingMessages; keyValue: string }) {
  const root = useId();
  const accounts = dashboard.socialAccounts.filter((account) => account.status === "ACTIVE");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const account = accounts.find((value) => value.id === accountId);
  const [state, action, pending] = useActionState(createScheduleRule, idle);
  return <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6" aria-labelledby={`${root}-title`}>
    <h2 id={`${root}-title`} className="text-xl font-semibold">{m.scheduleRuleCreate}</h2>
    {!accounts.length ? <p className="mt-3 text-muted-foreground">{m.noSocialAccount}</p> : <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <Hidden locale={locale} keyValue={keyValue}/><input type="hidden" name="organizationId" value={account?.organizationId ?? ""}/>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${root}-account`}>{m.socialAccount}</Label><select id={`${root}-account`} name="socialAccountId" value={accountId} onChange={(event) => setAccountId(event.target.value)} className={control} required>{accounts.map((value) => <option key={value.id} value={value.id}>{value.displayName} · {m.codes.providers[value.provider]}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor={`${root}-timezone`}>{m.timezone}</Label><Input id={`${root}-timezone`} name="timezone" defaultValue="Africa/Casablanca" maxLength={100} required className={control} dir="ltr"/></div>
      <div className="space-y-2"><Label htmlFor={`${root}-generation`}>{m.generationDay}</Label><Input id={`${root}-generation`} name="generationDay" type="number" min={1} max={28} defaultValue={25} required className={control}/></div>
      <div className="space-y-2"><Label htmlFor={`${root}-posts`}>{m.postsPerMonth}</Label><Input id={`${root}-posts`} name="postsPerMonth" type="number" min={0} max={100} defaultValue={8} required className={control}/></div>
      <div className="space-y-2"><Label htmlFor={`${root}-reels`}>{m.reelsPerMonth}</Label><Input id={`${root}-reels`} name="reelsPerMonth" type="number" min={0} max={100} defaultValue={4} required className={control}/></div>
      <div className="space-y-2"><Label htmlFor={`${root}-repeat`}>{m.maxServiceRepetition}</Label><Input id={`${root}-repeat`} name="maxServiceRepetition" type="number" min={1} max={20} defaultValue={2} required className={control}/></div>
      <div className="space-y-2"><Label htmlFor={`${root}-privacy`}>{m.privacyMinimumAggregate}</Label><Input id={`${root}-privacy`} name="privacyMinimumAggregate" type="number" min={3} max={1000} defaultValue={10} required className={control}/></div>
      <fieldset className="grid gap-3 rounded-xl border p-3 sm:col-span-2 sm:grid-cols-2"><legend className="px-1 font-medium">{m.allowedSlots}</legend><div className="space-y-2"><Label htmlFor={`${root}-slot-day-1`}>{m.slotDay}</Label><Input id={`${root}-slot-day-1`} name="slotDay1" type="number" min={1} max={31} defaultValue={5} required className={control}/></div><div className="space-y-2"><Label htmlFor={`${root}-slot-time-1`}>{m.slotTime}</Label><Input id={`${root}-slot-time-1`} name="slotTime1" type="time" defaultValue="09:00" required className={control}/></div><div className="space-y-2"><Label htmlFor={`${root}-slot-day-2`}>{m.slotDayOptional}</Label><Input id={`${root}-slot-day-2`} name="slotDay2" type="number" min={1} max={31} defaultValue={15} className={control}/></div><div className="space-y-2"><Label htmlFor={`${root}-slot-time-2`}>{m.slotTimeOptional}</Label><Input id={`${root}-slot-time-2`} name="slotTime2" type="time" defaultValue="14:00" className={control}/></div><p className="text-sm text-muted-foreground sm:col-span-2">{m.allowedSlotsHelp}</p></fieldset>
      <div className="sm:col-span-2"><Submit pending={pending} label={m.createVersion} m={m}/><Feedback state={state} m={m}/></div>
    </form>}
  </section>;
}

function ScheduleRuleList({ dashboard, locale, m, keys }: { dashboard: MarketingDashboard; locale: Locale; m: MarketingMessages; keys: Record<string, string> }) {
  return <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6"><h2 className="text-xl font-semibold">{m.scheduleRules}</h2><div className="mt-4 space-y-3">{dashboard.scheduleRules.map((rule) => <ScheduleRule key={rule.id} rule={rule} dashboard={dashboard} locale={locale} m={m} keyValue={keys[`activateRule:${rule.id}`]}/>) }{!dashboard.scheduleRules.length ? <p className="text-muted-foreground">{m.noScheduleRule}</p> : null}</div></section>;
}

function ScheduleRule({ rule, dashboard, locale, m, keyValue }: { rule: MarketingDashboard["scheduleRules"][number]; dashboard: MarketingDashboard; locale: Locale; m: MarketingMessages; keyValue: string }) {
  const [state, action, pending] = useActionState(activateScheduleRule, idle);
  const account = dashboard.socialAccounts.find((value) => value.id === rule.socialAccountId);
  return <article className="rounded-xl border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{account?.displayName ?? m.unknownAccount} · v{rule.version}</h3><p className="mt-1 text-sm text-muted-foreground" dir="auto">{rule.timezone} · {rule.postsPerMonth} {m.postsShort} · {rule.reelsPerMonth} {m.reelsShort}</p></div><span className="rounded-full border px-3 py-1 text-sm">{rule.effective ? m.effective : m.inactiveVersion}</span></div>{!rule.effective ? <form action={action} className="mt-3"><Hidden locale={locale} keyValue={keyValue}/><input type="hidden" name="ruleId" value={rule.id}/><input type="hidden" name="headRowVersion" value={rule.headRowVersion}/><Submit pending={pending} label={m.activateVersion} m={m}/><Feedback state={state} m={m}/></form> : null}</article>;
}

function CalendarList({ dashboard, locale, m, keys }: { dashboard: MarketingDashboard; locale: Locale; m: MarketingMessages; keys: Record<string, string> }) {
  return <section id="calendrier" aria-labelledby="marketing-calendars-title" className="scroll-mt-24"><h2 id="marketing-calendars-title" className="text-2xl font-semibold">{m.calendars}</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{dashboard.calendars.map((calendar) => <CalendarCard key={calendar.id} calendar={calendar} dashboard={dashboard} locale={locale} m={m} keyValue={keys[`approveCalendar:${calendar.id}`]}/>) }{!dashboard.calendars.length ? <p className="text-muted-foreground">{m.noCalendar}</p> : null}</div></section>;
}

function CalendarCard({ calendar, dashboard, locale, m, keyValue }: { calendar: MarketingDashboard["calendars"][number]; dashboard: MarketingDashboard; locale: Locale; m: MarketingMessages; keyValue: string }) {
  const [state, action, pending] = useActionState(approveAssistedCalendar, idle);
  const rule = dashboard.scheduleRules.find((value) => value.id === calendar.scheduleRuleId);
  const account = dashboard.socialAccounts.find((value) => value.id === rule?.socialAccountId);
  const items = dashboard.calendar.filter((value) => value.calendarId === calendar.id);
  const campaignIds = new Set(items.map((value) => value.campaignId));
  const exceptions = dashboard.exceptions.filter((value) => value.organizationId === calendar.organizationId && (campaignIds.size === 0 || campaignIds.has(value.campaignId)));
  const approvable = calendar.status === "GENERATED" || calendar.status === "VALIDATED_BY_RULES";
  return <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-semibold">{formatDate(calendar.monthStart, locale)}</h3><p className="mt-1 text-sm text-muted-foreground">{account?.displayName ?? m.unknownAccount}</p></div><span className="rounded-full border px-3 py-1 text-sm">{m.codes.statuses[calendar.status] ?? m.codes.unknown}</span></div>
    <h4 className="mt-4 font-semibold">{m.calendarItems}</h4><ul className="mt-2 space-y-2">{items.map((item) => <li key={item.id} className="rounded-lg bg-muted/60 p-3 text-sm"><span>{formatDate(item.scheduledAt, locale, true)}</span><span className="ms-2">· {m.codes.statuses[item.status] ?? m.codes.unknown}</span></li>)}{!items.length ? <li className="text-sm text-muted-foreground">{m.noCalendarItem}</li> : null}</ul>
    <h4 className="mt-4 font-semibold">{m.exceptions}</h4><ul className="mt-2 space-y-2">{exceptions.map((exception) => <li key={exception.id} className={`rounded-lg border p-3 text-sm ${exception.severity === "BLOCKING" ? "border-destructive/50" : ""}`}><strong>{exception.severity === "BLOCKING" ? m.blocking : m.warning}</strong><p className="mt-1" dir="auto">{exception.reason}</p></li>)}{!exceptions.length ? <li className="text-sm text-muted-foreground">{m.noException}</li> : null}</ul>
    {approvable ? <form action={action} className="mt-4"><Hidden locale={locale} keyValue={keyValue}/><input type="hidden" name="calendarId" value={calendar.id}/><input type="hidden" name="rowVersion" value={calendar.rowVersion}/><Submit pending={pending} label={m.approveAssistedCalendar} m={m}/><p className="mt-2 text-sm text-muted-foreground">{m.approveAssistedHelp}</p><Feedback state={state} m={m}/></form> : null}
  </article>;
}
