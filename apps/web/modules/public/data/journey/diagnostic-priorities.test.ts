import { describe, expect, it } from "vitest";
import { computePriorities, diagnosticPriorityTriggers } from "./diagnostic-priorities";

describe("public diagnostic traceable rules", () => {
  it("keeps the reported BTP/cost scenario associated with the actual operational answers", () => {
    const answers = { sector: "construction", team_size: "small", goals: ["control_costs"], priority_tracking: "no", sales_tracking: "manual", backup_restore: "not_applicable", decision_trace: "partial" };
    expect(computePriorities(answers)).toEqual(["organization", "sales"]);
    expect(diagnosticPriorityTriggers(answers)).toEqual({ organization: ["priority_tracking"], sales: ["sales_tracking"], security: [], verify: [] });
  });

  it("traces both inputs for a goal-dependent security recommendation", () => {
    const answers = { goals: ["secure_activity"], backup_restore: "old" };
    expect(computePriorities(answers)).toEqual(["security"]);
    expect(diagnosticPriorityTriggers(answers).security).toEqual(["goals", "backup_restore"]);
  });

  it.each(["recent", "not_applicable"])("does not turn a %s backup answer into a security risk", (backup_restore) => {
    expect(computePriorities({ goals: ["secure_activity"], backup_restore })).not.toContain("security");
  });

  it("distinguishes a declared sales goal and an unknown follow-up answer", () => {
    const answers = { goals: ["grow_sales"], sales_tracking: "unknown", decision_trace: "unknown" };
    expect(computePriorities(answers)).toEqual(["sales", "verify"]);
    expect(diagnosticPriorityTriggers(answers).sales).toEqual(["goals", "sales_tracking"]);
    expect(diagnosticPriorityTriggers(answers).verify).toEqual(["sales_tracking", "decision_trace"]);
  });

  it("does not infer a priority from sector, size or free text alone", () => {
    expect(computePriorities({ sector: "construction", team_size: "small", next_action: "Organiser un chantier" })).toEqual([]);
  });
});
