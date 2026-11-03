"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { bookOpeningInput, bookOpeningContext, classifyBookOpeningFailure, type BookOpeningContext, type BookOpeningFailure, type BookOpeningState } from "@/modules/franchise/data/governance/book-opening";

async function financeAccess() {
  const access = await loadMyPlatformAccess();
  if (access.status === "error") return { status: "error" as const, reason: access.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" as const : "UNAVAILABLE" as const };
  if (!["SUPER_ADMIN", "FINANCE_MANAGER"].some(role => access.roles.has(role))) return { status: "error" as const, reason: "FORBIDDEN" as const };
  if (!access.requirementSatisfied) return { status: "error" as const, reason: "MFA_REQUIRED" as const };
  const assurance = await access.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return { status: "error" as const, reason: classifyAuthReadFailure(assurance.error) === "UNAUTHENTICATED" ? "UNAUTHENTICATED" as const : "UNAVAILABLE" as const };
  if (assurance.data?.currentLevel !== "aal2") return { status: "error" as const, reason: "MFA_REQUIRED" as const };
  return { status: "success" as const, client: access.client };
}
export async function loadBookOpeningContext(franchiseId?: string): Promise<{ status: "success"; context: BookOpeningContext } | { status: "error"; reason: BookOpeningFailure }> {
  if (franchiseId && !z.string().uuid().safeParse(franchiseId).success) return { status: "error", reason: "VALIDATION" };
  try {
    const access = await financeAccess(); if (access.status === "error") return access;
    const result = await access.client.rpc("franchise_book_opening_context_v1", { p_franchise_id: franchiseId ?? null });
    if (result.error) return { status: "error", reason: classifyBookOpeningFailure(result.error) };
    const parsed = bookOpeningContext.safeParse(result.data);
    return parsed.success ? { status: "success", context: parsed.data } : { status: "error", reason: "UNAVAILABLE" };
  } catch (error) { unstable_rethrow(error); return { status: "error", reason: "UNAVAILABLE" }; }
}
export async function openFranchiseBookForMandate(_: BookOpeningState, form: FormData): Promise<BookOpeningState> {
  const parsed = bookOpeningInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };
  try {
    const access = await financeAccess(); if (access.status === "error") return access;
    const value = parsed.data;
    const result = await access.client.rpc("open_franchise_pnl_book_for_mandate_v1", {
      p_franchise_id: value.franchiseId, p_approved_mandate_version_id: value.approvedMandateVersionId,
      p_expected_mandate_hash: value.expectedMandateHash, p_currency: value.currency,
      p_rule_version_id: value.financeRuleId, p_idempotency_key: value.idempotencyKey,
    });
    if (result.error) return { status: "error", reason: classifyBookOpeningFailure(result.error) };
    const receipt = z.object({ outcome: z.literal("FRANCHISE_PNL_BOOK_OPENED"), book_id: z.string().uuid(), franchise_id: z.literal(value.franchiseId), approved_mandate_version_id: z.literal(value.approvedMandateVersionId), basis_hash: z.string().regex(/^[0-9a-f]{64}$/) }).safeParse(result.data);
    if (!receipt.success) return { status: "error", reason: "UNAVAILABLE" };
    revalidatePath(`/${value.locale}/administration/gouvernance`);
    revalidatePath(`/${value.locale}/administration/gouvernance-franchise/livres`);
    revalidatePath(`/${value.locale}/franchise/gouvernance`);
    return { status: "success", bookId: receipt.data.book_id, franchiseId: value.franchiseId };
  } catch (error) { unstable_rethrow(error); return { status: "error", reason: "UNAVAILABLE" }; }
}
