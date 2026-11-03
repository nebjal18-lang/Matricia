import type { DiagnosticAnswers, DiagnosticQuestionId } from "./diagnostic-contract";

export type PriorityKey = "organization" | "sales" | "security" | "verify";

export function diagnosticPriorityTriggers(answers: DiagnosticAnswers): Record<PriorityKey, DiagnosticQuestionId[]> {
  const triggers: Record<PriorityKey, DiagnosticQuestionId[]> = { organization: [], sales: [], security: [], verify: [] };
  const goals = Array.isArray(answers.goals) ? answers.goals : [];
  if (answers.priority_tracking === "no" || answers.priority_tracking === "partial") triggers.organization.push("priority_tracking");
  if (answers.sales_tracking === "manual" || answers.sales_tracking === "ad_hoc") triggers.sales.push("sales_tracking");
  if (goals.includes("grow_sales") && answers.sales_tracking !== "shared") {
    triggers.sales.push("goals");
    if (answers.sales_tracking !== undefined && !triggers.sales.includes("sales_tracking")) triggers.sales.push("sales_tracking");
  }
  if (answers.backup_restore === "no") triggers.security.push("backup_restore");
  if (goals.includes("secure_activity") && answers.backup_restore === "old") triggers.security.push("goals", "backup_restore");
  for (const id of ["priority_tracking", "sales_tracking", "backup_restore", "decision_trace"] as const) {
    if (answers[id] === "unknown") triggers.verify.push(id);
  }
  return triggers;
}

export function computePriorities(answers: DiagnosticAnswers): PriorityKey[] {
  const triggers = diagnosticPriorityTriggers(answers);
  return (Object.keys(triggers) as PriorityKey[]).filter((key) => triggers[key].length > 0).slice(0, 3);
}
