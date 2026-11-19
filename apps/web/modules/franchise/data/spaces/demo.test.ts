import { afterEach, describe, expect, it } from "vitest";
import { canApplyFranchiseSpaceDemo, demoFranchiseSpaces } from "./demo";

describe("franchise space demo overlay", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
    delete process.env.VERCEL_ENV;
  });

  it("active le gate seulement hors prod avec le flag démo", () => {
    expect(canApplyFranchiseSpaceDemo()).toBe(false);
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyFranchiseSpaceDemo()).toBe(true);
    process.env.APP_ENV = "production";
    expect(canApplyFranchiseSpaceDemo()).toBe(false);
  });

  it("remplit réseau, demandes, devis et missions quand le gate est ON", () => {
    process.env.APP_ENV = "test";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyFranchiseSpaceDemo()).toBe(true);
    const board = demoFranchiseSpaces("fr", "");
    expect(board.people.length).toBeGreaterThan(0);
    expect(board.requests.length).toBeGreaterThan(0);
    expect(board.quotes.length).toBeGreaterThan(0);
    expect(board.missions.length).toBeGreaterThan(0);
    expect(board.users.length).toBeGreaterThan(0);
    expect(board.quality.length).toBeGreaterThan(0);
    expect(board.anomalies.length).toBeGreaterThan(0);
    expect(board.volume.length).toBeGreaterThan(0);
    expect(JSON.stringify(board)).not.toMatch(/exemple illustratif/i);
  });
});
