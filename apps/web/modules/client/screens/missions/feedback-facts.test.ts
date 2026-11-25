import { describe, expect, it } from "vitest";
import { feedbackFactsFromRows, ratioBasisPoints, satisfactionBasisPoints } from "./feedback-facts";

const deliverable = "11111111-1111-4111-8111-111111111111";
const milestone = "22222222-2222-4222-8222-222222222222";

describe("mission feedback facts", () => {
  it("recomputes satisfaction from the three ratings without floats", () => {
    expect(satisfactionBasisPoints([5, 5, 5])).toBe(10_000);
    expect(satisfactionBasisPoints([5, 4, 3])).toBe(7_500);
    expect(satisfactionBasisPoints([1, 1, 1])).toBe(0);
  });

  it("keeps quality and compliance as rounded basis points", () => {
    expect(ratioBasisPoints(2, 3)).toBe(6_667);
    expect(ratioBasisPoints(0, 4)).toBe(0);
  });

  it("blocks a note until an accepted criterion and a checklist item exist", () => {
    expect(feedbackFactsFromRows({
      deliverables: [{ id: deliverable, status: "SUBMITTED", current_version: 1 }],
      checks: [{ deliverable_id: deliverable, delivery_version: 1, status: "PENDING" }],
      items: [{ status: "PENDING", milestone_id: milestone }],
      retiredMilestoneIds: [],
    })).toEqual({ status: "blocked", reason: "NO_ACCEPTANCE" });
    expect(feedbackFactsFromRows({
      deliverables: [{ id: deliverable, status: "ACCEPTED", current_version: 1 }],
      checks: [{ deliverable_id: deliverable, delivery_version: 1, status: "COMPLIANT" }],
      items: [],
      retiredMilestoneIds: [],
    })).toEqual({ status: "blocked", reason: "NO_CHECKLIST" });
  });

  it("uses the current delivery version and ignores a retired milestone", () => {
    expect(feedbackFactsFromRows({
      deliverables: [{ id: deliverable, status: "ACCEPTED", current_version: 2 }],
      checks: [
        { deliverable_id: deliverable, delivery_version: 1, status: "NONCOMPLIANT" },
        { deliverable_id: deliverable, delivery_version: 2, status: "COMPLIANT" },
      ],
      items: [
        { status: "COMPLETED", milestone_id: milestone },
        { status: "PENDING", milestone_id: null },
      ],
      retiredMilestoneIds: [milestone],
    })).toEqual({ status: "ready", quality: 10_000, compliance: 0 });
  });
});
