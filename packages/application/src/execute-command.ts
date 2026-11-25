import { commandFailure, type CommandResult } from "../../contracts/src/command-result";

/** Adapter supplies authenticated transport; SQL remains authoritative for role checks,
 * transactions, idempotency, audit and outbox. No mutation is retried here. */
export async function executeCommand(input: {
  correlationId: string;
  authenticate: () => Promise<{ authenticated: boolean; error: boolean }>;
  execute: () => PromiseLike<{ error: { code?: string } | null }>;
}): Promise<CommandResult> {
  try {
    const auth = await input.authenticate();
    if (auth.error) return commandFailure(null, input.correlationId);
    if (!auth.authenticated) return { status: "error", code: "UNAUTHENTICATED", correlationId: input.correlationId };
    const result = await input.execute();
    return result.error ? commandFailure(result.error, input.correlationId) : { status: "success" };
  } catch {
    return commandFailure(null, input.correlationId);
  }
}
