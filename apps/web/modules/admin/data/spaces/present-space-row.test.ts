import { describe, expect, it } from "vitest";
import {
  isOperationalFixtureName,
  presentChannel,
  presentDateTime,
  presentMinor,
  presentObligation,
  presentOrgName,
} from "./present-space-row";

describe("present-space-row", () => {
  it("nettoie orgs, dates, canaux et montants pour toutes les files", () => {
    const id = "9028dee5-9239-4b29-b540-b6bf12bc44e3";
    expect(presentOrgName(`P05 E2E A ${id} SUPERSEDED`, "fr")).toBe("P05 A");
    expect(isOperationalFixtureName(`P05 E2E A ${id}`)).toBe(true);
    expect(presentChannel("in-app", "fr")).toBe("Dans l’app");
    expect(presentObligation("DELIVERABLE_ACCEPTANCE", "fr")).toBe("Acceptation du livrable");
    expect(presentMinor("12500", "MAD", "fr")).toContain("125");
    expect(presentDateTime("2025-09-21T20:03:00.000Z", "fr")).not.toContain("T20:03");
  });
});
