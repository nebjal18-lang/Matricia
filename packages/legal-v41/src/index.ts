export type EvidenceLevel = "ORDINARY_DELIVERY" | "IN_APP_VIEW" | "REGISTERED_DELIVERY" | "QUALIFIED_DELIVERY";
export type PublicationProvider = "LINKEDIN" | "META";

export interface ContractAuthority {
  authorityType: "LEGAL_REPRESENTATIVE" | "DELEGATION" | "POWER_OF_ATTORNEY";
  verifiedAt: string;
  validUntil?: string;
  evidenceHash: string;
}

export interface ProbativeNotice {
  templateVersion: string;
  recipientHash: string;
  channel: "EMAIL" | "IN_APP" | "REGISTERED_EMAIL" | "POSTAL";
  documentHash: string;
  evidenceLevel: EvidenceLevel;
  providerMessageId?: string;
}

export interface MarketingPublicationGate {
  consentActive: boolean;
  brandAuthorized: boolean;
  providerConnected: boolean;
  credentialInVault: boolean;
  minimalScopes: boolean;
  globalKillSwitch: boolean;
  providerKillSwitch: boolean;
  complianceChecks: Readonly<Record<string, "PASS" | "FAIL">>;
}

const HASH_64 = /^[0-9a-f]{64}$/;

export function authorityIsValid(authority: ContractAuthority, at: string): boolean {
  const checkedAt = Date.parse(at);
  const verifiedAt = Date.parse(authority.verifiedAt);
  const validUntil = authority.validUntil === undefined ? Number.POSITIVE_INFINITY : Date.parse(authority.validUntil);
  return HASH_64.test(authority.evidenceHash) && Number.isFinite(checkedAt) && Number.isFinite(verifiedAt) && checkedAt >= verifiedAt && checkedAt <= validUntil;
}

export function noticeEvidenceClaim(notice: ProbativeNotice): EvidenceLevel {
  if (!HASH_64.test(notice.documentHash) || !HASH_64.test(notice.recipientHash) || notice.templateVersion.trim() === "") {
    throw new Error("INVALID_PROBATIVE_NOTICE");
  }
  if (notice.channel === "EMAIL" && notice.evidenceLevel === "QUALIFIED_DELIVERY") {
    throw new Error("ORDINARY_EMAIL_IS_NOT_QUALIFIED_DELIVERY");
  }
  if ((notice.evidenceLevel === "REGISTERED_DELIVERY" || notice.evidenceLevel === "QUALIFIED_DELIVERY") && !notice.providerMessageId) {
    throw new Error("PROVIDER_EVIDENCE_REQUIRED");
  }
  return notice.evidenceLevel;
}

export function canPublishMarketing(input: MarketingPublicationGate): boolean {
  return input.consentActive
    && input.brandAuthorized
    && input.providerConnected
    && input.credentialInVault
    && input.minimalScopes
    && !input.globalKillSwitch
    && !input.providerKillSwitch
    && Object.values(input.complianceChecks).length > 0
    && Object.values(input.complianceChecks).every((status) => status === "PASS");
}

export function franchiseFinancialProposalNeedsIndependentApproval(
  proposalActorId: string,
  approvalActorId: string,
): boolean {
  return proposalActorId.trim() !== "" && approvalActorId.trim() !== "" && proposalActorId !== approvalActorId;
}

export const IT_FRANCHISE_ECONOMICS = Object.freeze({
  operator: "HATIM_AHMITECH",
  entryFeeMinor: 0n,
  hatimShareBasisPoints: 5_000,
  neoxaJalilShareBasisPoints: 5_000,
  asmaMatriciaShareBasisPoints: 0,
});

/** Core subscription + non-IT entry fees, after marketing/charges — distinct from franchise P&L. */
export const PLATFORM_CORE_POT_ECONOMICS = Object.freeze({
  distributionBasis: "DISTRIBUTABLE_PLATFORM_POT" as const,
  neoxaJalilShareBasisPoints: 5_000,
  asmaMatriciaShareBasisPoints: 5_000,
  roundingBeneficiary: "ASMA_MATRICIA" as const,
  revenueCategories: Object.freeze(["CORE_SUBSCRIPTION_REVENUE_ACQUIRED", "ENTRY_FEE_ACQUIRED"] as const),
  deductionCategories: Object.freeze(["REFUND_CREDIT_NOTE", "MARKETING_COST", "OPERATING_CHARGE"] as const),
});

/** Exact bigint split for the platform pot remainder (Asma receives the rounding remainder). */
export function allocatePlatformCorePotRemainder(distributableMinor: bigint): {
  neoxaJalilMinor: bigint;
  asmaMatriciaMinor: bigint;
  roundingAdjustmentMinor: bigint;
} {
  if (distributableMinor < 0n) throw new RangeError("DISTRIBUTABLE_MUST_BE_NON_NEGATIVE");
  const neoxa = (distributableMinor * BigInt(PLATFORM_CORE_POT_ECONOMICS.neoxaJalilShareBasisPoints)) / 10_000n;
  const asmaBase = (distributableMinor * BigInt(PLATFORM_CORE_POT_ECONOMICS.asmaMatriciaShareBasisPoints)) / 10_000n;
  const rem = distributableMinor - neoxa - asmaBase;
  return { neoxaJalilMinor: neoxa, asmaMatriciaMinor: asmaBase + rem, roundingAdjustmentMinor: rem };
}
