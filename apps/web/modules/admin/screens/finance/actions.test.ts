import { beforeEach, describe, expect, it, vi } from "vitest";

const { reconcile, revalidate } = vi.hoisted(() => ({ reconcile: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/modules/admin/data/finance/repository", () => ({ reconcileAdminProviderPayment: reconcile }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: vi.fn(), hasPlatformRole: vi.fn() }));
import { reconcilePaymentAction } from "./actions";

const fields = {
  locale: "fr", confirmed: "yes",
  paymentId: "00000000-0000-4000-8000-000000000001",
  invoiceId: "00000000-0000-4000-8000-000000000002",
  amountMinor: "9007199254740993",
  idempotencyKey: "00000000-0000-4000-8000-000000000003",
  correlationId: "00000000-0000-4000-8000-000000000004",
};
function form(overrides: Partial<typeof fields> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...fields, ...overrides })) data.set(key, value);
  return data;
}

describe("finance reconciliation server action", () => {
  beforeEach(() => { reconcile.mockReset(); revalidate.mockReset(); });

  it.each([{ confirmed: "" }, { confirmed: "true" }, { locale: "en" }, { locale: "../ar" }])(
    "rejects invalid confirmation or locale before mutation: %j", async (override) => {
      expect(await reconcilePaymentAction({ status: "idle" }, form(override))).toEqual({ status: "error", reason: "VALIDATION" });
      expect(reconcile).not.toHaveBeenCalled();
      expect(revalidate).not.toHaveBeenCalled();
    },
  );

  it.each(["fr", "ar"])("preserves exact amounts and request identity for %s", async (locale) => {
    reconcile.mockResolvedValue({ status: "success", value: { batchId: "batch-receipt" } });
    expect(await reconcilePaymentAction({ status: "idle" }, form({ locale }))).toEqual({ status: "success", batchId: "batch-receipt" });
    expect(reconcile).toHaveBeenCalledExactlyOnceWith({
      paymentId: fields.paymentId, invoiceId: fields.invoiceId, amountMinor: fields.amountMinor,
      idempotencyKey: fields.idempotencyKey, correlationId: fields.correlationId,
    });
    expect(revalidate).toHaveBeenCalledExactlyOnceWith(`/${locale}/administration/finance`);
  });

  it.each([
    ["INVALID_INPUT", "VALIDATION"], ["INVALID_RESPONSE", "VALIDATION"],
    ["UNAUTHENTICATED", "UNAUTHENTICATED"], ["FORBIDDEN", "FORBIDDEN"],
    ["CONFLICT", "CONFLICT"], ["UNAVAILABLE", "FAILED"], ["MFA_REQUIRED", "FAILED"],
  ])("returns %s without reporting success or refreshing data", async (reason, expected) => {
    reconcile.mockResolvedValue({ status: "error", reason });
    expect(await reconcilePaymentAction({ status: "idle" }, form())).toEqual({ status: "error", reason: expected });
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(revalidate).not.toHaveBeenCalled();
  });
});
