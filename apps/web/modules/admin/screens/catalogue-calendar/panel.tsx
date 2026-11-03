"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { getSupabaseBrowserClient } from "@/modules/shared/lib/supabase/client";
import { calendarCopy } from "./copy";
import type { CalendarContext, CalendarDateLabels, CalendarFailure, WindowRequest } from "./model";
import { requestWindowClosure, decideWindowClosure, type CalendarCommandResult } from "./commands";
const field = "min-h-11 w-full min-w-0 rounded-md border bg-background p-3";
function useCommand(locale: Locale, returnPath: string) {
    const router = useRouter(), [busy, setBusy] = useState(false), [failure, setFailure] = useState<CalendarFailure | null>(null), [success, setSuccess] = useState(false), attempts = useRef(new Map<string, string>()), inFlight = useRef(false);
    async function run(payload: unknown, execute: (key: string) => Promise<CalendarCommandResult>) {
        if (inFlight.current)
            return;
        inFlight.current = true;
        setBusy(true);
        setFailure(null);
        setSuccess(false);
        try {
            const serialized = JSON.stringify(payload);
            let key = attempts.current.get(serialized);
            if (!key) {
                key = crypto.randomUUID();
                attempts.current.set(serialized, key);
            }
            const result = await execute(key);
            if (result.ok) {
                setSuccess(true);
                router.refresh();
            }
            else
                setFailure(result.reason);
        }
        catch {
            setFailure("QUERY_FAILED");
        }
        finally {
            inFlight.current = false;
            setBusy(false);
        }
    }
    const c = calendarCopy[locale];
    const notice = <>{failure ? <div role="alert" className="space-y-2 rounded border border-amber-500 p-3"><p>{c.errors[failure]}</p>{failure === "MFA_REQUIRED" ? <Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/securite/compte?${new URLSearchParams({ next: returnPath })}`}>{c.mfa}</Link> : failure === "UNAUTHENTICATED" ? <Link className="inline-flex min-h-11 items-center underline" href={connexionHref(locale, { next: returnPath })}>{c.signin}</Link> : <button type="button" className="min-h-11 underline" onClick={() => router.refresh()}>{c.refresh}</button>}</div> : null}</>;
    return { busy, success, run, notice, reset: () => { setFailure(null); setSuccess(false); } };
}
function Review({ locale, row, returnPath }: {
    locale: Locale;
    row: WindowRequest;
    returnPath: string;
}) {
    const c = calendarCopy[locale], state = useCommand(locale, returnPath), [reason, setReason] = useState("");
    async function decide(approved: boolean) { await state.run({ row, reason, approved }, key => decideWindowClosure(getSupabaseBrowserClient(), row, approved, reason, key)); }
    return <article className="min-w-0 space-y-3 rounded-xl border p-4"><h3 className="break-words font-semibold">{row.libraryCode} · {row.releaseKey}</h3><p className="break-words">{c.current} : {row.currentReleaseKey}</p><p>{row.status === "PENDING" ? c.pending : row.status === "CLOSED" ? c.closed : c.rejected}</p><p className="whitespace-pre-wrap break-words"><strong>{c.requestReason} : </strong><bdi>{row.reason}</bdi></p>{row.decisionReason ? <p className="whitespace-pre-wrap break-words"><strong>{c.decisionReason} : </strong><bdi>{row.decisionReason}</bdi></p> : null}{row.sourceChanged && row.status === "PENDING" ? <p role="status">{c.changed}</p> : null}
 {row.canDecide && row.status === "PENDING" ? <form className="space-y-3" onSubmit={event => { event.preventDefault(); const approved = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "approve"; void decide(approved); }}>
 <label className="grid gap-2">{c.decisionReason}<textarea className={field} dir="auto" required minLength={10} maxLength={2000} value={reason} disabled={state.busy} onChange={event => { setReason(event.target.value); state.reset(); }}/></label><div className="flex flex-wrap gap-3"><button className="admin-btn-outline min-h-11" type="submit" value="approve" disabled={state.busy || state.success || row.sourceChanged}>{state.busy ? c.busy : c.approve}</button><button className="admin-btn-outline min-h-11" type="submit" value="reject" disabled={state.busy || state.success}>{state.busy ? c.busy : c.reject}</button></div></form> : row.status === "PENDING" ? <p>{c.independent}</p> : null}{state.notice}{state.success ? <p role="status">{c.decided}</p> : null}</article>;
}
export function CatalogCalendarPanel({ locale, context, dateLabels, returnPath }: {
    locale: Locale;
    context: CalendarContext;
    dateLabels: CalendarDateLabels;
    returnPath: string;
}) {
    const c = calendarCopy[locale], state = useCommand(locale, returnPath), [selected, setSelected] = useState(""), [reason, setReason] = useState("");
    const source = context.conflicts.find(row => row.releaseId === selected && row.canRequest);
    async function submit(event: FormEvent) { event.preventDefault(); if (!source)
        return; await state.run({ source, reason }, key => requestWindowClosure(getSupabaseBrowserClient(), source!, reason, key)); }
    return <div dir={locale === "ar" ? "rtl" : "ltr"} className="min-w-0 space-y-6"><p>{c.context}</p><section className="space-y-3"><h2 className="text-xl font-semibold">{c.sources}</h2>{context.conflicts.length ? <form onSubmit={submit} className="space-y-3 rounded-xl border p-4"><label className="grid gap-2">{c.choose}<select className={field} value={selected} required disabled={state.busy} onChange={event => { setSelected(event.target.value); state.reset(); }}><option value="">{c.select}</option>{context.conflicts.filter(row => row.canRequest).map(row => <option key={row.releaseId} value={row.releaseId}>{row.libraryCode} · {row.releaseKey} · {dateLabels[row.releaseId]?.from}</option>)}</select></label>{source ? <dl className="space-y-2 break-words"><div><dt className="font-semibold">{c.current}</dt><dd>{source.currentReleaseKey}</dd></div><div><dt className="font-semibold">{c.from}</dt><dd>{dateLabels[source.releaseId]?.from}</dd></div><div><dt className="font-semibold">{c.until}</dt><dd>{source.effectiveUntil ? dateLabels[source.releaseId]?.until : c.open}</dd></div></dl> : null}<label className="grid gap-2">{c.reason}<textarea className={field} dir="auto" required minLength={10} maxLength={2000} value={reason} disabled={state.busy} onChange={event => { setReason(event.target.value); state.reset(); }}/></label><button type="submit" className="admin-btn-outline min-h-11" disabled={!source || state.busy}>{state.busy ? c.busy : c.request}</button>{state.notice}{state.success ? <p role="status">{c.sent}</p> : null}</form> : <p role="status">{c.empty}</p>}</section><section className="space-y-3"><h2 className="text-xl font-semibold">{c.reviews}</h2>{context.requests.length ? context.requests.map(row => <Review key={row.id} locale={locale} row={row} returnPath={returnPath}/>) : <p role="status">{c.noRequests}</p>}</section></div>;
}
