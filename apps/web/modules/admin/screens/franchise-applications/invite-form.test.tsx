import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./invite-action", () => ({
  openFranchiseApplicationInvite: async () => ({ status: "idle" }),
}));

import { FranchiseApplicationInviteForm } from "./invite-form";

describe("FranchiseApplicationInviteForm", () => {
  it("shows a primary CTA when the invite panel is closed", () => {
    const html = renderToStaticMarkup(
      <FranchiseApplicationInviteForm locale="fr" query="?organizationId=org" idempotencyKey="11111111-1111-4111-8111-111111111111" open={false} />,
    );
    expect(html).toContain("Ouvrir / inviter un dossier");
    expect(html).toContain("ouvrir=1");
    expect(html).not.toContain("Créer le dossier et inviter");
  });

  it("renders the admin invite form when opened", () => {
    const html = renderToStaticMarkup(
      <FranchiseApplicationInviteForm locale="fr" query="" idempotencyKey="11111111-1111-4111-8111-111111111111" open />,
    );
    expect(html).toContain("Ouvrir / inviter un dossier franchise");
    expect(html).toContain('name="applicantName"');
    expect(html).toContain('name="territoryCode"');
    expect(html).toContain('name="domainLabel"');
    expect(html).toContain("Créer le dossier et inviter");
    expect(html).toContain("revue, le mandat et l’activation restent obligatoires");
  });
});
