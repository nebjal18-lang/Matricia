import { describe, expect, it } from "vitest";
import {
  DEMO_CLIENTS_PER_REGION,
  DEMO_PROVIDERS_PER_REGION,
  demoRegionalEmail,
  demoRegionalSummary,
  findDemoRegionalActor,
  listDemoRegionalActors,
  listDemoRegionalTerritories,
} from "./demo-regional-directory";

describe("demo regional directory", () => {
  it("couvre 12 régions avec 1 franchisé, 3 ST et 6 clients", () => {
    const territories = listDemoRegionalTerritories();
    expect(territories).toHaveLength(12);
    const summary = demoRegionalSummary();
    expect(summary.franchises).toBe(12);
    expect(summary.providers).toBe(12 * DEMO_PROVIDERS_PER_REGION);
    expect(summary.clients).toBe(12 * DEMO_CLIENTS_PER_REGION);

    const casa = listDemoRegionalActors("CASABLANCA_SETTAT");
    expect(casa.filter((actor) => actor.kind === "franchise")).toHaveLength(1);
    expect(casa.filter((actor) => actor.kind === "provider")).toHaveLength(3);
    expect(casa.filter((actor) => actor.kind === "client")).toHaveLength(6);
    expect(casa[0]?.email).toBe(demoRegionalEmail("franchise", "CASABLANCA_SETTAT", "F"));
    expect(casa[0]?.labelFr).toBe("Anfa Business Franchise");
    expect(casa.find((actor) => actor.kind === "provider" && actor.slot === "A")?.labelFr).toBe("Casa Cloud Partners");
    expect(casa.find((actor) => actor.kind === "client" && actor.slot === "1")?.labelFr).toBe("Groupe Twin Center Retail");
    expect(casa.every((actor) => !/^Franchisé ·|^Sous-traitant |^Client \d/u.test(actor.labelFr))).toBe(true);
  });

  it("retrouve un acteur par kind/territoire/slot", () => {
    const actor = findDemoRegionalActor({
      kind: "client",
      territoryCode: "RABAT_SALE_KENITRA",
      slot: "3",
    });
    expect(actor?.email).toBe("demo.client.rabat-sale-kenitra.3@matricia.test");
    expect(findDemoRegionalActor({ kind: "x", territoryCode: "RABAT_SALE_KENITRA", slot: "1" })).toBeNull();
  });
});
