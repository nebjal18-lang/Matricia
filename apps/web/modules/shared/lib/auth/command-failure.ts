/** Public action categories only: provider/SQL messages must never reach the UI. */
export type CommandFailureReason = "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "FAILED";
export function classifyCommandFailure(error: { code?: string; message?: string; status?: number }): CommandFailureReason {
  if (error.status === 401 || error.code === "PGRST301" || error.code === "28000") return "UNAUTHENTICATED";
  if (error.code === "42501") return /(?:AAL2|MFA|SECOND_FACTOR|ASSURANCE_LEVEL)/i.test(error.message ?? "") ? "MFA_REQUIRED" : "FORBIDDEN";
  if (error.status === 403) return "FORBIDDEN";
  if (["23505", "40001", "55000"].includes(error.code ?? "") || /(?:STALE_|IDEMPOTENCY)/.test(error.message ?? "")) return "CONFLICT";
  if (["22023", "23514", "22P02", "22003"].includes(error.code ?? "")) return "VALIDATION";
  return "FAILED";
}
