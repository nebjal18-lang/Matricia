import { decideGovernance } from "@/modules/franchise/screens/gouvernance/actions";

export async function decideFranchiseMandate(formData: FormData) {
  const decided = await decideGovernance({ status: "idle" }, formData);
  if (decided.status === "error") {
    const reason = decided.reason === "FORBIDDEN" || decided.reason === "UNAUTHENTICATED" ? "DENIED" as const
      : decided.reason === "MFA_REQUIRED" || decided.reason === "AAL2_REQUIRED" ? "MFA_REQUIRED" as const
      : decided.reason === "CONFLICT" ? "CONFLICT" as const
      : decided.reason === "VALIDATION" ? "VALIDATION" as const
      : "UNAVAILABLE" as const;
    return { status: "error" as const, reason };
  }
  return decided;
}
