import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomePremium } from "./HomePremium";
import { getHomePremiumCopy } from "./home-premium.copy";

describe("HomePremium", () => {
  it.each(["fr", "ar"] as const)("keeps a brand-first hero without overlay cards in %s", (locale) => {
    const copy = getHomePremiumCopy(locale);
    const html = renderToStaticMarkup(<HomePremium locale={locale} />);

    expect(html).toContain(`>${copy.brand}<`);
    expect(html).toContain(copy.titleLead);
    expect(html).toContain(copy.primaryAction);
    expect(html).toContain(`/${locale}/diagnostic`);
    expect(html).toContain(`/${locale}/fournisseur`);
    expect(html).toContain(`/${locale}/besoin`);
    expect(html).toContain('id="comment-ca-marche"');
    expect(html).not.toMatch(/heroQuote|heroValues|heroScript|heroSpines|styles\.flow|styles\.stages/);
    expect(html).not.toContain("Besoin");
    expect(html).not.toContain("Offres");
  });

  it("exposes one cycle frieze and FAQ without duplicate process bars", () => {
    const html = renderToStaticMarkup(<HomePremium locale="fr" />);
    expect(html).toContain("Un cycle complet");
    expect(html).toContain("Questions fréquentes");
    expect(html).toContain("Ce que vous obtenez");
    expect((html.match(/Analyser mon entreprise/g) ?? []).length).toBe(2);
  });
});
