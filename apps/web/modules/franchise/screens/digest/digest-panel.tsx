"use client";

import { useActionState, useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { formatBasisPoints, type FranchiseDigestDashboard } from "@/modules/franchise/data/digest/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { configureDigest, type FranchiseDigestActionState } from "./actions";
import type { FranchiseDigestMessages } from "./messages";

const idle: FranchiseDigestActionState = { status: "idle" };
const control = "min-h-11 w-full rounded-md border bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
function dateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}
const number = (value: number, locale: Locale) => new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", { numberingSystem: "latn" }).format(value);

function Feedback({ state, m }: { state: FranchiseDigestActionState; m: FranchiseDigestMessages }) { const message = state.status === "success" ? m.saved : state.status === "error" ? state.reason === "VALIDATION" ? m.validation : state.reason === "FORBIDDEN" || state.reason === "UNAUTHENTICATED" ? m.forbidden : state.reason === "CONFLICT" ? m.conflict : m.failed : ""; return <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-primary"}>{message}</p>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-background/70 p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold" dir="auto">{value}</dd></div>; }

export function FranchiseDigestPanel({ dashboard, locale, m, keys }: { dashboard: FranchiseDigestDashboard; locale: Locale; m: FranchiseDigestMessages; keys: Record<string, string> }) {
  return <div className="space-y-8">
    <section aria-labelledby="digest-scope" className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm sm:p-6"><h2 id="digest-scope" className="text-xl font-semibold">{m.scopeTitle}</h2><p className="mt-2 leading-7">{m.scopeText}</p><p className="mt-3 text-sm font-medium text-muted-foreground">{m.noPersonalData}</p></section>
    <section aria-labelledby="digest-config"><h2 id="digest-config" className="text-2xl font-semibold">{m.configure}</h2><div className="mt-4 grid gap-5 lg:grid-cols-2">{dashboard.franchises.map((franchise) => <ConfigurationCard key={franchise.id} franchise={franchise} current={dashboard.configurations.find((item) => item.franchise_id === franchise.id)} userId={dashboard.currentUserId} locale={locale} m={m} keyValue={keys[franchise.id]} />)}</div></section>
    <section aria-labelledby="digest-history"><h2 id="digest-history" className="text-2xl font-semibold">{m.history}</h2><div className="mt-4 grid gap-5 xl:grid-cols-2">{dashboard.digests.map((digest) => <DigestCard key={digest.id} digest={digest} locale={locale} m={m} />)}</div>{dashboard.digests.length === 0 ? <p className="mt-4 rounded-xl border bg-card p-4 text-muted-foreground">{m.emptyHistory}</p> : null}</section>
    <section aria-labelledby="digest-delivery"><h2 id="digest-delivery" className="text-2xl font-semibold">{m.delivery}</h2><ul className="mt-4 grid gap-3">{dashboard.jobs.map((job) => <li key={job.id} className="rounded-xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full border px-3 py-1 text-sm font-medium">{m.statusLabels[job.status]}</span><time className="text-sm text-muted-foreground" dateTime={job.updated_at}>{dateTime(job.updated_at)}</time></div><dl className="mt-3 grid gap-3 sm:grid-cols-2"><Metric label={m.attempts} value={number(job.attempt_count, locale)} /><Metric label={m.nextAttempt} value={job.next_attempt_at ? dateTime(job.next_attempt_at) : "—"} /></dl></li>)}</ul>{dashboard.jobs.length === 0 ? <p className="mt-4 rounded-xl border bg-card p-4 text-muted-foreground">{m.noJobs}</p> : null}</section>
  </div>;
}

