import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- mock de next/image pour le rendu statique
    <img src={props.src} alt={props.alt} />
  ),
}));

import PublicHomePage from "./page";

describe("PublicHomePage", () => {
  it("présente les trois intentions, sept étapes et l’aperçu en français", async () => {
    const html = renderToStaticMarkup(await PublicHomePage({ params: Promise.resolve({ locale: "fr" }) }));
    for (const label of ["Comprendre", "Structurer", "Mettre en relation", "Comparer", "Contractualiser", "Exécuter", "Suivre"]) expect(html).toContain(label);
    expect(html).toContain("Identifiez une priorité,");
    expect(html).toContain("Décrire un besoin précis");
    expect(html).toContain('href="/fr/diagnostic"');
    expect(html).toContain('href="/fr/fournisseur"');
    expect(html).toContain('href="/fr/besoin"');
    expect(html).toContain("Un cycle clair");
    expect(html).toContain("Exemple compact");
    expect(html).not.toContain("/home-v2/hero-plate.png");
    expect(html).toContain("Une priorité formulée");
    expect(html).toContain("/home-v2/hero-collaboration.png");
    expect(html).not.toContain("200 services");
    expect((html.match(/<section/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("Questions fréquentes");
    expect(html).toContain("id=\"comment-ca-marche\"");
  });

  it("présente le même parcours et les routes localisées en arabe RTL", async () => {
    const html = renderToStaticMarkup(await PublicHomePage({ params: Promise.resolve({ locale: "ar" }) }));
    for (const label of ["الفهم", "الهيكلة", "الربط", "المقارنة", "التعاقد", "التنفيذ", "المتابعة"]) expect(html).toContain(label);
    expect(html).toContain('href="/ar/diagnostic"');
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("حدّدوا أولوية،");
    expect(html).toContain("دورة واضحة");
    expect(html).toContain("مثال مختصر");
    expect(html).toContain("/home-v2/hero-collaboration.png");
    expect(html).toContain("الأسئلة الشائعة");
  });
});
