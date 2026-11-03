import type { ClientOrganization, ClientRequestSummary, QuoteComparison, QuoteComparisonRow } from "./model";

export type FailureReason = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "INVALID_RESPONSE" | "TAX_POLICY_REQUIRED" | "TAX_ORIGIN_REVIEW" | "CATALOG_REVIEW" | "MFA_REQUIRED" | "UNAVAILABLE";
export type Result<T> = { status: "success"; value: T } | { status: "error"; reason: FailureReason };
export type ClientRfqRepository = {
  list(): Promise<Result<{ organizations: ClientOrganization[]; requests: ClientRequestSummary[] }>>;
  detail(requestId: string): Promise<Result<ClientRequestSummary | null>>;
  comparison(rfqId: string): Promise<Result<QuoteComparison | null>>;
  create(input: { organizationId: string; libraryId: string; serviceId: string; questionnaireVersionId: string; description: string; urgency: string; desiredDate: string | null; budgetMinor: string | null; currency: string; regionCode: string; catalogSnapshotHash: string; questionnaireSnapshotHash: string; changeReason: string; idempotencyKey: string; correlationId: string }): Promise<Result<{ requestId: string; status: string }>>;
  ready(input: { requestId: string; rowVersion: number; reason: string; idempotencyKey: string; correlationId: string }): Promise<Result<{ requestId: string; rowVersion: number }>>;
  match(input: { requestId: string; targetPanelSize: number; idempotencyKey: string; correlationId: string }): Promise<Result<{ requestId: string; matchingRunId: string; eligibleCount: number; outcome: "MATCHING_COMPLETED" | "NO_MATCHING_PROVIDER" }>>;
  openRfq(input: { requestId: string; matchingRunId: string; deadline: string; idempotencyKey: string; correlationId: string }): Promise<Result<{ requestId: string; rfqId: string; invitedCount: number }>>;
  compare(input: { rfqId: string; idempotencyKey: string; correlationId: string }): Promise<Result<{ snapshotId: string; currency: string; rows: QuoteComparisonRow[] }>>;
  select(input: { quoteId: string; quoteVersionId: string; selectionReason: string; comparisonSnapshotId: string; idempotencyKey: string; correlationId: string }): Promise<Result<{ quoteId: string; rfqId: string } | {approvalRequestId:string;approvalStatus:"PENDING"|"REJECTED"}>>;
};
