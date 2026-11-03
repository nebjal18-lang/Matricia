import type { AdminSpaceId } from "./admin-nav";
import type { SpaceRow } from "./space-data";

const buckets: Partial<Record<AdminSpaceId, readonly (readonly string[])[]>> = {
  qualification: [["DRAFT", "UNQUALIFIED", "PENDING", "INCOMPLETE"], ["SUBMITTED", "UNDER_REVIEW", "IN_REVIEW"], ["INFORMATION_REQUIRED"], ["CONDITIONAL"], ["APPROVED"], ["REJECTED"]],
  franchises: [["APPLIED", "PENDING", "PROPOSED"], ["ACTIVE"], ["SUSPENDED"], ["ARCHIVED", "RETIRED"]],
  gouvernance: [["PENDING", "PENDING_APPROVAL"], ["SECOND_APPROVAL_REQUIRED"], ["INFORMATION_REQUIRED"], ["APPROVED", "AUTHORIZED"], ["REJECTED"]],
  diagnostics: [["DRAFT"], ["IN_PROGRESS", "STARTED"], ["COMPLETED", "SUBMITTED"], ["IN_REVIEW", "STALE"], ["ARCHIVED"]],
  demandes: [[], ["DRAFT"], ["INCOMPLETE", "INFORMATION_REQUIRED"], ["READY", "MATCHED"], ["RFQ_OPEN", "OPEN"], ["QUOTES_RECEIVED"], ["AWARDED", "ASSIGNED"], ["CLOSED"], ["ARCHIVED"]],
  matching: [["PENDING", "READY"], ["IN_REVIEW"], ["COMPLETED"], ["SENT"], ["OPEN", "IN_PROGRESS"], ["EXPIRED"], ["CLOSED"]],
  devis: [["DRAFT"], ["SUBMITTED", "RECEIVED"], ["IN_REVIEW"], ["REVISION_REQUESTED"], ["VALIDATED", "APPROVED"], ["EXPIRED"], ["SELECTED", "ACCEPTED"], ["REJECTED"]],
  contrats: [["DRAFT"], ["IN_REVIEW"], ["READY_FOR_SIGNATURE"], ["SIGNING"], ["SIGNED"], ["READY_FOR_ACTIVATION"], ["ACTIVE"], ["SUSPENDED"], ["CLOSED"], ["ARCHIVED"]],
  avenants: [["DRAFT"], ["IN_REVIEW"], ["READY_FOR_SIGNATURE"], ["SIGNED"], ["READY_FOR_ACTIVATION"], ["ACTIVE", "ACTIVATED"], ["REJECTED"], ["ARCHIVED"]],
  missions: [["PENDING", "READY"], ["ACTIVE", "IN_PROGRESS"], ["PENDING_ACCEPTANCE", "WAITING"], ["BLOCKED"], ["READY_FOR_CLOSURE"], ["CLOSED", "COMPLETED"], ["SUSPENDED"], ["ARCHIVED"]],
  jalons: [["PENDING"], ["IN_PROGRESS"], ["SUBMITTED"], ["PENDING_ACCEPTANCE"], ["REJECTED"], ["ACCEPTED", "COMPLETED"], ["OVERDUE"], ["ARCHIVED"]],
  messagerie:[["OPEN","LOCKED"],["UNREAD"],["FLAGGED"],["PENDING","QUEUED_DIGEST"],["SENT","DELIVERED"],["FAILED","DEAD_LETTER"],[]],
  litiges:[["OPEN"],["ADMISSIBLE"],["IN_REVIEW","UNDER_REVIEW"],["MEDIATION"],["DECIDED","DECISION_ISSUED"],["REASSIGNMENT_PROPOSED","REASSIGNMENT_APPROVED"],["RESOLVED"],["CLOSED"],["ARCHIVED"]],
  documents: [[], ["SUBMITTED", "UNDER_REVIEW"], ["PENDING", "SCANNING"], ["VERIFIED", "CLEAN"], ["REJECTED", "INFECTED", "BLOCKED"], ["EXPIRING"], ["EXPIRED"], ["ARCHIVED"]],
};

export function adminPillCode(space: AdminSpaceId, index: number): string {
  const statuses = buckets[space]?.[index];
  return statuses ? statuses.join("|") : "";
}

export function filterAdminRows(rows: readonly SpaceRow[], space: AdminSpaceId, view?: string, search?: string): SpaceRow[] {
  const needle = search?.trim().toLocaleLowerCase();
  // Persist canonical status codes, never translated display strings.
  const codes = view?.split("|").filter((code) => /^[A-Z][A-Z0-9_]*$/u.test(code)) ?? [];
  void space;
  return rows.filter((row) => (!needle || `${row.title} ${row.status} ${row.cells.join(" ")}`.toLocaleLowerCase().includes(needle))
    && (!codes.length || codes.some((code)=>[row.status,...(row.extras?.statusCodes??"").split("|")].includes(code))));
}
