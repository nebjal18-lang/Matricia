import { afterEach, describe, expect, it } from "vitest";
import { canApplyClientSpaceDemo, demoClientSpaces } from "./demo";

describe("client space demo overlay", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
    delete process.env.VERCEL_ENV;
  });

  it("active le gate seulement hors prod avec le flag démo", () => {
    expect(canApplyClientSpaceDemo()).toBe(false);
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyClientSpaceDemo()).toBe(true);
    process.env.APP_ENV = "production";
    expect(canApplyClientSpaceDemo()).toBe(false);
  });

  it("remplit demandes, missions, devis et litiges quand le gate est ON", () => {
    process.env.APP_ENV = "test";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyClientSpaceDemo()).toBe(true);
    const board = demoClientSpaces("fr", "");
    expect(board.requests.length).toBeGreaterThan(0);
    expect(board.missions.validations.length).toBeGreaterThan(0);
    expect(board.compareOffers.length).toBeGreaterThan(0);
    expect(board.disputes.length).toBeGreaterThan(0);
    expect(board.documents.length).toBeGreaterThan(0);
    expect(board.finances.length).toBeGreaterThan(0);
    expect(JSON.stringify(board)).not.toMatch(/exemple illustratif/i);
  });
});
