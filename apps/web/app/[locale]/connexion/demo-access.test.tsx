import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./demo-actions", () => ({
  connectDemoPersona: async () => undefined,
  connectDemoRegionalActor: async () => undefined,
}));

import { DemoAccess } from "./demo-access";

describe("DemoAccess", () => {
  it("expose personas globaux et raccourcis régionaux", () => {
    const html = renderToStaticMarkup(<DemoAccess locale="fr" />);
    expect(html).toContain("Connexion automatique");
    expect(html).toContain("Raccourcis par région");
    expect(html).toContain("Casablanca-Settat");
    expect(html).toContain("Anfa Business Franchise");
    expect(html).toContain("Casa Cloud Partners");
    expect(html).toContain("Atelier Design Gauthier");
    expect(html).toContain('name="kind" value="franchise"');
    expect(html).toContain('name="kind" value="provider"');
    expect(html).toContain('name="kind" value="client"');
    expect(html).toContain('name="territoryCode" value="CASABLANCA_SETTAT"');
    expect(html).toContain('name="next" value="/fr/administration/command-center"');
  });
});
