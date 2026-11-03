"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Textarea } from "@/modules/shared/ui/textarea";
import { moroccoRegionLabel, moroccoRegions } from "@/modules/shared/lib/geo/morocco-regions";
import type { ClientRfqMessages } from "./messages";
import type { QuoteInformation, QuoteQuestion } from "./quote-information";
import { completeRequestInformationAction, type CompleteInformationState } from "./quote-information-actions";

const idle: CompleteInformationState = { status: "idle" };
const control = "min-h-11 w-full rounded-md border bg-background px-3";

function AnswerField({ question, messages, value, onChange }: { question: QuoteQuestion; messages: ClientRfqMessages; value:string; onChange:(value:string)=>void }) {
  const id = `answer-${question.dataKey}`;
  const name = `answer:${question.dataKey}`;
  const describedBy = question.help ? `${id}-help` : undefined;
  const input = (() => {
    if (question.answerType === "YES_NO") {
      return (
        <select id={id} name={name} className={control} value={value} onChange={event=>onChange(event.target.value)} required={question.required} aria-describedby={describedBy}>
          <option value="" disabled>—</option>
          <option value={messages.yes}>{messages.yes}</option>
          <option value={messages.no}>{messages.no}</option>
        </select>
      );
    }
    if (question.answerType === "SINGLE_CHOICE" && question.options.length) {
      return (
        <select id={id} name={name} className={control} value={value} onChange={event=>onChange(event.target.value)} required={question.required} aria-describedby={describedBy}>
          <option value="" disabled>—</option>
          {question.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      );
    }
    if (question.answerType === "MULTIPLE_CHOICE" && question.options.length) {
      const selected = new Set(value.split(",").map((item) => item.trim()));
      return (
        <span className="grid gap-2">
          {question.options.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name={name} value={option} checked={selected.has(option)} onChange={event=>{const next=new Set(selected);if(event.target.checked)next.add(option);else next.delete(option);onChange([...next].join(", "));}} className="size-4" />
              {option}
            </label>
          ))}
        </span>
      );
    }
    if (question.answerType === "LONG_TEXT" || question.answerType === "ADDRESS") {
      return <Textarea id={id} name={name} rows={3} maxLength={1200} value={value} onChange={event=>onChange(event.target.value)} required={question.required} aria-describedby={describedBy} />;
    }
    if (question.answerType === "DATE") {
      return <Input id={id} name={name} type="date" className={control} value={value} onChange={event=>onChange(event.target.value)} required={question.required} aria-describedby={describedBy} />;
    }
    if (["INTEGER", "DECIMAL", "PERCENTAGE", "QUANTITY", "MONEY", "RATING_5", "RATING_10"].includes(question.answerType)) {
      return <Input id={id} name={name} inputMode="decimal" dir="ltr" className={control} maxLength={40} value={value} onChange={event=>onChange(event.target.value)} required={question.required} aria-describedby={describedBy} />;
    }
    return <Input id={id} name={name} className={control} maxLength={1200} value={value} onChange={event=>onChange(event.target.value)} required={question.required} aria-describedby={describedBy} />;
  })();
  const multiple = question.answerType === "MULTIPLE_CHOICE" && question.options.length > 0;
  return (
    <div className="grid gap-2">
      {multiple ? <span className="font-medium">{question.label}{question.required ? " *" : ""}</span> : <label htmlFor={id} className="font-medium">{question.label}{question.required ? " *" : ""}</label>}
      {input}
      {question.help ? <small id={`${id}-help`} className="text-muted-foreground">{question.help}</small> : null}
    </div>
  );
}

