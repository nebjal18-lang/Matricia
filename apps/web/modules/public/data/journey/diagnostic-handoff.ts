import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { getPublicJourneyCopy } from "./copy";
import { diagnosticOptionIds, diagnosticQuestionIds, type DiagnosticAnswers, type DiagnosticQuestionId } from "./diagnostic-contract";
import { computePriorities, type PriorityKey } from "./diagnostic-priorities";
import { parseStoredDiagnostic } from "@/modules/public/ui/journey/diagnostic-storage";

export function isDiagnosticPriority(value: unknown): value is PriorityKey {
  return value === "organization" || value === "sales" || value === "security" || value === "verify";
}

function declaredAnswer(locale: Locale, answers: DiagnosticAnswers, id: DiagnosticQuestionId): string | null {
  const answer = answers[id];
  if (answer === undefined) return null;
  if (id === "next_action") return typeof answer === "string" ? answer.trim().slice(0, 500) : null;
  const options = diagnosticOptionIds[id];
  const labels = getPublicJourneyCopy(locale).diagnostic.questions[diagnosticQuestionIds.indexOf(id)]?.[2] ?? [];
  const values = Array.isArray(answer) ? answer : [answer];
  const translated = values.map((value) => labels[options.indexOf(value)]).filter((value): value is string => Boolean(value));
  return translated.length ? translated.join(locale === "ar" ? "، " : ", ") : null;
}

export function diagnosticNeedHandoff(raw: string | null, priority: unknown, locale: Locale, now = Date.now()): { need: string; constraints: string; priority: PriorityKey } | null {
  if (!isDiagnosticPriority(priority)) return null;
  const stored = parseStoredDiagnostic(raw, now);
  if (!stored || stored.step !== diagnosticQuestionIds.length || !computePriorities(stored.answers).includes(priority)) return null;
  const copy = getPublicJourneyCopy(locale).diagnostic;
  const title = copy.priorities[priority][0];
  const action = declaredAnswer(locale, stored.answers, "next_action");
  const need = [action || copy.priorities[priority][3], locale === "ar" ? `الأولوية المختارة: ${title}` : `Priorité choisie : ${title}`].join("\n").slice(0, 1000);
  const fields = (["sector", "team_size", "goals", "priority_tracking", "sales_tracking", "backup_restore", "decision_trace"] as const)
    .map((id) => {
      const value = declaredAnswer(locale, stored.answers, id);
      return value ? `${copy.questionLabels[id]} : ${value}` : null;
    }).filter((line): line is string => Boolean(line));
  if (stored.answers.sector === "construction" && Array.isArray(stored.answers.goals) && stored.answers.goals.includes("control_costs")) {
    fields.push(locale === "ar" ? "ربحية كل ورش يجب قياسها؛ التكاليف والهوامش غير معروفة بعد." : "Rentabilité par chantier à mesurer : coûts et marges non renseignés.");
  }
  return { need, constraints: fields.join("\n").slice(0, 1200), priority };
}
