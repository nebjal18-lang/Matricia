import { afterEach, describe, expect, it } from "vitest";
import { canApplyProviderSpaceDemo, demoProviderSpaces } from "./demo";

describe("provider space demo overlay", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
    delete process.env.VERCEL_ENV;
  });

  it("active le gate seulement hors prod avec le flag démo", () => {
    expect(canApplyProviderSpaceDemo()).toBe(false);
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyProviderSpaceDemo()).toBe(true);
    process.env.APP_ENV = "production";
    expect(canApplyProviderSpaceDemo()).toBe(false);
  });

  it("remplit consultations, devis et missions quand le gate est ON", () => {
    process.env.APP_ENV = "test";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyProviderSpaceDemo()).toBe(true);
    const board = demoProviderSpaces("fr", "");
    expect(board.consultRows.length).toBeGreaterThan(0);
    expect(board.quotes.length).toBeGreaterThan(0);
    expect(board.missions.length).toBeGreaterThan(0);
    expect(board.treat.length).toBeGreaterThan(0);
    expect(board.invoices.length).toBeGreaterThan(0);
    expect(JSON.stringify(board)).not.toMatch(/exemple illustratif/i);
  });
});