export function QuoteInformationForm({ locale, information, messages, idempotencyKey }: { locale: "fr" | "ar"; information: QuoteInformation; messages: ClientRfqMessages; idempotencyKey: string }) {
  const [state, action, pending] = useActionState(completeRequestInformationAction, idle);
  const [answers,setAnswers]=useState<Record<string,string>>(()=>Object.fromEntries(information.questions.map(question=>[question.dataKey,question.answer])));
  const [region,setRegion]=useState(information.regionCode),[mode,setMode]=useState(information.interventionMode??"");
  const missing = information.questions.filter((question) => question.required && !question.answer.trim());
  const optional = information.questions.filter((question) => !question.required && !question.answer.trim());
  const regionMissing = !information.regionCode;
  const editable = information.status === "DRAFT" || information.status === "INFORMATION_REQUIRED";

  if (!editable) return null;
  const alreadyComplete = information.complete && !regionMissing && missing.length === 0;
  const completionNotice = alreadyComplete ? (
      <p role="status" className="client-verified">
        <CheckCircle2 className="size-4" aria-hidden />
        {messages.completeDone}
      </p>
    ) : null;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="requestId" value={information.requestId} />
      <input type="hidden" name="rowVersion" value={information.rowVersion} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {completionNotice}
      <p>{messages.completeLead}</p>
      <div className="grid gap-2"><label htmlFor="intervention-mode" className="font-medium">{locale==="fr"?"Mode d’intervention souhaité":"طريقة التدخل المطلوبة"}</label><select id="intervention-mode" name="interventionMode" className={control} value={mode} onChange={event=>setMode(event.target.value as typeof mode)}><option value="">{locale==="fr"?"Non précisé":"غير محدد"}</option><option value="ONSITE">{locale==="fr"?"Sur site":"في الموقع"}</option><option value="REMOTE">{locale==="fr"?"À distance":"عن بعد"}</option><option value="HYBRID">{locale==="fr"?"Hybride":"مختلط"}</option></select><small>{locale==="fr"?"Ce choix facultatif filtre les Prestataires selon leur mode déclaré. Aucun mode n’est déduit lorsqu’il n’est pas précisé.":"يصفّي هذا الاختيار الاختياري مقدمي الخدمة وفق الطريقة المعلنة. لا تفترض أي طريقة إذا لم يتم تحديدها."}</small></div>
      {regionMissing || missing.length ? (
        <fieldset className="grid gap-4">
          <legend className="font-semibold">{messages.completeMissing}</legend>
          {regionMissing ? (
            <div className="grid gap-2">
              <label htmlFor="complete-region" className="font-medium">{messages.region} *</label>
              <select id="complete-region" name="regionCode" className={control} required value={region} onChange={event=>setRegion(event.target.value)}>
                <option value="" disabled>{messages.chooseRegion}</option>
                {moroccoRegions.map((region) => <option key={region.code} value={region.code}>{moroccoRegionLabel(region.code, locale)}</option>)}
              </select>
            </div>
          ) : null}
          {missing.map((question) => <AnswerField key={question.dataKey} question={question} messages={messages} value={answers[question.dataKey]??""} onChange={value=>setAnswers(previous=>({...previous,[question.dataKey]:value}))} />)}
        </fieldset>
      ) : null}
      {optional.length ? (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-medium">{messages.completeOptional}</summary>
          <div className="mt-3 grid gap-4">
            {optional.map((question) => <AnswerField key={question.dataKey} question={question} messages={messages} value={answers[question.dataKey]??""} onChange={value=>setAnswers(previous=>({...previous,[question.dataKey]:value}))} />)}
          </div>
        </details>
      ) : null}
      <Button type="submit" disabled={pending} className="client-cta min-h-11 w-full sm:w-auto">{pending ? messages.creating : messages.completeSubmit}</Button>
      <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className="min-h-5 text-sm">
        {state.status === "success" ? (state.complete ? messages.completeDone : messages.completeSaved) : null}
        {state.status === "error" ? (state.reason === "VALIDATION" ? messages.validation : state.reason === "FORBIDDEN" ? messages.notEntitled : state.reason==="TAX_ORIGIN_REVIEW"?messages.taxOriginReview:messages.actionError) : null}
      </p>
    </form>
  );
}
