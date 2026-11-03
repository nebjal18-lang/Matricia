import { diagnosticQuestionIds, type DiagnosticAnswer, type DiagnosticQuestionId } from "@/modules/public/data/journey/diagnostic-contract";
export { diagnosticQuestionIds, type DiagnosticAnswer, type DiagnosticQuestionId } from "@/modules/public/data/journey/diagnostic-contract";
export type StoredDiagnostic = { version: 2; expiresAt: number; step: number; answers: Partial<Record<DiagnosticQuestionId, DiagnosticAnswer>> };

const isAnswer = (value: unknown): value is DiagnosticAnswer => typeof value === "string" || Array.isArray(value) && value.every((entry) => typeof entry === "string");

export function parseStoredDiagnostic(raw: string | null, now = Date.now()): StoredDiagnostic | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.version !== 2 || typeof value.expiresAt !== "number" || value.expiresAt <= now || !Number.isInteger(value.step) || (value.step as number) < 0 || (value.step as number) > diagnosticQuestionIds.length || typeof value.answers !== "object" || !value.answers) return null;
    const answers: StoredDiagnostic["answers"] = {};
    for (const [key, answer] of Object.entries(value.answers)) if (diagnosticQuestionIds.includes(key as DiagnosticQuestionId) && isAnswer(answer)) answers[key as DiagnosticQuestionId] = answer;
    return { version: 2, expiresAt: value.expiresAt, step: value.step as number, answers };
  } catch { return null; }
}
