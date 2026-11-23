import { describe, expect, it } from "vitest";
import { createProviderIntentDraft, getPublicProviderTaxonomy, MAX_PROVIDER_SERVICES, parseProviderIntentDraft, PROVIDER_INTENT_TTL_MS, summarizeProviderIntent } from "./model";

describe("public provider intent", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");

  it("uses the canonical 10-domain / 200-service public projection", () => {
    const taxonomy = getPublicProviderTaxonomy("fr");
    expect(taxonomy.libraries).toHaveLength(10);
    // One of the 80 catalogue subcategories has no primary service in the public projection.
    expect(taxonomy.libraries.flatMap((library) => library.categories)).toHaveLength(79);
    const services = taxonomy.libraries.flatMap((library) => library.categories.flatMap((category) => category.services));
    expect(services).toHaveLength(200);
    expect(new Set(services.map((service) => service.code)).size).toBe(200);
  });

  it("stores only known stable codes, bounds free text and expires", () => {
    const codes = getPublicProviderTaxonomy("fr").libraries.flatMap((library) => library.categories.flatMap((category) => category.services.map((service) => service.code)));
    const firstCode = codes[0];
    if (!firstCode) throw new Error("Provider taxonomy must contain a service");
    const draft = createProviderIntentDraft({ serviceCodes: [...codes, firstCode, "UNKNOWN"], otherService: `  ${"x".repeat(700)}  ` }, now);
    expect(draft.serviceCodes).toHaveLength(MAX_PROVIDER_SERVICES);
    expect(draft.otherService).toHaveLength(500);
    expect(Date.parse(draft.expiresAt) - now.getTime()).toBe(PROVIDER_INTENT_TTL_MS);
  });

  it("rejects corrupt and expired drafts", () => {
    const draft = createProviderIntentDraft({ serviceCodes: ["IT-AUDIT-SI"], otherService: "" }, now);
    expect(parseProviderIntentDraft(JSON.stringify(draft), now)?.serviceCodes).toEqual(["IT-AUDIT-SI"]);
    expect(parseProviderIntentDraft(JSON.stringify(draft), new Date(now.getTime() + PROVIDER_INTENT_TTL_MS + 1))).toBeNull();
    expect(parseProviderIntentDraft("not-json", now)).toBeNull();
  });

  it("creates a bounded legacy summary for the current qualification bridge", () => {
    const draft = createProviderIntentDraft({ serviceCodes: ["IT-AUDIT-SI"], otherService: "Conseil spécialisé" }, now);
    expect(summarizeProviderIntent(draft, "fr")).toContain("Audit du système");
    expect(summarizeProviderIntent(draft, "ar")).toContain("الخدمات المختارة");
  });
});
