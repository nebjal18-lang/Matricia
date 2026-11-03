"use client";

import { useActionState,useEffect,useRef,type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/modules/shared/ui/button";
import { completeLatestAction,type State } from "./actions";
import type { Messages } from "./messages";

const idle:State={status:"idle"};

export function CompleteForm({ locale, organizations, questionnaireHref, m, keyValue,serviceChoices=[],disclosure,children }: {disclosure?:{summary:string;initialOpen:boolean};children?:ReactNode; serviceChoices?:readonly{id:string;name:string}[]; locale: "fr" | "ar"; organizations: readonly { id: string; name: string; latestAt: string }[]; questionnaireHref: string; m: Messages; keyValue: string }) {
  const [state, action, pending] = useActionState(completeLatestAction, idle);
  const feedback=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(state.status!=="idle")feedback.current?.focus();},[state]);
  const hasSubmittedAssessment = organizations.length > 0;
  const form=<form action={action} className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
    <input type="hidden" name="locale" value={locale} />
    <input type="hidden" name="idempotencyKey" value={keyValue} />
    {organizations.length === 1 ? <input type="hidden" name="organizationId" value={organizations[0]!.id} /> : organizations.length > 1 ? <label className="block font-medium">{locale === "fr" ? "Entreprise concernée" : "المؤسسة المعنية"}<select name="organizationId" required className="mt-2 min-h-11 w-full rounded-md border bg-background px-3">{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(organization.latestAt))}</option>)}</select></label> : null}
    {serviceChoices.length>0?<label className="grid gap-2 font-medium">{locale==="fr"?"Périmètre de service à analyser":"نطاق الخدمة المطلوب تحليله"}<select name="analysisServiceId" defaultValue="" className="min-h-11 rounded border p-3"><option value="">{locale==="fr"?"Suivre les règles publiées":"اتباع القواعد المنشورة"}</option>{serviceChoices.map(choice=><option key={choice.id} value={choice.id}>{choice.name}</option>)}</select><small className="font-normal">{locale==="fr"?"Ce contexte facultatif est utilisé uniquement si les règles publiées ne désignent pas déjà un service. Aucun service n’est choisi automatiquement.":"يستخدم هذا السياق الاختياري فقط إذا لم تحدد القواعد المنشورة خدمة. لا يتم اختيار أي خدمة تلقائياً."}</small></label>:null}
    <div><h2 className="text-xl font-semibold">{m.prepareTitle}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{hasSubmittedAssessment ? m.prepareDescription : m.noSubmittedAssessment}</p></div>
    {hasSubmittedAssessment ? <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3"><input type="checkbox" name="confirmSnapshot" value="CONFIRMED" required className="mt-0.5 size-5 shrink-0" /><span><strong>{m.confirmAnalysis}</strong><span className="mt-1 block text-sm text-muted-foreground">{m.recalculationNote}</span></span></label> : <p><Link href={questionnaireHref} className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">{locale === "fr" ? "Commencer le questionnaire" : "بدء الاستبيان"}</Link></p>}
    {hasSubmittedAssessment ? <Button disabled={pending} className="min-h-11 w-full sm:w-auto">{pending ? m.calculating : m.complete}</Button> : null}
  </form>;
  return <section aria-label={m.prepareTitle} className="space-y-3">{disclosure?<details id="analyse" className="client-ops" open={disclosure.initialOpen}><summary>{disclosure.summary}</summary>{form}{children}</details>:<>{form}{children}</>}
    {state.status!=="idle"?<p ref={feedback} tabIndex={-1} role={state.status==="error"?"alert":"status"} aria-live="polite" className={state.status==="error"?"text-sm text-destructive outline-offset-4":"text-sm text-primary outline-offset-4"}>{state.status==="error"?(state.reason === "VALIDATION" ? m.validation : state.reason === "NO_SUBMITTED_ASSESSMENT" ? m.noSubmittedAssessment : state.reason === "ANALYSIS_SCOPE_REQUIRED" ? m.analysisScopeRequired : state.reason==="PUBLISHED_POLICY_REQUIRED"?m.publishedPolicyRequired:m.error):<>{m.success}{state.diagnosticRunId?<><span> </span><Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/client/diagnostics/${state.diagnosticRunId}${state.organizationId?`?${new URLSearchParams({organizationId:state.organizationId})}`:""}`}>{locale==="fr"?"Consulter le rapport créé":"عرض التقرير الذي تم إنشاؤه"}</Link></>:null}</>}</p>:null}
  </section>;
}

