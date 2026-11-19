import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildDemoSpecialSpaceRows,
  canApplyAdminDemoSpecialSpaces,
} from "./demo-special-spaces";

describe("demo special spaces (territoires / gouvernance / litiges)", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("reste masqué hors flag", () => {
    process.env.APP_ENV = "development";
    expect(canApplyAdminDemoSpecialSpaces()).toBe(false);
    expect(buildDemoSpecialSpaceRows("fr", "territoires", "")).toBeNull();
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyAdminDemoSpecialSpaces()).toBe(true);
  });

  it("remplit territoires, gouvernance et litiges avec des lignes cohérentes", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    const territoires = buildDemoSpecialSpaceRows("fr", "territoires", "");
    const gouvernance = buildDemoSpecialSpaceRows("fr", "gouvernance", "");
    const litiges = buildDemoSpecialSpaceRows("fr", "litiges", "");
    const providers = buildDemoSpecialSpaceRows("fr", "providers", "");

    expect(providers).toBeNull();
    expect(territoires).toHaveLength(12);
    expect(gouvernance).toHaveLength(8);
    expect(litiges).toHaveLength(6);
    expect(territoires!.every((row) => row.cells.length >= 7)).toBe(true);
    expect(gouvernance!.some((row) => row.status === "PENDING" && row.treat)).toBe(true);
    expect(litiges!.every((row) => row.extras?.missionId)).toBe(true);
  });

  it("branche space-data sur l’overlay specialSnapshotSpaces", () => {
    const source = readFileSync(fileURLToPath(new URL("./space-data.ts", import.meta.url)), "utf8");
    expect(source).toContain("buildDemoSpecialSpaceRows");
    expect(source).toContain("specialSnapshotSpaces");
  });
});
