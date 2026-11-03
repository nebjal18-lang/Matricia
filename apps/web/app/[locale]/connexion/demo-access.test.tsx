import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./demo-actions", () => ({ connectDemoPersona: async () => undefined }));

import { DemoAccess } from "./demo-access";

describe("DemoAccess", () => {
  it("expose les quatre personas de démonstration en français", () => {
    const html = renderToStaticMarkup(<DemoAccess locale="fr" />);
    expect(html).toContain("Connexion automatique");
    expect(html).toContain("Client");
    expect(html).toContain("Sous-traitant");
    expect(html).toContain("Franchisé");
    expect(html).toContain("Admin");
    expect(html).toContain('value="franchise"');
    expect(html).toContain('value="admin"');
  });

  it.each(["fr", "ar"] as const)("preserves the requested Admin creation page in every demo form in %s", locale => {
    const next = `/${locale}/administration/entreprises/nouvelle`;
    const html = renderToStaticMarkup(<DemoAccess locale={locale} nextPath={next} />);
    expect(html.match(new RegExp(`name="next" value="${next}"`, "g"))).toHaveLength(4);
  });
  it("expose les quatre personas de démonstration en arabe", () => {
    const html = renderToStaticMarkup(<DemoAccess locale="ar" />);
    expect(html).toContain("دخول تلقائي");
    expect(html).toContain("مقاول من الباطن");
    expect(html).toContain("صاحب امتياز");
    expect(html).toContain('value="franchise"');
    expect(html).toContain('value="admin"');
  });
});
