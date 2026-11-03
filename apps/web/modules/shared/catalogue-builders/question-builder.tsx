"use client";

import { useActionState, useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { createQuestionAction, type QuestionActionState } from "@/modules/admin/screens/catalogue/actions";
import type { BuilderMessages } from "./messages";
import { usePersistentCommandIdentity } from "./use-command-identity";

const initialState: QuestionActionState = { status: "idle" };
const answerTypes = ["YES_NO", "SHORT_TEXT", "LONG_TEXT", "INTEGER", "DATE", "MONEY"] as const;
const sensitivities = ["PUBLIC", "BUSINESS", "CONFIDENTIAL", "RESTRICTED"] as const;

export function QuestionBuilder({ locale, library, service, messages, commandIdentity }: {
  locale: Locale; library: { id: string; code: string }; service: { id: string; code: string };
  messages: BuilderMessages; commandIdentity: { idempotencyKey: string; correlationId: string };
}) {
  const [state, action, pending] = useActionState(createQuestionAction, initialState);
  const prefix = useId();
  const [idempotencyRef, correlationRef, prepare] = usePersistentCommandIdentity("CREATE_QUESTION", state.status === "success", commandIdentity);
  const error = state.status === "error" ? messages.errors[state.reason === "VALIDATION" ? "validation" : state.reason.toLowerCase() as "unauthenticated" | "forbidden" | "unavailable"] : null;
  return (
    <section aria-labelledby={`${prefix}-title`}>
      <Card>
        <CardHeader>
          <CardTitle><h2 id={`${prefix}-title`}>{messages.questionTitle}</h2></CardTitle>
          <CardDescription>{messages.questionDescription} <bdi dir="ltr" className="font-mono">{library.code} / {service.code}</bdi></CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} onSubmitCapture={prepare} aria-describedby={`${prefix}-status`} className="grid gap-5 lg:grid-cols-2">
            <input type="hidden" name="locale" value={locale} /><input type="hidden" name="libraryId" value={library.id} /><input type="hidden" name="serviceId" value={service.id} />
            <input ref={idempotencyRef} type="hidden" name="idempotencyKey" defaultValue={commandIdentity.idempotencyKey} /><input ref={correlationRef} type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
            <div className="space-y-2"><Label htmlFor={`${prefix}-key`}>{messages.questionKey}</Label><Input id={`${prefix}-key`} name="questionKey" required pattern="[A-Z][A-Z0-9_.-]{1,119}" dir="ltr" autoComplete="off" className="min-h-11 font-mono" /></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-data`}>{messages.dataKey}</Label><Input id={`${prefix}-data`} name="dataKey" required pattern="[A-Za-z][A-Za-z0-9_.-]{1,159}" dir="ltr" autoComplete="off" className="min-h-11 font-mono" /></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-fr`}>{messages.labelFr}</Label><Textarea id={`${prefix}-fr`} name="labelFr" required maxLength={1000} dir="ltr" /></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-ar`}>{messages.labelAr}</Label><Textarea id={`${prefix}-ar`} name="labelAr" required maxLength={1000} dir="rtl" lang="ar" /></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-help-fr`}>{messages.helpFr}</Label><Textarea id={`${prefix}-help-fr`} name="helpFr" maxLength={2000} dir="ltr" /></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-help-ar`}>{messages.helpAr}</Label><Textarea id={`${prefix}-help-ar`} name="helpAr" maxLength={2000} dir="rtl" lang="ar" /></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-type`}>{messages.answerType}</Label><select id={`${prefix}-type`} name="answerType" defaultValue="LONG_TEXT" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2">{answerTypes.map((type) => <option key={type} value={type}>{messages.answerTypes[type]}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-sensitivity`}>{messages.sensitivity}</Label><select id={`${prefix}-sensitivity`} name="sensitivity" defaultValue="BUSINESS" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2">{sensitivities.map((value) => <option key={value} value={value}>{messages.sensitivities[value]}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-required`}>{messages.required}</Label><select id={`${prefix}-required`} name="requiredByDefault" defaultValue="yes" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"><option value="yes">{messages.approvalYes}</option><option value="no">{messages.approvalNo}</option></select></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-quote`}>{messages.requiredForQuote}</Label><select id={`${prefix}-quote`} name="requiredForQuote" defaultValue="yes" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"><option value="yes">{messages.approvalYes}</option><option value="no">{messages.approvalNo}</option></select></div>
            <div className="space-y-2 lg:col-span-2"><Label htmlFor={`${prefix}-reason`}>{messages.changeReason}</Label><Input id={`${prefix}-reason`} name="changeReason" required minLength={3} maxLength={500} autoComplete="off" className="min-h-11" /></div>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm leading-5 lg:col-span-2"><input className="mt-0.5 size-5 shrink-0 accent-primary" type="checkbox" name="confirmed" value="yes" required /><span>{messages.confirmQuestion}</span></label>
            <div className="space-y-3 lg:col-span-2"><Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">{pending ? messages.creatingQuestion : messages.createQuestion}</Button><div id={`${prefix}-status`} role={error ? "alert" : "status"} aria-live="polite" className={error ? "min-h-6 text-sm text-destructive" : "min-h-6 text-sm text-primary"}>{error ?? (state.status === "success" ? <>{messages.questionCreated} <bdi dir="ltr" className="break-all font-mono">{state.questionId}</bdi></> : null)}</div></div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
