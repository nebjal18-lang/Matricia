import { renderToStaticMarkup } from "react-dom/server";
import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";

const { loadPublicSubscriptionPlans } = vi.hoisted(() => ({ loadPublicSubscriptionPlans: vi.fn() }));

vi.mock("@/modules/public/ui/site/public-photo", () => ({ PublicPhoto: () => <div>photo</div> }));
vi.mock("@/modules/public/data/subscriptions/repository", () => ({ loadPublicSubscriptionPlans }));

import PublicSubscriptionsPage from "./page";

const premium = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "PREMIUM" as const,
  currency: "MAD",
  monthlyPriceMinor: "10000",
  annualPriceMinor: "100000",
  monthlyCreditGrant: "20",
};
const gold = {
  ...premium,
  id: "22222222-2222-4222-8222-222222222222",
  code: "GOLD" as const,
  monthlyPriceMinor: "25000",
  annualPriceMinor: "250000",
  monthlyCreditGrant: "80",
};

describe("page publique abonnements", () => {
  beforeEach(() => { loadPublicSubscriptionPlans.mockReset(); });

  it("distingue les plans par le prix et les crédits réels, sans liste identique", async () => {
    loadPublicSubscriptionPlans.mockResolvedValue({ status: "success", plans: [premium, gold] });
    const html = renderToStaticMarkup(await PublicSubscriptionsPage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(html).toContain(formatMinor(premium.monthlyPriceMinor, "MAD", "fr"));
    expect(html).toContain(formatMinor(gold.monthlyPriceMinor, "MAD", "fr"));
    expect(html).toContain(">20<");
    expect(html).toContain(">80<");
    expect(html).toContain("is-featured");
    expect(html).not.toContain("Essentiel");
    expect(html).not.toContain("Organisation");
    expect(html).toContain("ne finance pas les honoraires");
  });

  it("n’invente pas trois cartes quand les plans publics sont indisponibles", async () => {
    loadPublicSubscriptionPlans.mockResolvedValue({ status: "unavailable" });
    const html = renderToStaticMarkup(await PublicSubscriptionsPage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(html).toContain("Les offres publiées n’ont pas pu être chargées");
    expect(html).not.toContain("Essentiel");
    expect(html).not.toContain("plan=PREMIUM");
    expect(html).not.toContain("Organisation");
    expect(html).toContain("Offres momentanément indisponibles");
    expect(html).toContain("Réessayer le chargement");
  });

  it("affiche le tarif à confirmer quand le prix publié est nul", async () => {
    loadPublicSubscriptionPlans.mockResolvedValue({ status: "success", plans: [{ ...premium, monthlyPriceMinor: "0", annualPriceMinor: "0" }] });
    const html = renderToStaticMarkup(await PublicSubscriptionsPage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(html).toContain("Tarif communiqué avant souscription");
    expect(html).not.toContain(formatMinor("0", "MAD", "fr"));
  });

  it.each(["fr", "ar"] as const)("compares exact published terms and makes unprovided limits explicit in %s", async locale => {
    loadPublicSubscriptionPlans.mockResolvedValue({ status: "success", plans: [premium, gold] });
    const html = renderToStaticMarkup(await PublicSubscriptionsPage({ params: Promise.resolve({ locale }) }));
    expect(html).toContain(formatMinor(premium.monthlyPriceMinor, "MAD", locale));
    expect(html).toContain(formatMinor(gold.annualPriceMinor, "MAD", locale));
    expect(html).toContain('aria-labelledby="published-offers-title" tabindex="0"');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain(locale === "fr" ? "Détail à confirmer dans l’offre écrite avant souscription" : "تُؤكد التفاصيل في العرض المكتوب قبل الاشتراك");
    expect(html).toContain(locale === "fr" ? "30 jours après vérification et activation" : "30 يوماً بعد التحقق من المؤسسة وتفعيلها");
    expect(html).toContain(locale === "fr" ? "Premium, Gold ou Platinum" : "بريميوم أو غولد أو بلاتينيوم");
    expect(html).not.toContain("Sans plan Gold actif");
    expect(html).toContain(locale === "fr" ? "avant tout engagement ou paiement" : "قبل أي التزام أو دفع");
    expect(html).not.toContain("confirmés à l’activation");
    expect(html).not.toContain("تُؤكَّد عند التفعيل");
    expect(html).toContain(`href="/${locale}/contact?motif=CLIENT&amp;plan=GOLD"`);
  });

  it.each(["fr", "ar"] as const)("distinguishes a genuine empty publication from a technical failure in %s", async locale => {
    loadPublicSubscriptionPlans.mockResolvedValue({ status: "success", plans: [] });
    const html = renderToStaticMarkup(await PublicSubscriptionsPage({ params: Promise.resolve({ locale }) }));
    expect(html).toContain(locale === "fr" ? "Aucune formule publiée pour le moment" : "لا توجد صيغة منشورة حالياً");
    expect(html).not.toContain(locale === "fr" ? "Offres momentanément indisponibles" : "العروض غير متاحة مؤقتاً");
    expect(html).not.toContain('aria-labelledby="published-offers-title"');
    expect(html).not.toContain("plan=PREMIUM");
  });

  it("contains transport rejection without pretending an offer exists", async () => {
    loadPublicSubscriptionPlans.mockImplementation(async () => { throw new Error("private transport detail"); });
    const page = await PublicSubscriptionsPage({ params: Promise.resolve({ locale: "fr" }) });
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Offres momentanément indisponibles");
    expect(html).not.toContain("private transport detail");
    expect(html).not.toContain("plan=PREMIUM");
  });

  it("preserves Next control-flow signals", async () => {
    let signal: unknown;
    try { redirect("/fr/abonnements"); } catch (error) { signal = error; }
    loadPublicSubscriptionPlans.mockImplementation(async () => { throw signal; });
    await expect(PublicSubscriptionsPage({ params: Promise.resolve({ locale: "fr" }) })).rejects.toBe(signal);
  });
});
