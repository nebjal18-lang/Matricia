import { describe, expect, it } from "vitest";
import { localizeStatus } from "./view-model";

describe("localizeStatus", () => {
  it("localizes mandate and approval statuses used on territoires", () => {
    expect(localizeStatus("ACTIVE", "fr")).toBe("Active");
    expect(localizeStatus("PROPOSED", "fr")).toBe("Proposé");
    expect(localizeStatus("PROPOSED", "ar")).toBe("مقترح");
    expect(localizeStatus("PENDING_APPROVAL", "fr")).toBe("En attente");
  });
});
