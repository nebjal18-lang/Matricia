import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
const navigation = vi.hoisted(() => ({ redirect: vi.fn((href: string): never => { throw new Error(href); }), notFound: vi.fn((): never => { throw new Error("not_found"); }) }));
vi.mock("next/navigation", () => navigation);
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [] }) }) }) }) }) }));
vi.mock("@/modules/client/ui/client-app-shell", () => ({ ClientAppShell: () => null }));
vi.mock("@/modules/client/screens/demandes/offer-detail", () => ({ ClientOfferDetailView: () => null }));
const load = vi.hoisted(() => vi.fn());
vi.mock("@/modules/client/data/rfq/quote-detail-repository", () => ({ loadClientOfferDetail: load }));
import OfferDetailPage from "@/app/[locale]/client/demandes/[requestId]/offres/[quoteId]/page";
import { translateLocalPath } from "@/modules/shared/lib/auth/workspace-navigation";

describe("UX-02 offer language context", () => {
  it.each(["fr", "ar"] as const)("preserves the full offer context through login in %s", async locale => {
    load.mockResolvedValue({ status: "unauthenticated" });
    await expect(OfferDetailPage({
      params: Promise.resolve({ locale, requestId: "request", quoteId: "quote" }),
      searchParams: Promise.resolve({ organizationId: "organization", versionId: "version" }),
    })).rejects.toThrow(`/${locale}/connexion?next=`);
    const destination = new URL(navigation.redirect.mock.lastCall?.[0] ?? "", "https://matricia.invalid");
    expect(destination.pathname).toBe(`/${locale}/connexion`);
    expect(destination.searchParams.get("next")).toBe(`/${locale}/client/demandes/request/offres/quote?organizationId=organization&versionId=version`);
  });
  it.each(["success", "error"])("preserves organization, offer and version for %s", async status => {
    load.mockResolvedValue({ status, value: {} });
    for (const locale of ["fr", "ar"] as const) {
      const element = await OfferDetailPage({ params: Promise.resolve({ locale, requestId: "request", quoteId: "quote" }), searchParams: Promise.resolve({ organizationId: "org&other=bad", versionId: "version" }) }) as ReactElement<{ languagePath: string }>;
      const path = element.props.languagePath;
      expect(path).toBe(`/${locale}/client/demandes/request/offres/quote?organizationId=org%26other%3Dbad&versionId=version`);
      const alternate = locale === "fr" ? "ar" : "fr";
      expect(translateLocalPath(translateLocalPath(path, locale, alternate), alternate, locale)).toBe(path);
      expect(load.mock.lastCall?.[0].versionId).toBe("version");
    }
  });
  it("omits ambiguous repeated parameters instead of forwarding arrays", async () => {
    load.mockResolvedValue({ status: "success", value: {} });
    const element = await OfferDetailPage({ params: Promise.resolve({ locale: "fr", requestId: "request", quoteId: "quote" }), searchParams: Promise.resolve({ organizationId: ["one", "two"], versionId: ["one", "two"] }) }) as ReactElement<{ languagePath: string }>;
    expect(element.props.languagePath).toBe("/fr/client/demandes/request/offres/quote");
    expect(load.mock.lastCall?.[0]).not.toHaveProperty("versionId");
  });
});
