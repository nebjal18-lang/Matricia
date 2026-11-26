export type CommandContext = Readonly<{ actorId: string; organizationId: string; correlationId: string; idempotencyKey?: string }>;

export * from "./execute-command";
