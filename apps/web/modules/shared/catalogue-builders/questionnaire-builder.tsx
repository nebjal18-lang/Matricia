"use client";

import { useActionState, useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { createQuestionnaireAction, type QuestionnaireActionState } from "@/modules/admin/screens/catalogue/actions";
import type { BuilderMessages } from "./messages";
import { usePersistentCommandIdentity } from "./use-command-identity";

const initialState: QuestionnaireActionState = { status: "idle" };
const audiences = ["CLIENT", "PROVIDER", "FRANCHISE", "INTERNAL"] as const;

export function QuestionnaireBuilder({ locale, library, messages, commandIdentity }: { locale: Locale; library: { id: string; code: string; currentReleaseId: string | null }; messages: BuilderMessages; commandIdentity: { idempotencyKey: string; correlationId: string } }) {
  const [state, action, pending] = useActionState(createQuestionnaireAction, initialState);
  const prefix = useId();
  const [idempotencyRef, correlationRef, prepare] = usePersistentCommandIdentity("CREATE_QUESTIONNAIRE", state.status === "success", commandIdentity);
  const error = state.status === "error" ? messages.errors[state.reason === "VALIDATION" ? "validation" : state.reason.toLowerCase() as "unauthenticated" | "forbidden" | "unavailable"] : null;
  return <section aria-labelledby={`${prefix}-title`}><Card><CardHeader><CardTitle><h2 id={`${prefix}-title`}>{messages.formTitle}</h2></CardTitle><CardDescription>{messages.formDescription} <bdi dir="ltr" className="font-mono">{library.code}</bdi></CardDescription></CardHeader><CardContent>
    <form action={action} onSubmitCapture={prepare} aria-describedby={`${prefix}-status`} className="grid gap-5 lg:grid-cols-2">
      <input type="hidden" name="locale" value={locale}/><input type="hidden" name="libraryId" value={library.id}/><input type="hidden" name="catalogReleaseId" value={library.currentReleaseId ?? ""}/><input ref={idempotencyRef} type="hidden" name="idempotencyKey" defaultValue={commandIdentity.idempotencyKey}/><input ref={correlationRef} type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId}/>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm lg:col-span-2"><span className="font-medium">{locale === "ar" ? "الإصدار النشط للدليل" : "Publication catalogue active"}</span><span className="ms-2 text-muted-foreground">{library.currentReleaseId ? messages.entityStatuses.PUBLISHED : messages.unavailable}</span></div>
      <Field id={`${prefix}-code`} label={messages.formCode}><Input id={`${prefix}-code`} name="code" required pattern="[A-Z][A-Z0-9_-]{1,79}" dir="ltr" className="min-h-11 font-mono" /></Field>
      <Field id={`${prefix}-title-fr`} label={messages.titleFr}><Input id={`${prefix}-title-fr`} name="titleFr" required maxLength={240} dir="ltr" className="min-h-11" /></Field>
      <Field id={`${prefix}-title-ar`} label={messages.titleAr}><Input id={`${prefix}-title-ar`} name="titleAr" required maxLength={240} dir="rtl" lang="ar" className="min-h-11" /></Field>
      <Field id={`${prefix}-description-fr`} label={messages.descriptionFr}><Textarea id={`${prefix}-description-fr`} name="descriptionFr" required maxLength={4000} dir="ltr" /></Field>
      <Field id={`${prefix}-description-ar`} label={messages.descriptionAr}><Textarea id={`${prefix}-description-ar`} name="descriptionAr" required maxLength={4000} dir="rtl" lang="ar" /></Field>
      <Field id={`${prefix}-audience`} label={messages.audience}><select id={`${prefix}-audience`} name="audience" className="min-h-11 w-full rounded-md border border-input bg-background px-3">{audiences.map(value=><option key={value} value={value}>{messages.audiences[value]}</option>)}</select></Field>
      <Field id={`${prefix}-sensitive`} label={messages.formSensitive}><select id={`${prefix}-sensitive`} name="sensitive" className="min-h-11 w-full rounded-md border border-input bg-background px-3"><option value="no">{messages.approvalNo}</option><option value="yes">{messages.approvalYes}</option></select></Field>
      <Field id={`${prefix}-engine`} label={messages.engineVersion}><Input id={`${prefix}-engine`} name="engineVersion" required defaultValue="1.0.0" dir="ltr" className="min-h-11 font-mono" /></Field>
      <Field id={`${prefix}-policy`} label={messages.policyVersion}><Input id={`${prefix}-policy`} name="policyVersion" required defaultValue="P06-1" dir="ltr" className="min-h-11 font-mono" /></Field>
      <Field id={`${prefix}-section-key`} label={messages.sectionKey}><Input id={`${prefix}-section-key`} name="sectionKey" required pattern="[A-Z][A-Z0-9_-]{1,79}" dir="ltr" className="min-h-11 font-mono" /></Field>
      <Field id={`${prefix}-section-fr`} label={messages.sectionLabelFr}><Input id={`${prefix}-section-fr`} name="sectionLabelFr" required maxLength={240} dir="ltr" className="min-h-11" /></Field>
      <Field id={`${prefix}-section-ar`} label={messages.sectionLabelAr}><Input id={`${prefix}-section-ar`} name="sectionLabelAr" required maxLength={240} dir="rtl" lang="ar" className="min-h-11" /></Field>
      <Field id={`${prefix}-help-fr`} label={messages.sectionHelpFr}><Textarea id={`${prefix}-help-fr`} name="sectionHelpFr" maxLength={2000} dir="ltr" /></Field>
      <Field id={`${prefix}-help-ar`} label={messages.sectionHelpAr}><Textarea id={`${prefix}-help-ar`} name="sectionHelpAr" maxLength={2000} dir="rtl" lang="ar" /></Field>
      <Field id={`${prefix}-reason`} label={messages.changeReason}><Input id={`${prefix}-reason`} name="changeReason" required minLength={3} maxLength={500} className="min-h-11" /></Field>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm lg:col-span-2"><input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required/><span>{messages.confirmForm}</span></label>
      <div className="space-y-3 lg:col-span-2"><Button type="submit" disabled={pending || !library.currentReleaseId} className="min-h-11 w-full sm:w-auto">{pending?messages.creatingForm:messages.createForm}</Button><div id={`${prefix}-status`} role={error?"alert":"status"} aria-live="polite" className={error?"min-h-6 text-sm text-destructive":"min-h-6 text-sm text-primary"}>{error??(state.status==="success"?<>{messages.formCreated}</>:null)}</div></div>
    </form></CardContent></Card></section>;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
