"use client";
import { useActionState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import type { ClientRfqMessages } from "./messages";
import { matchRequestAction, openRfqAction, readyRequestAction, type ActionState } from "./actions";

const idle: ActionState = { status: "idle" };

export function WorkflowActions({ locale, organizationId,requestId, rowVersion, status, canMarkReady = true, matchingRunId, messages, keys }: { locale: "fr" | "ar"; organizationId:string; requestId: string; rowVersion: number; status: string; canMarkReady?: boolean; matchingRunId: string | null; messages: ClientRfqMessages; keys: { ready: string; match: string; open: string } }) {
  const [ready, readyAction, readyPending] = useActionState(readyRequestAction, idle);
  const [match, matchAction, matchPending] = useActionState(matchRequestAction, idle);
  const [opened, openAction, openPending] = useActionState(openRfqAction, idle);
  const runId = match.status === "success" ? match.matchingRunId ?? matchingRunId : matchingRunId;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {status === "DRAFT" && canMarkReady ? (
        <form action={readyAction} className="space-y-3 rounded-xl border p-4">
          <Hidden locale={locale} requestId={requestId} keyValue={keys.ready} />
          <input type="hidden" name="rowVersion" value={rowVersion} />
          <Label htmlFor="ready-reason">{messages.reason}</Label>
          <Input id="ready-reason" name="reason" defaultValue={locale === "fr" ? "Informations client validées" : "تم التحقق من معلومات العميل"} />
          <Button disabled={readyPending} className="min-h-11 w-full">{messages.markReady}</Button>
          <Feedback state={ready} messages={messages} locale={locale} organizationId={organizationId} requestId={requestId} />
        </form>
      ) : null}
      {status === "READY" ? (
        <form action={matchAction} className="space-y-3 rounded-xl border p-4">
          <Hidden locale={locale} requestId={requestId} keyValue={keys.match} />
          <Label htmlFor="panel">{messages.panelSize}</Label>
          <Input id="panel" name="targetPanelSize" type="number" min={10} max={100} defaultValue={10} aria-describedby="panel-help" />
          <small id="panel-help" className="block text-muted-foreground">{messages.panelHelp}</small>
          <Button disabled={matchPending} className="min-h-11 w-full">{messages.runMatch}</Button>
          <Feedback state={match} messages={messages} locale={locale} organizationId={organizationId} requestId={requestId} />
        </form>
      ) : null}
      {runId && ["MATCHING", "READY"].includes(status) ? (
        <form action={openAction} className="space-y-3 rounded-xl border p-4">
          <Hidden locale={locale} requestId={requestId} keyValue={keys.open} />
          <input type="hidden" name="matchingRunId" value={runId} />
          <Label htmlFor="deadline">{messages.deadline}</Label>
          <Input id="deadline" name="deadlineLocal" type="datetime-local" required aria-describedby="deadline-help" />
          <small id="deadline-help" className="block text-muted-foreground">{messages.deadlineHelp}</small>
          <Button disabled={openPending} className="min-h-11 w-full">{messages.openRfq}</Button>
          <Feedback state={opened} messages={messages} locale={locale} organizationId={organizationId} requestId={requestId} />
        </form>
      ) : null}
    </div>
  );
}

function Hidden({ locale, requestId, keyValue }: { locale: string; requestId: string; keyValue: string }) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="idempotencyKey" value={keyValue} />
    </>
  );
}

function Feedback({ state, messages,locale,organizationId,requestId }: { state: ActionState; messages: ClientRfqMessages;locale:"fr"|"ar";organizationId:string;requestId:string }) {
  return state.status === "error"
    ? <p role="alert" className="text-sm text-destructive">{state.reason === "VALIDATION" ? messages.validation : state.reason==="TAX_POLICY_REQUIRED"?messages.taxPolicyRequired:state.reason==="TAX_ORIGIN_REVIEW"?messages.taxOriginReview:state.reason==="CATALOG_REVIEW"?messages.catalogReview:state.reason==="MFA_REQUIRED"?messages.mfaRequired:messages.actionError}{state.reason==="MFA_REQUIRED"?<a className="min-h-11 underline" href={`/${locale}/securite/compte?${new URLSearchParams({next:`/${locale}/client/demandes/${requestId}?organizationId=${organizationId}`})}`}>{messages.verifyMfa}</a>:null}</p>
    : state.status === "success"
      ? <p role="status" className="text-sm text-primary">{messages.saved}</p>
      : null;
}
