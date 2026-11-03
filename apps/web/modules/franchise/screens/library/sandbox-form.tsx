"use client";
import { editorialFailureMessage } from "./command-errors";

import { useActionState, useId } from "react";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import type { FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { simulateFranchiseQuestionnaireAction, type FranchiseSimulationActionState } from "./actions";

const initial: FranchiseSimulationActionState = { status: "idle" };

export function FranchiseQuestionnaireSandbox({
  locale,
  workspace,
  organizationId,
  selectedQuestionnaireId,
}: {
  locale: Locale;
  workspace: FranchiseLibraryWorkspace;
  organizationId: string | null;
  selectedQuestionnaireId: string | null;
}) {
  const c = libraryCopy(locale);
  const prefix = useId();
  const [state, action, pending] = useActionState(simulateFranchiseQuestionnaireAction, initial);
  const selected = workspace.questionnaires.find((item) => item.id === selectedQuestionnaireId) ?? workspace.questionnaires[0] ?? null;
  const links = (workspace.compositionQuestions ?? []).filter((item) => item.versionId === selected?.questionnaireVersionId).sort((a,b)=>a.sortOrder-b.sortOrder);
  const questions = links.flatMap((link)=>{const q=workspace.questionVersionBank?.find((q)=>q.id===link.questionVersionId);return q?[q]:[];});
  const error = state.status === "error"
    ? state.reason === "MANDATE_REQUIRED" || state.reason === "UNAUTHENTICATED" ? editorialFailureMessage(state.reason,locale) : state.reason === "FORBIDDEN" ? c.forbidden : state.reason === "VALIDATION" ? (locale === "ar" ? "تحققوا من الحقول." : "Complétez la simulation.") : c.unavailable
    : null;
  if (!selected?.questionnaireVersionId) return <p className="client-access-note">{c.simulationPending}</p>;
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={workspace.mandate.libraryId} />
      <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="questionnaireId" value={selected.id} />
      <input type="hidden" name="questionnaireVersionId" value={selected.questionnaireVersionId} />
      {questions.map((question,index)=><label key={question.id} className="franchise-field" htmlFor={`${prefix}-${index}`}><span>{locale === "ar" ? question.labelAr : question.labelFr}</span>
        <small>{question.answerType} · {locale === "ar" ? "اتركوه فارغاً لعدم الإجابة. تستخدم الخيارات قيمة JSON المحفوظة." : "Laissez vide pour une réponse absente. Les choix utilisent leur valeur JSON enregistrée."}</small>
        {question.answerType === "YES_NO" ? <select id={`${prefix}-${index}`} name={`answer:${question.id}`} defaultValue=""><option value="">—</option><option value="true">{locale === "ar"?"نعم":"Oui"}</option><option value="false">{locale === "ar"?"لا":"Non"}</option></select>
        : <input id={`${prefix}-${index}`} name={`answer:${question.id}`} type={question.answerType === "DATE" ? "date" : "text"} maxLength={10000} className="min-h-11 w-full rounded-md border px-3"/>}
      </label>)}
      <button type="submit" className="franchise-tool franchise-tool-primary" disabled={pending}>{c.runSimulation}</button>
      <p role={error ? "alert" : "status"} aria-live="polite">
        {error ?? (state.status === "success" ? `${c.questionnaireSimulated} (${state.detail})` : c.sandboxHelp)}
      </p>
      {state.status === "success" && state.evaluation ? <section aria-label={locale === "ar"?"نتائج المحاكاة":"Résultats de simulation"}><dl><dt>{locale === "ar"?"النقاط الأساسية":"Score en points de base"}</dt><dd>{state.evaluation.scoreBasisPoints}</dd><dt>{locale === "ar"?"إصدار المحرك":"Version du moteur"}</dt><dd>{state.evaluation.engineVersion}</dd></dl><ul>{state.evaluation.actions.map((item,index)=><li key={index}><strong>{item.type}</strong>{item.target?` · ${item.target}`:""}<pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(item,null,2)}</pre></li>)}</ul></section>:null}
    </form>
  );
}
