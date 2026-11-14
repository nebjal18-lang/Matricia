import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProviderPurchasesBoard } from "./purchases-board";

describe("provider purchases board", () => {
  it("renvoie vers le Mode Client sans inventer d’achat", () => {
    const html = renderToStaticMarkup(<ProviderPurchasesBoard locale="fr" query="" hasClientRole={false} subscription={null} volume={null} />);
    expect(html).toContain("Mode Client");
    expect(html).toContain("/sous-traitant/mode-client");
    expect(html).not.toContain("77500");
  });

  it("montre une réservation réelle quand le rôle Client existe", () => {
    const html = renderToStaticMarkup(
      <ProviderPurchasesBoard
        locale="fr"
        query=""
        hasClientRole
        subscription={null}
        volume={{
          organizationId: "11111111-1111-4111-8111-111111111111",
          organizationName: "Atlas",
          pools: [],
          reservations: [{ id: "r1", poolId: "p1", clientOrganizationId: "11111111-1111-4111-8111-111111111111", benefitReference: "BOX-GOLD", reservedUnits: "12", consumedUnits: "0", releasedUnits: "0", status: "ACTIVE", expiresAt: "2026-12-31T00:00:00Z" }],
          allocations: [],
          commitments: [],
        }}
      />,
    );
    expect(html).toContain("BOX-GOLD");
    expect(html).toContain("/client/achats-groupes");
    expect(html).toContain("workspace=client");
  });
});
