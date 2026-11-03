import { describe, expect, it } from "vitest";
import { catalogEffectiveStatus } from "./workspace-model";

describe("catalogue identity and historical version status", () => {
  it.each(["ARCHIVED", "RETIRED"])("keeps %s despite a historical published version", status => {
    expect(catalogEffectiveStatus(status, "PUBLISHED")).toBe(status);
    expect(catalogEffectiveStatus(status, "DRAFT")).toBe(status);
  });
  it("shows a new draft while keeping its published identity", () => {
    expect(catalogEffectiveStatus("PUBLISHED", "DRAFT")).toBe("DRAFT");
    expect(catalogEffectiveStatus("DRAFT", undefined)).toBe("DRAFT");
  });
});
