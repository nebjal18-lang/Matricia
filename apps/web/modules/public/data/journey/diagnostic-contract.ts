export const diagnosticQuestionIds = ["sector", "team_size", "goals", "priority_tracking", "sales_tracking", "backup_restore", "decision_trace", "next_action"] as const;
export type DiagnosticQuestionId = typeof diagnosticQuestionIds[number];
export type DiagnosticAnswer = string | string[];
export type DiagnosticAnswers = Partial<Record<DiagnosticQuestionId, DiagnosticAnswer>>;

export const diagnosticOptionIds: Record<Exclude<DiagnosticQuestionId, "next_action">, readonly string[]> = {
  sector: ["industry_logistics", "commerce", "professional_services", "construction", "other"],
  team_size: ["solo", "small", "medium", "large"],
  goals: ["save_time", "control_costs", "grow_sales", "secure_activity", "global_review"],
  priority_tracking: ["regular", "partial", "no", "unknown"],
  sales_tracking: ["shared", "manual", "ad_hoc", "unknown"],
  backup_restore: ["recent", "old", "no", "unknown", "not_applicable"],
  decision_trace: ["systematic", "partial", "no", "unknown"],
};
