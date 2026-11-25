import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- mock de next/image pour le rendu statique
    <img src={props.src} alt={props.alt} />
  ),
}));

import PublicHomePage from "./page";

describe("PublicHomePage", () => {
  it("affiche les quatre accès aux tableaux de bord quand la démo production est activée", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MATRICIA_DEMO_ACCESS_ENABLED", "true");
    vi.stubEnv("MATRICIA_DEMO_PRODUCTION_ACCESS_ENABLED", "true");
    const html = renderToStaticMarkup(await PublicHomePage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(html).toContain("Explorer les tableaux de bord démo");
    expect(html.indexOf("Explorer les tableaux de bord démo")).toBeLessThan(html.indexOf('id="home-title"'));
    for (const persona of ["client", "provider", "franchise", "admin"]) {
      expect(html).toContain(`name="persona" value="${persona}"`);
    }
    expect(html).toContain('name="next" value="/fr/administration/command-center"');
  });

  it("présente les trois intentions, sept étapes et l’aperçu en français", async () => {
    const html = renderToStaticMarkup(await PublicHomePage({ params: Promise.resolve({ locale: "fr" }) }));
    for (const label of ["Comprendre", "Structurer", "Matcher", "Comparer", "Contractualiser", "Exécuter", "Suivre"]) expect(html).toContain(label);
    expect(html).toContain("Découvrez ce qui freine votre entreprise.");
    expect(html).toContain("Passez aux bonnes solutions.");
    expect(html).toContain('href="/fr/diagnostic"');
    expect(html).toContain('href="/fr/fournisseur"');
    expect(html).toContain('href="/fr/besoin"');
    expect(html).toContain("Un cycle complet");
    expect(html).not.toContain("/home-v2/hero-plate.png");
    expect(html).toContain("Des priorités claires");
    expect(html).toContain("/home-v2/hero-collaboration.png");
    expect(html).not.toContain("200 services");
    expect((html.match(/<section/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("Questions fréquentes");
    expect(html).toContain("id=\"comment-ca-marche\"");
  });

  it("présente le même parcours et les routes localisées en arabe RTL", async () => {
    const html = renderToStaticMarkup(await PublicHomePage({ params: Promise.resolve({ locale: "ar" }) }));
    for (const label of ["الفهم", "الهيكلة", "المطابقة", "المقارنة", "التعاقد", "التنفيذ", "المتابعة"]) expect(html).toContain(label);
    expect(html).toContain('href="/ar/diagnostic"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("اكتشف ما يعيق تطور مؤسستك.");
    expect(html).toContain("دورة كاملة");
    expect(html).toContain("/home-v2/hero-collaboration.png");
    expect(html).toContain("الأسئلة الشائعة");
  });
});
