export type CommandErrorCode = "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "NOT_FOUND" | "UNAVAILABLE";
export type CommandFailure = Readonly<{ status: "error"; code: CommandErrorCode; correlationId: string }>;
export type CommandResult = Readonly<{ status: "success" }> | CommandFailure;
export type CommandState = Readonly<{ status: "idle" }> | CommandResult;

/** Only SQLSTATE is classified. Database messages and details never cross the boundary. */
export function commandFailure(error: { code?: string } | null, correlationId: string): CommandFailure {
  const code = error?.code;
  return { status: "error", correlationId, code:
    code === "42501" ? "FORBIDDEN" :
    code === "23505" || (code === "40001" || code === "PT409") || code === "40P01" ? "CONFLICT" :
    code?.startsWith("22") || code === "23514" || code === "23502" ? "VALIDATION" :
    "UNAVAILABLE" };
}
