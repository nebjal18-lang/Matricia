"use client";

import { useActionState, useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { createRuleAction, type RuleActionState } from "@/modules/admin/screens/catalogue/actions";
import type { BuilderMessages } from "./messages";
import { usePersistentCommandIdentity } from "./use-command-identity";

const initialState: RuleActionState = { status: "idle" };
const ruleActions = ["BLOCK_PUBLICATION", "BLOCK_RFQ", "REQUIRE_QUESTION", "SHOW_QUESTION", "HIDE_QUESTION", "CREATE_ANOMALY", "CREATE_RISK", "CREATE_RECOMMENDATION", "REQUIRE_HUMAN_REVIEW"] as const;

export function RuleBuilder({ locale, library, messages, commandIdentity }: {
  locale: Locale; library: { id: string; code: string }; messages: BuilderMessages;
  commandIdentity: { idempotencyKey: string; correlationId: string };
}) {
  const [state, action, pending] = useActionState(createRuleAction, initialState);
  const prefix = useId();
  const [idempotencyRef, correlationRef, prepare] = usePersistentCommandIdentity("CREATE_RULE", state.status === "success", commandIdentity);
  const error = state.status === "error" ? messages.errors[state.reason === "VALIDATION" ? "validation" : state.reason.toLowerCase() as "unauthenticated" | "forbidden" | "unavailable"] : null;
  return <section aria-labelledby={`${prefix}-title`}>
    <Card><CardHeader><CardTitle><h2 id={`${prefix}-title`}>{messages.ruleTitle}</h2></CardTitle><CardDescription>{messages.ruleDescription} <bdi dir="ltr" className="font-mono">{library.code}</bdi></CardDescription></CardHeader>
      <CardContent><form action={action} onSubmitCapture={prepare} aria-describedby={`${prefix}-status`} className="grid gap-5 lg:grid-cols-2">
        <input type="hidden" name="locale" value={locale} /><input type="hidden" name="libraryId" value={library.id} /><input ref={idempotencyRef} type="hidden" name="idempotencyKey" defaultValue={commandIdentity.idempotencyKey} /><input ref={correlationRef} type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
        <div className="space-y-2"><Label htmlFor={`${prefix}-rule`}>{messages.ruleKey}</Label><Input id={`${prefix}-rule`} name="ruleKey" required pattern="[A-Z][A-Z0-9_.-]{1,119}" dir="ltr" className="min-h-11 font-mono" /></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-question`}>{messages.predicateQuestionKey}</Label><Input id={`${prefix}-question`} name="questionKey" required pattern="[A-Z][A-Z0-9_.-]{1,119}" dir="ltr" className="min-h-11 font-mono" /></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-expected`}>{messages.expectedBoolean}</Label><select id={`${prefix}-expected`} name="expectedBoolean" className="min-h-11 w-full rounded-md border border-input bg-background px-3"><option value="yes">{messages.approvalYes}</option><option value="no">{messages.approvalNo}</option></select></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-action`}>{messages.ruleAction}</Label><select id={`${prefix}-action`} name="actionType" className="min-h-11 w-full rounded-md border border-input bg-background px-3">{ruleActions.map((value)=><option key={value} value={value}>{messages.ruleActions[value]}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-target`}>{messages.actionTarget}</Label><Input id={`${prefix}-target`} name="actionTarget" required pattern="[A-Z][A-Z0-9_.:-]{1,127}" dir="ltr" className="min-h-11 font-mono" /></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-priority`}>{messages.priority}</Label><Input id={`${prefix}-priority`} name="priority" type="number" min={0} max={100000} step={1} defaultValue={100} required className="min-h-11" /></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-sensitive`}>{messages.sensitiveRule}</Label><select id={`${prefix}-sensitive`} name="sensitive" className="min-h-11 w-full rounded-md border border-input bg-background px-3"><option value="no">{messages.approvalNo}</option><option value="yes">{messages.approvalYes}</option></select></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-reason`}>{messages.changeReason}</Label><Input id={`${prefix}-reason`} name="changeReason" required minLength={3} maxLength={500} className="min-h-11" /></div>
        <label className="flex min-h-11 items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm lg:col-span-2"><input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required /><span>{messages.confirmRule}</span></label>
        <div className="space-y-3 lg:col-span-2"><Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">{pending ? messages.creatingRule : messages.createRule}</Button><div id={`${prefix}-status`} role={error ? "alert" : "status"} aria-live="polite" className={error ? "min-h-6 text-sm text-destructive" : "min-h-6 text-sm text-primary"}>{error ?? (state.status === "success" ? <>{messages.ruleCreated} <bdi dir="ltr" className="break-all font-mono">{state.ruleId}</bdi></> : null)}</div></div>
      </form></CardContent></Card>
  </section>;
}
