import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLegalPage } from "./page-factory";
import { legalPublicationFields } from "./publication";
import { legalPublicationLabel } from "./publication-copy";

vi.mock("./cookie-preferences", () => ({ CookiePreferences: () => <div>Cookie preferences</div> }));

beforeEach(() => { for (const field of legalPublicationFields) vi.stubEnv(field, ""); });
afterEach(() => vi.unstubAllEnvs());

describe("legal publication data disclosure", () => {
  for (const locale of ["fr", "ar"] as const) {
    it.each(["mentions", "confidentialite", "conditions", "cookies"] as const)("lists missing approved fields on %s in " + locale, async id => {
      const html = renderToStaticMarkup(await createLegalPage(id).Page({ params: Promise.resolve({ locale }) }));
      for (const field of legalPublicationFields) expect(html).toContain(legalPublicationLabel(locale, field));
      expect(html).not.toContain("LEGAL_ENTITY_NAME");
      expect(html).not.toContain("<dl");
      expect(html).toContain(`href="/${locale}/contact"`);
      expect(html).toContain(`href="/${locale}/cookies"`);
      expect(html).toContain(`dir="${locale === "ar" ? "rtl" : "ltr"}"`);
      expect(html).toContain('aria-labelledby="publication-status"');
    });

    it("renders only supplied identity and never an internal approval reference in " + locale, async () => {
      for (const field of legalPublicationFields) vi.stubEnv(field, "Supplied test information");
      vi.stubEnv("LEGAL_ENTITY_NAME", "Éditeur fourni pour le test");
      vi.stubEnv("LEGAL_HOST_NAME", "Hébergeur fourni pour le test");
      vi.stubEnv("LEGAL_PRIVACY_EMAIL", "privacy@example.invalid");
      vi.stubEnv("LEGAL_TERMS_APPROVAL_REFERENCE", "TEST-APPROVAL-NOT-PUBLIC");
      const html = renderToStaticMarkup(await createLegalPage("mentions").Page({ params: Promise.resolve({ locale }) }));
      expect(html).toContain("Éditeur fourni pour le test");
      expect(html).toContain("Hébergeur fourni pour le test");
      expect(html).toContain("privacy@example.invalid");
      expect(html).not.toContain("TEST-APPROVAL-NOT-PUBLIC");
      expect(html).not.toContain('aria-labelledby="publication-status"');
    });

    it("keeps unapproved retention explicit and the table keyboard reachable in " + locale, async () => {
      const html = renderToStaticMarkup(await createLegalPage("confidentialite").Page({ params: Promise.resolve({ locale }) }));
      expect(html).toContain(locale === "fr" ? "Durée non communiquée par l’éditeur" : "لم يحدد الناشر مدة الاحتفاظ");
      expect(html).toContain('role="region"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('scope="col"');
      expect(html).toContain('class="min-w-0"');
    });
  }
});
