/** Presentation of persisted prerequisites; never a substitute for RPC authorization. */
export function franchiseReviewAvailability(application: {
  status: string;
  organizationId: string | null;
  franchiseId: string | null;
  approval: { requestedByMe: boolean } | null;
  invitationId: string | null;
  invitationPending: boolean;
}) {
  const mandatePending = application.status === "CONTRACT_PENDING";
  const missingPrerequisites = mandatePending && (!application.franchiseId || !application.approval || !application.invitationId);
  return {
    needsOrganization: !application.organizationId && ["COMPANY_REVIEW", "DOCUMENT_REVIEW"].includes(application.status),
    canPropose: application.status === "DOCUMENT_REVIEW" && Boolean(application.organizationId) && !application.franchiseId,
    canApprove: mandatePending && !missingPrerequisites,
    missingPrerequisites,
    canResend: Boolean(application.franchiseId && application.invitationId && application.invitationPending) && ["CONTRACT_PENDING", "LIBRARY_ASSIGNED"].includes(application.status),
  };
}
