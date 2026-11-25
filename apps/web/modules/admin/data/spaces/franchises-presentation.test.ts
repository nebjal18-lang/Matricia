import { describe, expect, it } from "vitest";
import { normalizeFranchisesRpcRow } from "./franchises-presentation";

describe("franchises-presentation", () => {
  it("humanizes legacy operator and territory codes", () => {
    const row = normalizeFranchisesRpcRow("fr", "", {
      id: "11111111-1111-4111-8111-111111111111",
      href: "",
      title: "Informatique",
      status: "ACTIVE",
      tone: "mint",
      cells: ["Informatique", "FRANCHISEE", "E2E_SOUSS_ZONE", "v1", "STANDARD", "ACTIVE", "ACTIVE", "ACTIVE"],
    });
    expect(row.title).toBe("Franchisé · Souss Zone");
    expect(row.cells[0]).toBe("Franchisé · Souss Zone");
    expect(row.cells[2]).toBe("Souss Zone");
    expect(row.cells[7]).toBe("ACTIVE");
  });
});
