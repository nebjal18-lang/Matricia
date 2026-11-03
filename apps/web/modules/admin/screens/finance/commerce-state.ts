export type CommerceActionState =
  | { status: "idle" }
  | { status: "success"; outcome: string }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "FAILED" };

export const commerceIdle: CommerceActionState = { status: "idle" };
