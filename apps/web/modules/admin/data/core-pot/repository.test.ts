import { beforeEach, describe, expect, it, vi } from "vitest";
import { ingestAdminPlatformCorePotSource } from "./repository";

const mocks = vi.hoisted(() => ({ access: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({
  loadMyPlatformAccess: mocks.access,
  hasPlatformRole: (roles: Set<string>, allowed: readonly string[]) => allowed.some((role) => roles.has(role)),
}));

const bookId = "11111111-1111-4111-8111-111111111111";
const journalId = "22222222-2222-4222-8222-222222222222";
const entryId = "33333333-3333-4333-8333-333333333333";
const correlationId = "44444444-4444-4444-8444-444444444444";

const rpcSuccess = {
  outcome: "PLATFORM_CORE_POT_SOURCE_INGESTED",
  source_type: "CREDIT_REVENUE_LEDGER",
  source_id: "9001",
  amount_minor: "12000",
  category: "CORE_SUBSCRIPTION_REVENUE_ACQUIRED",
  post: { outcome: "PLATFORM_CORE_POT_ENTRY_POSTED", entry_id: entryId },
};

const authorized = (roles = ["FINANCE_MANAGER"], satisfied = true) => ({
  status: "ok" as const,
  client: { rpc: mocks.rpc },
  roles: new Set(roles),
  requirementSatisfied: satisfied,
  email: "finance@example.invalid",
  userId: bookId,
});

beforeEach(() => {
  mocks.access.mockReset().mockResolvedValue(authorized());
  mocks.rpc.mockReset().mockResolvedValue({ data: rpcSuccess, error: null });
});

describe("ingestAdminPlatformCorePotSource", () => {
  it("posts a validated credit revenue ledger row through the native ingest RPC", async () => {
    const result = await ingestAdminPlatformCorePotSource({
      bookId,
      financialJournalId: journalId,
      creditRevenueLedgerId: "9001",
      reason: "Acquisition Core validée",
      idempotencyKey: "INGEST-CORE-9001",
      correlationId,
    });
    expect(result).toMatchObject({
      status: "success",
      value: { outcome: "PLATFORM_CORE_POT_SOURCE_INGESTED", entryId, sourceType: "CREDIT_REVENUE_LEDGER", sourceId: "9001" },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("ingest_platform_core_pot_sources_v1", {
      p_book_id: bookId,
      p_financial_journal_id: journalId,
      p_credit_revenue_ledger_id: "9001",
      p_franchise_entry_fee_ledger_id: null,
      p_reason: "Acquisition Core validée",
      p_idempotency_key: "INGEST-CORE-9001",
      p_correlation_id: correlationId,
    });
  });

  it("preserves exact bigint ledger ids beyond Number.MAX_SAFE_INTEGER", async () => {
    const largeId = "9007199254740993";
    await ingestAdminPlatformCorePotSource({
      bookId,
      financialJournalId: journalId,
      creditRevenueLedgerId: largeId,
      reason: "Acquisition Core validée",
      idempotencyKey: "INGEST-CORE-LARGE",
      correlationId,
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "ingest_platform_core_pot_sources_v1",
      expect.objectContaining({ p_credit_revenue_ledger_id: largeId }),
    );
    // Guard: Number() would round this value — the RPC must receive the original string.
    expect(Number(largeId)).toBe(9007199254740992);
    expect(String(Number(largeId))).not.toBe(largeId);
  });

  it("requires exactly one source identifier", async () => {
    expect(
      await ingestAdminPlatformCorePotSource({
        bookId,
        financialJournalId: journalId,
        reason: "Sans source",
        idempotencyKey: "INGEST-MISSING",
        correlationId,
      }),
    ).toEqual({ status: "error", reason: "INVALID_INPUT" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps IT entry-fee exclusion conflicts from the database", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "IT_ENTRY_FEE_EXCLUDED_FROM_PLATFORM_POT" } });
    const result = await ingestAdminPlatformCorePotSource({
      bookId,
      financialJournalId: journalId,
      franchiseEntryFeeLedgerId: "42",
      reason: "Droit d'entrée encaissé",
      idempotencyKey: "INGEST-FEE-42",
      correlationId,
    });
    expect(result).toEqual({ status: "error", reason: "CONFLICT" });
  });
});
