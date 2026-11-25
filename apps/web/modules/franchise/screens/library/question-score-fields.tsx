"use client";
import { scoredChoices, type ScoredChoice } from "@/modules/shared/lib/questionnaire-sessions/question-scoring";

export function QuestionScoreFields({ payload, locale, onChange }: { payload: Record<string, unknown>; locale: "fr" | "ar"; onChange: (name: string, value: unknown) => void }) {
  const ar = locale === "ar";
  const choice = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(String(payload.answer_type));
  const choices = choice ? scoredChoices(payload.options) : [];
  function setChoices(next: ScoredChoice[]) {
    onChange("options", next.map((item, index) => ({ value: item.value || `OPT_${index + 1}`, label_fr: item.labelFr, label_ar: item.labelAr, score: item.score })));
  }
  return <div className="grid gap-3">
    <div className="grid gap-3 sm:grid-cols-2">
      <label>{ar ? "الوزن" : "Poids"}<input value={scoreText(payload.weight)} onChange={(event) => onChange("weight", event.target.value)} inputMode="decimal" pattern="(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?" required dir="ltr" className="min-h-11 w-full rounded border px-3" /></label>
      <label>{ar ? "الدرجة القصوى" : "Note maximale"}<input value={scoreText(payload.maximum_score)} onChange={(event) => onChange("maximum_score", event.target.value)} inputMode="decimal" pattern="(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?" required dir="ltr" className="min-h-11 w-full rounded border px-3" /></label>
    </div>
    <p className="text-sm text-muted-foreground">{ar ? "النسبة = مجموع (درجة الإجابة × الوزن) / مجموع (الدرجة القصوى × الوزن) × 100. الوزن 0 أو الدرجة القصوى 0 يُخرج السؤال من الحساب." : "Le pourcentage vaut la somme (note de la réponse × poids) / somme (note maximale × poids) × 100. Un poids ou une note maximale à 0 exclut la question."}</p>
    {choice ? <fieldset className="grid gap-3"><legend>{ar ? "اختيارات السؤال ودرجة كل اختيار" : "Choix et note de chaque choix"}</legend>{choices.map((choiceRow, index) => <div key={choiceRow.value || index} className="grid gap-2 rounded border p-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
      <label>{ar ? "الصياغة بالفرنسية" : "Libellé (FR)"}<input value={choiceRow.labelFr} onChange={(event) => setChoices(choices.map((item, itemIndex) => itemIndex === index ? { ...item, labelFr: event.target.value } : item))} required maxLength={500} dir="ltr" className="min-h-11 w-full rounded border px-3" /></label>
      <label>{ar ? "الصياغة بالعربية" : "Libellé (AR)"}<input value={choiceRow.labelAr} onChange={(event) => setChoices(choices.map((item, itemIndex) => itemIndex === index ? { ...item, labelAr: event.target.value } : item))} required maxLength={500} dir="rtl" className="min-h-11 w-full rounded border px-3" /></label>
      <label>{ar ? "الدرجة" : "Note"}<input value={choiceRow.score} onChange={(event) => setChoices(choices.map((item, itemIndex) => itemIndex === index ? { ...item, score: event.target.value } : item))} inputMode="decimal" required dir="ltr" className="min-h-11 w-full rounded border px-3" /></label>
      <button type="button" className="franchise-tool self-end" onClick={() => setChoices(choices.filter((_, itemIndex) => itemIndex !== index))}>{ar ? "حذف" : "Retirer"}</button>
    </div>)}<button type="button" className="franchise-tool" onClick={() => setChoices([...choices, { value: `OPT_${choices.reduce((max, item) => Math.max(max, Number(item.value.replace("OPT_", "")) || 0), 0) + 1}`, labelFr: "", labelAr: "", score: "0" }])}>{ar ? "إضافة اختيار" : "Ajouter un choix"}</button></fieldset> : null}
  </div>;
}

function scoreText(value: unknown): string { return typeof value === "number" || typeof value === "string" ? String(value) : "0"; }
