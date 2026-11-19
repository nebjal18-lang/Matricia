import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/modules/shared/ui/alert", () => ({ Alert: ({ children, ...props }: { children: ReactNode } & ComponentPropsWithoutRef<"div">) => <div {...props}>{children}</div>, AlertDescription: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/modules/shared/ui/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/modules/shared/ui/button", () => ({ Button: ({ children, ...props }: ComponentPropsWithoutRef<"button">) => <button {...props}>{children}</button> }));
vi.mock("@/modules/shared/ui/input", () => ({ Input: (props: ComponentPropsWithoutRef<"input">) => <input {...props} /> }));
vi.mock("@/modules/shared/ui/label", () => ({ Label: ({ children, ...props }: ComponentPropsWithoutRef<"label">) => <label {...props}>{children}</label> }));
vi.mock("./actions", () => ({ simulateTax: async () => ({ status: "idle" }), proposeTaxRule: async () => ({ status: "idle" }), decideTaxRule: async () => ({ status: "idle" }) }));
import { TaxPanel } from "./tax-panel";
import { getMoroccoTaxMessages } from "./messages";

const id = "11111111-1111-4111-8111-111111111111";
const dashboard = {
  context: { kind: "ORGANIZATION" as const, organizationId: id },
  categories: [{ code: "CLIENT_SUBSCRIPTION", nameFr: "Abonnement client", nameAr: "اشتراك العميل", kind: "SALE", requiresSourceRule: false }],
  rules: [{ id, categoryCode: "CLIENT_SUBSCRIPTION", version: 1, rateBasisPoints: 2000, status: "ACTIVE", validationStatus: "DEMO", ruleType: "VAT", effectiveFrom: "2026-01-01", effectiveTo: null, legalReference: "Configuration démonstration", rowVersion: 1 }],
};
const keys = { proposal: id, [id]: id };
const retiredOnly = {
  ...dashboard,
  rules: [{ ...dashboard.rules[0], status: "RETIRED" }],
};

function render(locale: "fr" | "ar", data = dashboard) {
  return renderToStaticMarkup(
    <div dir={locale === "ar" ? "rtl" : "ltr"}>
      <TaxPanel dashboard={data} locale={locale} m={getMoroccoTaxMessages(locale)} keys={keys} />
    </div>,
  );
}

describe("TaxPanel localisation et accessibilité", () => {
  it("montre les taux en pourcentage et le geste principal", () => {
    const text = render("fr").replace(/<[^>]+>/g, " ");
    expect(text).toContain("Taux en vigueur");
    expect(text).toContain("Changer le taux");
    expect(text).toContain("20");
    expect(text).toContain("%");
    expect(text).toContain("TVA");
    expect(text).toContain("Démo");
    expect(text).not.toMatch(/\bVAT\b|\bACTIVE\b|\bDEMO\b|\bbps\b|points de base|unités mineures/);
  });

  it("réaffiche les taux retirés s’il n’y a plus d’actif", () => {
    const text = render("fr", retiredOnly).replace(/<[^>]+>/g, " ");
    expect(text).toContain("Changer le taux");
    expect(text).toContain("Retirée");
    expect(text).not.toContain("Aucun taux actif");
  });

  it("associe les libellés des formulaires avancés aux contrôles", () => {
    const html = render("fr");
    const controls = [...html.matchAll(/<(?:input|select)[^>]*\sid="([^"]+)"/g)].map((value) => value[1]);
    const labels = [...html.matchAll(/<label[^>]+for="([^"]+)"/g)].map((value) => value[1]);
    expect(labels.filter((value) => !controls.includes(value))).toEqual([]);
  });

  it("rend les valeurs arabes dans un conteneur RTL", () => {
    const html = render("ar");
    const text = html.replace(/<[^>]+>/g, " ");
    expect(html).toContain('dir="rtl"');
    expect(text).toContain("النسب السارية");
    expect(text).toContain("تغيير النسبة");
    expect(text).toContain("ض.ق.م");
    expect(text).toContain("تجريبي");
  });
});

it("submits an explicit global context without inventing a tenant", () => {
  const html = renderToStaticMarkup(<TaxPanel dashboard={{ ...dashboard, context: { kind: "PLATFORM" } }} locale="fr" m={getMoroccoTaxMessages("fr")} keys={keys} />);
  expect(html).toContain('name="contextKind" value="PLATFORM"');
  expect(html).not.toContain('name="organizationId"');
});
