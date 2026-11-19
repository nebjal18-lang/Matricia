import { afterEach, describe, expect, it } from "vitest";
import { canApplyDemoOffer, demoClientOfferDetail, isDemoOfferId } from "./quote-detail-demo";

describe("demo offer detail", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("reconnaît les identifiants démo et active le gate hors prod avec le flag", () => {
    expect(isDemoOfferId("11111111-1111-4111-8111-111111111111-a")).toBe(true);
    expect(isDemoOfferId("11111111-1111-4111-8111-111111111111")).toBe(false);
    expect(canApplyDemoOffer("Client · Communication, marketing et création")).toBe(false);
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    process.env.APP_ENV = "development";
    expect(canApplyDemoOffer("Client · Communication, marketing et création")).toBe(true);
    expect(canApplyDemoOffer("Epitaphe Market")).toBe(true);
    process.env.APP_ENV = "production";
    expect(canApplyDemoOffer("Client · Communication, marketing et création")).toBe(false);
    process.env.APP_ENV = "development";
    const offer = demoClientOfferDetail({
      locale: "fr",
      requestId: "11111111-1111-4111-8111-111111111111",
      quoteId: "11111111-1111-4111-8111-111111111111-a",
      description: "Déploiement de la marque",
      organizationQuery: "?organizationId=11111111-1111-4111-8111-111111111111",
    });
    expect(offer.lines).toHaveLength(3);
    expect(offer.lines.reduce((sum, line) => sum + BigInt(line.totalMinor), BigInt(0)).toString()).toBe("4500000");
    expect(offer.documents).toHaveLength(3);
    expect(JSON.stringify(offer)).not.toMatch(/exemple illustratif/i);
    expect(JSON.stringify(offer)).not.toMatch(/provider_organization/i);
  });
});
