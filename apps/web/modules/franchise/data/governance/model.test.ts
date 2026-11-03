import { describe, expect, it } from "vitest";
import { entryFeeSchema, franchiseeAllocation, franchiseeBeneficiaryCode, formatMinor, payoutSchema, sumExact } from "./model";

describe("franchise governance financial invariants", () => {
  it("formats and sums exact minor units beyond Number safety", () => { expect(sumExact(["9007199254740993", "7", "-1"])).toBe("9007199254740999"); expect(formatMinor("9007199254740993", "MAD", "fr")).toContain(",93"); });
  it("enforces the IT exemption shape", () => { expect(entryFeeSchema.safeParse({ bookId: crypto.randomUUID(), mode: "EXEMPT", principalMinor: "0", depositMinor: "0", withholdingBps: "", installmentCount: "", startsOn: "2026-09-10", dueOn: "2026-09-10", idempotencyKey: crypto.randomUUID() }).success).toBe(true); expect(entryFeeSchema.safeParse({ bookId: crypto.randomUUID(), mode: "EXEMPT", principalMinor: "1", depositMinor: "0", withholdingBps: "", installmentCount: "", startsOn: "2026-09-10", dueOn: "2026-09-10", idempotencyKey: crypto.randomUUID() }).success).toBe(false); });
  it("rejects non exact payout amounts", () => { expect(payoutSchema.safeParse({ bookId: crypto.randomUUID(), beneficiaryCode: "HATIM_AHMITECH", amountMinor: "1.5", journalId: crypto.randomUUID(), reference: "REF", proofHash: "a".repeat(64), idempotencyKey: crypto.randomUUID() }).success).toBe(false); });
  it("ne retient que la part franchisé, sans les autres bénéficiaires", () => {
    expect(franchiseeBeneficiaryCode("STANDARD")).toBe("FRANCHISEE");
    expect(franchiseeAllocation("STANDARD", [
      { beneficiaryCode: "NEOXA_JALIL", amountMinor: "2500" },
      { beneficiaryCode: "FRANCHISEE", amountMinor: "5000" },
      { beneficiaryCode: "ASMA_MATRICIA", amountMinor: "2500" },
    ])?.amountMinor).toBe("5000");
  });
  it("respecte les exposants monétaires, les signes et les grandes valeurs FR/AR",()=>{
    expect(formatMinor("1234","TND","fr")).toContain("1,234");
    expect(formatMinor("1234","JPY","fr")).not.toContain(",34");
    expect(formatMinor("-9007199254740993123","KWD","fr").replace(/[.\s]/gu,"")).toContain("-9007199254740993,123");
    expect(formatMinor("-1234","TND","ar")).toContain("1,234");
    expect(()=>formatMinor("12.5","MAD","fr")).toThrow("INVALID_DOCUMENT_AMOUNT");
  });
});
