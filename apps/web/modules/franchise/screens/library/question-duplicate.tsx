"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { duplicateFranchiseQuestion, type QuestionDuplicateState } from "./question-editor-actions";
import { editorialFailureMessage } from "./command-errors";

export function FranchiseDuplicateQuestionForm({ questionId, versionId, franchiseId, questionKey, dataKey, locale, unsaved = false }: {
  questionId: string; versionId: string; franchiseId: string; questionKey: string; dataKey: string; locale: Locale; unsaved?: boolean;
}) {
  const ar = locale === "ar";
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(async (previous: QuestionDuplicateState, form: FormData) => {
    let result: QuestionDuplicateState;
    try { result = await duplicateFranchiseQuestion(previous, form); }
    catch { result = { status: "error", reason: "UNAVAILABLE" }; }
    if (result.status === "success") setKey(crypto.randomUUID());
    return result;
  }, { status: "idle" } as QuestionDuplicateState);
  return <form action={action} className="client-card space-y-4">
    <h2>{ar ? "استنساخ السؤال" : "Dupliquer la question"}</h2>
    <p>{ar ? "تُنشأ هوية ومسودة مستقلتان في المكتبة نفسها. لا تتغير الإجابات أو الإصدارات الأصلية." : "Créez une identité et un brouillon indépendants dans la même bibliothèque. Les réponses et les versions d’origine restent conservées."}</p>
    {unsaved ? <p role="status">{ar ? "احفظوا التعديلات قبل استنساخ الإصدار المسجل." : "Enregistrez vos modifications avant de dupliquer la version enregistrée."}</p> : null}
    <input type="hidden" name="locale" value={locale} />
    <input type="hidden" name="franchiseId" value={franchiseId} />
    <input type="hidden" name="questionId" value={questionId} />
    <input type="hidden" name="versionId" value={versionId} />
    <input type="hidden" name="idempotencyKey" value={key} />
    <fieldset disabled={pending || unsaved} className="grid gap-3 sm:grid-cols-2">
      <label className="franchise-field">{ar ? "رمز السؤال الجديد" : "Code de la nouvelle question"}<input name="questionKey" defaultValue={`${questionKey.slice(0,115)}_COPY`} required pattern="[A-Z][A-Z0-9_.-]{1,119}" maxLength={120} dir="ltr" className="min-h-11 rounded border px-3" /></label>
      <label className="franchise-field">{ar ? "مفتاح البيانات الجديد" : "Nouvelle clé de donnée"}<input name="dataKey" defaultValue={`${dataKey.slice(0,155)}.copy`} required pattern="[A-Za-z][A-Za-z0-9_.-]{1,159}" maxLength={160} dir="ltr" className="min-h-11 rounded border px-3" /></label>
      <label className="franchise-field sm:col-span-2">{ar ? "سبب الاستنساخ" : "Motif de la duplication"}<input name="reason" required minLength={3} maxLength={500} className="min-h-11 rounded border px-3" /></label>
      <button type="submit" className="franchise-tool franchise-tool-primary">{pending ? (ar ? "جارٍ الاستنساخ…" : "Duplication…") : (ar ? "إنشاء مسودة مستقلة" : "Créer un brouillon indépendant")}</button>
    </fieldset>
    <div role={state.status === "error" ? "alert" : "status"} aria-live="polite">
      {state.status === "error" ? editorialFailureMessage(state.reason, locale) : state.status === "success" ? <Link href={`/${locale}/franchise/questions/${state.questionId}?franchiseId=${franchiseId}`} className="franchise-tool">{ar ? "فتح السؤال المستنسخ" : "Ouvrir la question dupliquée"}</Link> : null}
    </div>
  </form>;
}
