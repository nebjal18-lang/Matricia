import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import PublicFranchise from "@/app/[locale]/(public)/franchise/page";
import Candidature from "@/app/[locale]/franchise/candidature/page";
import { FranchiseApplicationForm } from "@/app/[locale]/(public)/franchise/franchise-application-form";
import { getFranchisePresentation } from "./franchise-presentation";
vi.mock("@/app/[locale]/(public)/contact/actions", () => ({ submitContactRequest: vi.fn(async () => ({ status: "idle" })) }));
vi.mock("@/modules/public/ui/site/public-navigation", () => ({ PublicNavigation: () => null }));
vi.mock("@/modules/public/ui/site/public-footer", () => ({ PublicFooter: () => null }));

for (const locale of ["fr", "ar"] as const) describe(`professional Franchise model ${locale}`, () => {
  it("uses the same professional catalogue definition on the public page and candidature", async () => {
    const definition = getFranchisePresentation(locale).definition;
    const publicHtml = renderToStaticMarkup(await PublicFranchise({ params: Promise.resolve({ locale }) }));
    const applicationHtml = renderToStaticMarkup(await Candidature({ params: Promise.resolve({ locale }) }));
    expect(publicHtml).toContain(definition); expect(applicationHtml).toContain(definition);
    expect(applicationHtml).not.toMatch(/initiative culturelle|culturelle et éducative|ثقافية وتعليمية|بالإشعاع المعرفي|بالـمعرفة/);
    expect(applicationHtml).toContain(`/${locale}/franchise`);
  });
  it("keeps the actual application contract while asking for a professional service domain", () => {
    const html = renderToStaticMarkup(<FranchiseApplicationForm locale={locale} />);
    expect(html).toContain(getFranchisePresentation(locale).domain);
    expect(html).toContain('name="category" value="FRANCHISE"'); expect(html).toContain('name="domain"');
    expect(html).toContain('name="message"'); expect(html).toContain('name="motivation"');
  });
});
