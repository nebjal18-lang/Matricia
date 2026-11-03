"use client";
import { useActionState, useId, useState } from "react";
import { Button } from "@/modules/shared/ui/button";
import type { SolutionLevel } from "@/modules/shared/lib/solution-insights/model";
import{decideAction}from"./actions";import{idle}from"./state";
import type { Messages } from "./messages";

export function DecisionForm({ locale, solutionSetId, level, idempotencyKey, m }: { locale: "fr" | "ar"; solutionSetId: string; level: SolutionLevel; idempotencyKey: string; m: Messages }) {
  const [state, action, pending] = useActionState(decideAction, idle);
  const [decision, setDecision] = useState("ACCEPTED");
  const prefix = useId();
  const feedback = state.status === "success" ? m.success : state.status === "error" ? m[state.reason === "VALIDATION" ? "validation" : state.reason === "UNAUTHENTICATED" ? "unauthenticated" : state.reason === "FORBIDDEN" ? "forbidden" : state.reason === "CONFLICT" ? "conflict" : "error"] : "";
  return <form action={action} className="mt-4 space-y-3" aria-busy={pending}>
    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="solutionSetId" value={solutionSetId} /><input type="hidden" name="level" value={level} /><input type="hidden" name="idempotencyKey" value={idempotencyKey} />
    <label htmlFor={`${prefix}-decision`} className="block"><span className="mb-1 block font-medium">{m.decision}</span></label><select id={`${prefix}-decision`} name="decision" value={decision} onChange={(event) => setDecision(event.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3"><option value="ACCEPTED">{m.accept}</option><option value="REJECTED">{m.reject}</option><option value="DEFERRED">{m.defer}</option></select>
    <label htmlFor={`${prefix}-reason`} className="block"><span className="mb-1 block font-medium">{m.reason}</span></label><textarea id={`${prefix}-reason`} required minLength={3} maxLength={2000} name="reason" className="min-h-24 w-full rounded-md border bg-background p-3" />
    {decision === "DEFERRED" ? <><label htmlFor={`${prefix}-until`} className="block"><span className="mb-1 block font-medium">{m.deferUntil}</span></label><input id={`${prefix}-until`} required type="date" name="deferredUntil" className="min-h-11 w-full rounded-md border bg-background px-3" dir="ltr" /></> : null}
    <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">{pending ? m.submitting : m.submit}</Button>
    <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-primary"}>{feedback}</p>
  </form>;
}
