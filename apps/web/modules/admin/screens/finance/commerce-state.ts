export type CommerceActionState =
  | { status: "idle" }
  | { status: "success"; outcome: string }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "CONFLICT" | "FAILED" };

export const commerceIdle: CommerceActionState = { status: "idle" };
