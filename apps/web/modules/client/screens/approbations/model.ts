export type ClientApprovalRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  rowVersion: number;
  resourceType: string;
  resourceId: string;
  amountMinor: string | null;
  currency: string | null;
  requestedAt: string;
  labelFr?: string; labelAr?: string; path?: string | null; canResume?: boolean; completed?: boolean;
};

export type ClientApprovalPage =
  | { status: "success"; items: ClientApprovalRequest[]; page: number; hasNext: boolean }
  | { status: "organization_required" | "unauthenticated" | "forbidden" | "unavailable" };

export type ClientApprovalPolicy = {
  id: string; resourceType: string; version: number; status: "DRAFT" | "ACTIVE" | "RETIRED";
  minimumApprovals: number; roleCodes: string[]; contentHash: string; createdBy: string;
  executionScope: { currency?: string; minimum_amount_minor?: string; buyer_limit_minor?: string | null };
};
