import { describe, expect, it } from "vitest";
import { normalizeSpecialQueueRow } from "./special-queue-normalize";

const id = "11111111-1111-4111-8111-111111111111";

describe("normalizeSpecialQueueRow", () => {
  it("drops capacite trailing status so expiration stays a plain date", () => {
    const row = normalizeSpecialQueueRow("fr", "capacite", "", {
      id,
      href: "",
      title: "Doc",
      status: "ACTIVE",
      tone: "mint",
      cells: ["Org", "RC", "ACTIVE", "—", "—", "ID v1", "2029-11-08", "ACTIVE"],
    });
    expect(row.cells).toHaveLength(7);
    expect(row.cells[6]).toBe("2029-11-08");
  });

  it("repairs gouvernance so Risque is empty and État keeps status", () => {
    const row = normalizeSpecialQueueRow("fr", "gouvernance", "", {
      id,
      href: "",
      title: "INITIAL_ACTIVATION",
      status: "PENDING",
      tone: "sky",
      cells: ["abcd1234", "Lib", "INITIAL_ACTIVATION", "E2E_SOUSS_ZONE", "1", "PENDING", "PENDING", "—"],
    });
    expect(row.cells[5]).toBe("—");
    expect(row.cells[6]).toBe("PENDING");
    expect(row.cells[3]).toBe("Souss Zone");
  });

  it("moves litiges status out of Contradictoire", () => {
    const row = normalizeSpecialQueueRow("fr", "litiges", "", {
      id,
      href: "",
      title: "DELIVERY_LATE",
      status: "OPEN",
      tone: "peach",
      cells: ["abcd1234", "mission1", "DELIVERY_LATE", "DELIVERY_LATE", "2", "OPEN", "—", "—", "OPEN"],
    });
    expect(row.cells[5]).toBe("—");
    expect(row.cells[8]).toBe("OPEN");
  });
});
