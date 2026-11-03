"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { Button } from "@/modules/shared/ui/button";
import { activateClientApprovalPolicy, proposeClientApprovalPolicy, type PolicyActionState } from "./policy-actions";
import type { ApprovalMessages } from "./messages";
import type { ClientApprovalPolicy } from "./model";
const idle: PolicyActionState = { status: "idle" };
function Feedback({ state, locale, messages }: { state: PolicyActionState; locale: Locale; messages: ApprovalMessages }) {
  const text = state.status === "proposed" ? messages.policySaved : state.status === "activated" ? messages.policyActivated : state.status === "error" ? state.reason === "MFA_REQUIRED" ? messages.mfa : state.reason === "UNAUTHENTICATED" ? messages.unauthenticated : state.reason === "FORBIDDEN" ? messages.forbidden : state.reason === "CONFLICT" ? messages.conflict : messages.policyFailed : "";
  return <div aria-live="polite"><p role={state.status === "error" ? "alert" : "status"}>{text}</p>{state.status === "error" && state.reason === "MFA_REQUIRED" ? <Link className="underline" href={`/${locale}/securite/compte`}>{messages.security}</Link> : null}</div>;
}
export function ClientApprovalPolicyForm({ locale, organizationId, messages, idempotencyKey, effectiveFrom }: { locale: Locale; organizationId: string; messages: ApprovalMessages; idempotencyKey: string; effectiveFrom: string }) {
  const [state, action, pending] = useActionState(proposeClientApprovalPolicy, idle);
  const [key] = useState(idempotencyKey);
  return <form action={action} className="grid min-w-0 gap-4 sm:grid-cols-2">
    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="idempotencyKey" value={key} /><input type="hidden" name="effectiveFrom" value={effectiveFrom} />
    <label>{messages.resource}<select name="resourceType" className="mt-1 min-h-11 w-full rounded border bg-background px-3" required>{(["QUOTE_SELECTION", "CONTRACT_GENERATION", "COST_ALLOCATION"] as const).map((type) => <option key={type} value={type}>{messages.resources[type]}</option>)}</select></label>
    <label>{messages.approvalsCount}<input name="minimumApprovals" type="number" min={1} max={5} defaultValue={1} required className="mt-1 min-h-11 w-full rounded border bg-background px-3" /></label>
    <label>{messages.currency}<input name="currency" required minLength={3} maxLength={3} pattern="[A-Z]{3}" defaultValue="MAD" dir="ltr" className="mt-1 min-h-11 w-full rounded border bg-background px-3" /></label>
    <label>{messages.threshold}<input name="threshold" required inputMode="decimal" defaultValue="0" dir="ltr" className="mt-1 min-h-11 w-full rounded border bg-background px-3" /></label>
    <label className="sm:col-span-2">{messages.buyerLimit}<input name="buyerLimit" inputMode="decimal" dir="ltr" className="mt-1 min-h-11 w-full rounded border bg-background px-3" /></label>
    <fieldset className="sm:col-span-2"><legend>{messages.roles}</legend><div className="mt-2 flex flex-wrap gap-4">{Object.entries(messages.roleNames).map(([code, label]) => <label key={code} className="flex min-h-11 items-center gap-2"><input type="checkbox" name="roles" value={code} defaultChecked={code === "CLIENT_OWNER"} className="size-5" />{label}</label>)}</div></fieldset>
    <label className="sm:col-span-2">{messages.changeReason}<textarea name="reason" required minLength={10} maxLength={1000} rows={3} className="mt-1 w-full rounded border bg-background p-3" /></label>
    <Button type="submit" disabled={pending}>{pending ? messages.pending : messages.propose}</Button><div className="sm:col-span-2"><Feedback state={state} locale={locale} messages={messages} /></div>
  </form>;
}
export function ClientApprovalPolicyActivation({ locale, organizationId, policy, messages, idempotencyKey }: { locale: Locale; organizationId: string; policy: ClientApprovalPolicy; messages: ApprovalMessages; idempotencyKey: string }) {
  const [state, action, pending] = useActionState(activateClientApprovalPolicy, idle);
  const [key] = useState(idempotencyKey);
  return <form action={action} className="mt-3 space-y-3"><input type="hidden" name="locale" value={locale} /><input type="hidden" name="organizationId" value={organizationId} /><input type="hidden" name="policyVersionId" value={policy.id} /><input type="hidden" name="contentHash" value={policy.contentHash} /><input type="hidden" name="idempotencyKey" value={key} /><Button type="submit" disabled={pending}>{pending ? messages.pending : messages.activate}</Button><Feedback state={state} locale={locale} messages={messages} /></form>;
}
