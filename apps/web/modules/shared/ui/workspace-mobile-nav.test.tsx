import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/shared/ui/use-ui-copy", () => ({
  useUiCopy: () => ({ locale: "fr", close: "Fermer" }),
}));

import { WorkspaceMobileNav } from "./workspace-mobile-nav";

describe("WorkspaceMobileNav", () => {
  it("renders a closed mobile menu trigger without opening the sheet by default", () => {
    const html = renderToStaticMarkup(
      <WorkspaceMobileNav locale="fr" title="Navigation" triggerLabel="Ouvrir le menu">
        <a href="/fr/tableau-de-bord">Accueil</a>
      </WorkspaceMobileNav>,
    );
    expect(html).toContain("Ouvrir le menu");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain("workspace-mobile-nav-body");
  });
});
