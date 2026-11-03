"use client";
import { useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { submitProviderDelivery } from "./actions";
import { useMissionAction } from "./use-mission-action";
import type { ProviderMissionMessages } from "./messages";



export function DeliveryForm({deliverableId,locale,messages:m}:{deliverableId:string;locale:Locale;idempotencyKey?:string;messages:ProviderMissionMessages}) {
  const id=useId();
  const {key,state,action,pending}=useMissionAction(submitProviderDelivery);
  const feedback=state.status==="success"?m.success:state.status==="error"?(state.reason==="VALIDATION"?m.validation:state.reason==="FORBIDDEN"?m.forbidden:state.reason==="CONFLICT"?m.conflict:m.failed):"";
  return <details className="mt-4 rounded-xl border bg-muted/30 p-3 open:p-4">
    <summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{m.submit}</summary>
    <form action={action} className="mt-3 grid min-w-0 gap-4">
      <input type="hidden" name="locale" value={locale}/><input type="hidden" name="deliverableId" value={deliverableId}/><input type="hidden" name="idempotencyKey" value={key}/>
      <Field id={`${id}-description`} label={m.descriptionLabel}><textarea id={`${id}-description`} name="description" required minLength={3} maxLength={4000} className="min-h-28 w-full rounded-md border bg-background p-3 text-base"/></Field>
      <Field id={`${id}-links`} label={m.links}><textarea id={`${id}-links`} name="linksText" maxLength={6000} dir="ltr" className="min-h-24 w-full rounded-md border bg-background p-3 text-base"/></Field>
      <Field id={`${id}-file`} label={locale==="ar"?"ملف الدليل (PDF أو JPEG أو PNG، 10 ميغابايت كحد أقصى)":"Fichier de preuve (PDF, JPEG ou PNG, 10 Mo maximum)"}><Input id={`${id}-file`} name="proofFile" type="file" required accept="application/pdf,image/jpeg,image/png" className="min-h-11 text-base"/></Field>
      <Field id={`${id}-note`} label={m.proofNote}><Input id={`${id}-note`} name="proofNote" maxLength={500} className="min-h-11 text-base"/></Field>
      <Button disabled={pending||!key} className="min-h-11 w-full sm:w-fit">{pending?m.pending:m.send}</Button>
      <p role={state.status==="error"?"alert":"status"} aria-live="polite" className={state.status==="error"?"min-h-5 text-sm text-destructive":"min-h-5 text-sm text-primary"}>{feedback}</p>
    </form>
  </details>;
}

function Field({id,label,children}:{id:string;label:string;children:React.ReactNode}) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}
