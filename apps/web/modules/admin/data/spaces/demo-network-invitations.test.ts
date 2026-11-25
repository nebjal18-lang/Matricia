import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildDemoNetworkInvitations,
  canApplyAdminDemoNetworkInvitations,
} from "./demo-network-invitations";

describe("demo network invitations", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("reste masqué hors flag / en production", () => {
    process.env.APP_ENV = "development";
    expect(canApplyAdminDemoNetworkInvitations()).toBe(false);
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    expect(canApplyAdminDemoNetworkInvitations()).toBe(true);
    process.env.APP_ENV = "production";
    expect(canApplyAdminDemoNetworkInvitations()).toBe(false);
  });

  it("produit CLIENT + PROVIDER @matricia.test pour chaque région", () => {
    const rows = buildDemoNetworkInvitations("fr");
    expect(rows.length).toBe(24);
    expect(rows.every((row) => row.contactEmailMasked.includes("matricia.test"))).toBe(true);
    expect(rows.some((row) => row.prospectType === "CLIENT")).toBe(true);
    expect(rows.some((row) => row.prospectType === "PROVIDER")).toBe(true);
    expect(rows.some((row) => row.status === "REGISTERED" && row.referralOrganizationId)).toBe(true);
    expect(rows.every((row) => row.operatorLabel.length > 0)).toBe(true);
  });

  it("branche le loader invitations-réseau sur l’overlay", () => {
    const load = readFileSync(fileURLToPath(new URL("../../screens/network-invitations/load.ts", import.meta.url)), "utf8");
    expect(load).toContain("canApplyAdminDemoNetworkInvitations");
    expect(load).toContain("buildDemoNetworkInvitations");
  });
});