function ConfigurationCard({ franchise, current, userId, locale, m, keyValue }: { franchise: FranchiseDigestDashboard["franchises"][number]; current: FranchiseDigestDashboard["configurations"][number] | undefined; userId: string; locale: Locale; m: FranchiseDigestMessages; keyValue: string }) {
  const id = useId(), [state, action, pending] = useActionState(configureDigest, idle);
  return <article className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">{m.franchise} · <span dir="ltr">{franchise.territoryCode}</span></h3><p className="mt-1 text-sm text-muted-foreground">{m.territory}: {locale === "ar" ? franchise.territoryNameAr : franchise.territoryNameFr}</p><p className="text-sm text-muted-foreground">{m.mandate} · {m.version} {number(franchise.mandateVersion, locale)}</p></div>{current ? <span className="rounded-full border px-3 py-1 text-sm">{current.enabled ? m.active : m.inactive}</span> : null}</div>
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2"><input type="hidden" name="uiLocale" value={locale} /><input type="hidden" name="franchiseId" value={franchise.id} /><input type="hidden" name="recipientUserId" value={userId} /><input type="hidden" name="idempotencyKey" value={keyValue} />
      <div className="sm:col-span-2 rounded-lg border p-3"><p className="text-sm text-muted-foreground">{m.recipient}</p><p className="font-medium">{m.myAccount}</p></div>
      <div className="flex min-h-11 items-center gap-3 sm:col-span-2"><input id={`${id}-enabled`} name="enabled" type="checkbox" defaultChecked={current?.enabled ?? true} className="size-5 accent-primary" /><Label htmlFor={`${id}-enabled`}>{m.enabled}</Label></div>
      <div className="space-y-2"><Label htmlFor={`${id}-frequency`}>{m.frequency}</Label><select id={`${id}-frequency`} name="frequency" defaultValue={current?.frequency ?? "DAILY"} className={control}><option value="DAILY">{m.daily}</option><option value="WEEKDAYS">{m.weekdays}</option></select></div>
      <div className="space-y-2"><Label htmlFor={`${id}-time`}>{m.sendTime}</Label><Input id={`${id}-time`} name="localSendTime" type="time" required defaultValue={current?.local_send_time.slice(0, 5) ?? "08:00"} className={control} /></div>
      <div className="space-y-2"><Label htmlFor={`${id}-zone`}>{m.timeZone}</Label><Input id={`${id}-zone`} name="timeZone" required minLength={1} maxLength={100} defaultValue={current?.time_zone ?? "Africa/Casablanca"} className={control} dir="ltr" /></div>
      <div className="space-y-2"><Label htmlFor={`${id}-locale`}>{m.language}</Label><select id={`${id}-locale`} name="notificationLocale" defaultValue={current?.locale ?? (locale === "ar" ? "ar-MA" : "fr-MA")} className={control}><option value="fr-MA">{m.french}</option><option value="ar-MA">{m.arabic}</option></select></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${id}-reason`}>{m.reason}</Label><textarea id={`${id}-reason`} name="changeReason" required minLength={3} maxLength={1000} aria-describedby={`${id}-reason-help`} className={`${control} min-h-24 py-2`} /><p id={`${id}-reason-help`} className="text-sm text-muted-foreground">{m.reasonHelp}</p></div>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">{pending ? m.saving : m.save}</Button><Feedback state={state} m={m} /></div>
    </form>{!current ? <p className="mt-3 text-sm text-muted-foreground">{m.noSettings}</p> : null}</article>;
}

function DigestCard({ digest, locale, m }: { digest: FranchiseDigestDashboard["digests"][number]; locale: Locale; m: FranchiseDigestMessages }) {
  const s = digest.metrics_snapshot;
  return <article className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-semibold"><time dateTime={digest.digest_date} dir="ltr">{digest.digest_date}</time></h3><p className="mt-1 text-sm text-muted-foreground">{m.generated}: {dateTime(digest.generated_at)}</p></div><span className="rounded-full border px-3 py-1 text-sm">{digest.locale === "ar-MA" ? m.arabic : m.french}</span></div><h4 className="mt-5 font-semibold">{m.metrics}</h4><dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label={m.prospects} value={number(s.crm.total_prospects, locale)} /><Metric label={m.clients} value={number(s.crm.client_prospects, locale)} /><Metric label={m.providers} value={number(s.crm.provider_prospects, locale)} /><Metric label={m.overdueFollowups} value={number(s.followups.overdue, locale)} /><Metric label={m.nextFollowups} value={number(s.followups.next_24_hours, locale)} /><Metric label={m.score} value={formatBasisPoints(s.performance.global_score_basis_points, locale)} /><Metric label={m.libraryScore} value={formatBasisPoints(s.performance.library_quality_score_basis_points, locale)} /><Metric label={m.health} value={m.healthLabels[s.performance.health_suggestion as keyof typeof m.healthLabels] ?? s.performance.health_suggestion} /><Metric label={m.alerts} value={number(s.alerts.open_total, locale)} /><Metric label={m.criticalAlerts} value={number(s.alerts.critical, locale)} /><Metric label={m.objectives} value={number(s.objectives.active, locale)} /><Metric label={m.overdueObjectives} value={number(s.objectives.overdue, locale)} /><Metric label={m.dueToday} value={number(s.objectives.due_today, locale)} /></dl></article>;
}
