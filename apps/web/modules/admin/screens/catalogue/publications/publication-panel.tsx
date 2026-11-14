"use client";

import { useActionState, useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { shortReference } from "@/modules/shared/lib/format/display";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { PublicationDashboard } from "@/modules/shared/lib/catalogue-publications/model";
import { rollbackReleaseAction, type RollbackActionState } from "./actions";
import type { PublicationMessages } from "./messages";

const initialState: RollbackActionState = { status: "idle" };

export function PublicationPanel({ locale, dashboard, messages, commandIds }: { locale: Locale; dashboard: PublicationDashboard; messages: PublicationMessages; commandIds: Record<string, { idempotencyKey: string; correlationId: string }> }) {
  return <div className="space-y-6">{dashboard.historyTruncated ? <p role="status" className="rounded-lg border bg-muted p-4 text-sm">{messages.truncated}</p> : null}{dashboard.libraries.length === 0 ? <p>{messages.noLibraries}</p> : dashboard.libraries.map((library) => <LibraryReleaseCard key={library.id} locale={locale} library={library} canRollback={dashboard.canRollback} aal={dashboard.aal} messages={messages} commandIds={commandIds} />)}</div>;
}

function LibraryReleaseCard({ locale, library, canRollback, aal, messages, commandIds }: { locale: Locale; library: PublicationDashboard["libraries"][number]; canRollback: boolean; aal: "aal1" | "aal2"; messages: PublicationMessages; commandIds: Record<string, { idempotencyKey: string; correlationId: string }> }) {
  const [state, action, pending] = useActionState(rollbackReleaseAction, initialState);
  const prefix = useId();
  const eligible = library.releases.filter((release) => (release.status === "PUBLISHED" || release.status === "RETIRED") && release.id !== library.currentReleaseId);
  const identity = commandIds[library.id];
  const currentRelease = library.releases.find((release) => release.id === library.currentReleaseId);
  const currentLabel = currentRelease?.releaseKey ?? (library.currentReleaseId ? shortReference(library.currentReleaseId) : "—");
  return <Card><CardHeader><CardTitle><h2><bdi dir="ltr">{library.code}</bdi></h2></CardTitle><CardDescription>{library.releases.length} {messages.releases} · {messages.current}: <bdi dir="ltr" className="font-mono">{currentLabel}</bdi></CardDescription></CardHeader><CardContent className="space-y-5">
    <section aria-labelledby={`${prefix}-history`}><h3 id={`${prefix}-history`} className="font-semibold">{messages.history}</h3>{library.releases.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{messages.noReleases}</p> : <ul className="mt-3 grid gap-3 lg:grid-cols-2">{library.releases.map((release) => <li key={release.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><bdi dir="ltr" className="font-mono font-medium">{release.releaseKey}</bdi><span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold">{messages.statuses[release.status]}</span></div><dl className="mt-3 grid gap-1 text-sm text-muted-foreground"><div><dt className="inline font-medium text-foreground">{messages.snapshot}: </dt><dd className="inline"><bdi dir="ltr" className="font-mono">{release.snapshotHash ? `${release.snapshotHash.slice(0, 12)}…` : "—"}</bdi></dd></div><div><dt className="inline font-medium text-foreground">{messages.effective}: </dt><dd className="inline"><time dateTime={release.effectiveFrom}>{new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(release.effectiveFrom))}</time></dd></div><div><dt className="inline font-medium text-foreground">{messages.approval}: </dt><dd className="inline">{release.requiresCentralApproval ? "✓" : "—"}</dd></div></dl></li>)}</ul>}</section>
    {canRollback && identity ? <section aria-labelledby={`${prefix}-rollback`} className="rounded-lg border bg-muted/30 p-4"><h3 id={`${prefix}-rollback`} className="font-semibold">{messages.rollbackTitle}</h3><p className="mt-1 text-sm text-muted-foreground">{messages.rollbackDescription}</p>{eligible.length === 0 ? <p className="mt-3 text-sm">{messages.noRollback}</p> : <form action={action} className="mt-4 grid gap-4 md:grid-cols-2"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="libraryId" value={library.id}/><input type="hidden" name="expectedLibraryRowVersion" value={library.rowVersion}/><input type="hidden" name="idempotencyKey" value={identity.idempotencyKey}/><input type="hidden" name="correlationId" value={identity.correlationId}/><div className="space-y-2"><Label htmlFor={`${prefix}-target`}>{messages.target}</Label><select id={`${prefix}-target`} name="targetReleaseId" required dir="ltr" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2">{eligible.map((release) => <option key={release.id} value={release.id}>{release.releaseKey} — {messages.statuses[release.status]}</option>)}</select></div><div className="space-y-2"><Label htmlFor={`${prefix}-key`}>{messages.releaseKey}</Label><Input id={`${prefix}-key`} name="releaseKey" required pattern="[A-Z][A-Z0-9_.-]{2,119}" dir="ltr" className="min-h-11 font-mono"/></div><label className="flex min-h-11 items-start gap-3 rounded-md border bg-background p-3 text-sm md:col-span-2"><input type="checkbox" name="confirmed" value="yes" required className="mt-0.5 size-5 accent-primary"/><span>{messages.confirm}</span></label><Button type="submit" disabled={pending} className="min-h-11 md:col-span-2">{pending ? messages.rollingBack : messages.rollback}</Button><ActionState state={state} messages={messages}/></form>}</section> : aal !== "aal2" ? <p role="status" className="rounded-lg border p-4 text-sm">{messages.aal2}</p> : null}
  </CardContent></Card>;
}

function ActionState({ state, messages }: { state: RollbackActionState; messages: PublicationMessages }) {
  if (state.status === "idle") return null;
  if (state.status === "success") return <p role="status" className="text-sm text-primary md:col-span-2">{messages.success} {messages.result}: <bdi dir="ltr" className="font-mono">{shortReference(state.releaseId)}</bdi></p>;
  return <p role="alert" className="text-sm text-destructive md:col-span-2">{messages.errors[state.reason]}</p>;
}
