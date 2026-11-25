import { describe, expect, it } from "vitest";
import {
  IT_FRANCHISE_ECONOMICS,
  PLATFORM_CORE_POT_ECONOMICS,
  allocatePlatformCorePotRemainder,
  authorityIsValid,
  canPublishMarketing,
  franchiseFinancialProposalNeedsIndependentApproval,
  noticeEvidenceClaim,
} from "./index.js";

const hash = "a".repeat(64);

describe("V4.1 legal and governance invariants", () => {
  it("accepts only an authority valid at the action time", () => {
    expect(authorityIsValid({ authorityType: "DELEGATION", verifiedAt: "2026-01-01T00:00:00Z", validUntil: "2026-12-31T23:59:59Z", evidenceHash: hash }, "2026-09-13T12:00:00Z")).toBe(true);
    expect(authorityIsValid({ authorityType: "DELEGATION", verifiedAt: "2026-01-01T00:00:00Z", validUntil: "2026-02-01T00:00:00Z", evidenceHash: hash }, "2026-09-13T12:00:00Z")).toBe(false);
  });

  it("never upgrades ordinary email to qualified delivery", () => {
    expect(() => noticeEvidenceClaim({ templateVersion: "1", recipientHash: hash, channel: "EMAIL", documentHash: hash, evidenceLevel: "QUALIFIED_DELIVERY", providerMessageId: "provider-1" })).toThrow("ORDINARY_EMAIL_IS_NOT_QUALIFIED_DELIVERY");
  });

  it("fails marketing publication closed on consent, vault, scopes, kill switch or checks", () => {
    const allowed = { consentActive: true, brandAuthorized: true, providerConnected: true, credentialInVault: true, minimalScopes: true, globalKillSwitch: false, providerKillSwitch: false, complianceChecks: { privacy: "PASS" as const, certification: "PASS" as const, price: "PASS" as const } };
    expect(canPublishMarketing(allowed)).toBe(true);
    expect(canPublishMarketing({ ...allowed, consentActive: false })).toBe(false);
    expect(canPublishMarketing({ ...allowed, providerKillSwitch: true })).toBe(false);
    expect(canPublishMarketing({ ...allowed, complianceChecks: { privacy: "FAIL" } })).toBe(false);
  });

  it("separates financial proposal and approval and preserves IT economics", () => {
    expect(franchiseFinancialProposalNeedsIndependentApproval("proposer", "approver")).toBe(true);
    expect(franchiseFinancialProposalNeedsIndependentApproval("same", "same")).toBe(false);
    expect(IT_FRANCHISE_ECONOMICS).toEqual({ operator: "HATIM_AHMITECH", entryFeeMinor: 0n, hatimShareBasisPoints: 5_000, neoxaJalilShareBasisPoints: 5_000, asmaMatriciaShareBasisPoints: 0 });
  });

  it("splits the Core+entry pot 50/50 after charges with Asma remainder", () => {
    expect(PLATFORM_CORE_POT_ECONOMICS.neoxaJalilShareBasisPoints).toBe(5_000);
    expect(PLATFORM_CORE_POT_ECONOMICS.asmaMatriciaShareBasisPoints).toBe(5_000);
    expect(allocatePlatformCorePotRemainder(10_001n)).toEqual({
      neoxaJalilMinor: 5_000n,
      asmaMatriciaMinor: 5_001n,
      roundingAdjustmentMinor: 1n,
    });
    expect(() => allocatePlatformCorePotRemainder(-1n)).toThrow("DISTRIBUTABLE_MUST_BE_NON_NEGATIVE");
  });
});
