import { describe, expect, it } from "vitest";
import { franchiseReviewAvailability } from "./franchise-review";

const pending = { status: "CONTRACT_PENDING", organizationId: "org", franchiseId: "mandate", approval: { requestedByMe: false }, invitationId: "invitation", invitationPending: true };
describe("persisted mandate prerequisites", () => {
  it.each(["franchiseId", "approval", "invitationId"] as const)("blocks approval without %s", (key) => {
    expect(franchiseReviewAvailability({ ...pending, [key]: null })).toMatchObject({ canApprove: false, missingPrerequisites: true });
  });
  it("allows the review surface only with the persisted links", () => {
    expect(franchiseReviewAvailability(pending)).toMatchObject({ canApprove: true, canResend: true });
    expect(franchiseReviewAvailability({ ...pending, status: "ACTIVE" })).toMatchObject({ canApprove: false, canResend: false });
  });
});
