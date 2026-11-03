import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/shared/lib/auth/select-workspace", () => ({ selectWorkspace: vi.fn() }));
let currentPathname = "/fr";
vi.mock("next/navigation", () => ({ usePathname: () => currentPathname }));
vi.mock("@/modules/shared/ui/button", () => ({ buttonVariants: () => "button" }));
vi.mock("@/modules/shared/lib/utils", () => ({ cn: (...values: Array<string | undefined>) => values.filter(Boolean).join(" ") }));
vi.mock("@/modules/public/data/journey/copy", async () => await import("@/modules/public/data/journey/copy"));

import { isPublicNavLinkActive, nextMenuFocusIndex, PublicNavigation } from "./public-navigation";

describe("PublicNavigation", () => {
  it("expose Comment ça marche, Professionnels, Franchise, Abonnements et À propos", () => {
    currentPathname = "/fr/fournisseur";
    const html = renderToStaticMarkup(<PublicNavigation locale="fr" />);
    expect(html).toContain("Comment ça marche");
    expect(html).toContain("Entreprises");
    expect(html).toContain("Professionnels");
    expect(html).toContain("Abonnements");
    expect(html).toContain("Franchise");
    expect(html).toContain("À propos");
    expect(html).toContain("Créer un compte");
    expect(html).toContain("Des bonnes rencontres pour de vrais progrès");
    expect(html).toContain('href="/fr/inscription"');
    expect(html).toContain("Se connecter");
    expect(html).toMatch(/aria-current="page"[^>]+href="\/fr\/fournisseur"/u);
    expect(html).toContain('aria-label="Ouvrir le menu"');
    expect(html).toContain("premium-nav-account");
    expect(html).toContain("premium-mobile-cluster");
    expect(html).not.toContain(">Fournisseurs<");
  });

  it("rend la navigation arabe avec les mêmes destinations que le français", () => {
    currentPathname = "/ar/fournisseur";
    const html = renderToStaticMarkup(<PublicNavigation locale="ar" />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('href="/ar/entreprises"');
    expect(html).toContain('href="/ar/fournisseur"');
    expect(html).toContain('href="/ar/franchise"');
    expect(html).toContain('href="/ar/abonnements"');
    expect(html).toContain('href="/ar/a-propos"');
    expect(html).toContain("كيف تعمل المنصة");
    expect(html).toContain("المؤسسات");
    expect(html).toContain("المهنيون");
    expect(html).toContain("الامتياز");
    expect(html).toContain("الاشتراكات");
    expect(html).toContain("من نحن");
    expect(html).not.toContain(">لمن<");
    expect(html).not.toContain(">موارد<");
    expect(html).toMatch(/aria-current="page"[^>]+href="\/ar\/fournisseur"/u);
    expect(html).toContain("rtl-mirror");
  });

  it.each(["fr", "ar"] as const)("shows verified current space and only its authorized role choices in %s", locale => {
    currentPathname = `/${locale}/entreprises`;
    const html = renderToStaticMarkup(<PublicNavigation locale={locale} sessionNavigation={{ signedIn: true, landing: "administration", options: [{ kind: "administration", href: `/${locale}/administration/command-center?workspace=administration` }, { kind: "client", href: `/${locale}/tableau-de-bord?workspace=client` }] }} />);
    expect(html).toContain(locale === "fr" ? "Mon espace · Administration" : "مساحتي · الإدارة");
    expect(html).toContain(locale === "fr" ? "Changer d’espace" : "تغيير المساحة");
    expect(html).toContain('name="workspace" value="administration"');
    expect(html).toContain('name="workspace" value="client"');
    expect(html).not.toContain('value="provider"');
    expect(html).not.toContain(`href="/${locale}/connexion"`);
    expect(html).not.toContain(`href="/${locale}/inscription"`);
  });
  it("does not offer role switching to a single-role member", () => {
    const html = renderToStaticMarkup(<PublicNavigation locale="fr" sessionNavigation={{ signedIn: true, landing: "client", options: [{ kind: "client", href: "/fr/tableau-de-bord" }] }} />);
    expect(html).toContain("Mon espace · Client");
    expect(html).not.toContain("Changer d’espace");
  });
  it("résout strictement les routes actives", () => {
    expect(isPublicNavLinkActive("/fr/services/IT-001", "/fr/services")).toBe(true);
    expect(isPublicNavLinkActive("/fr/fournisseur", "/fr/services")).toBe(false);
    expect(isPublicNavLinkActive("/fr", "/fr#comment-ca-marche")).toBe(true);
    expect(isPublicNavLinkActive("/franchise", "/fr")).toBe(false);
  });

  it("boucle le focus clavier dans les deux directions", () => {
    expect(nextMenuFocusIndex(-1, 4, false)).toBe(0);
    expect(nextMenuFocusIndex(-1, 4, true)).toBe(3);
    expect(nextMenuFocusIndex(3, 4, false)).toBe(0);
    expect(nextMenuFocusIndex(0, 4, true)).toBe(3);
    expect(nextMenuFocusIndex(0, 0, false)).toBeNull();
  });

  it("expose les destinations footer-critiques via la navigation principale", () => {
    currentPathname = "/fr";
    const html = renderToStaticMarkup(<PublicNavigation locale="fr" />);
    expect(html).toContain('href="/fr/abonnements"');
    expect(html).toContain('href="/fr/franchise"');
    expect(html).toContain('href="/fr/a-propos"');
    expect(html).toContain("#comment-ca-marche");
  });
});
