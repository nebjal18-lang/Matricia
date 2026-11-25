import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { financeAuditOrganizationContext } from "./audit-organization-context";
import { FinanceAuditOrganizationSelector } from "./audit-organization-selector";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));

const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const organizations = [
  { id, display_name: "Matricia référence", legal_name: "Matricia SARL", status: "ACTIVE" },
  { id: other, display_name: "Client distinct", legal_name: "Client SARL", status: "PENDING" },
];

describe("deliberate financial audit context", () => {
  it("guides a fresh installation to company creation without inventing a wallet or organization", () => {
    const context = financeAuditOrganizationContext(undefined, { status: "success", organizations: [] });
    expect(context).toEqual({ state: "EMPTY", organizationId: null, organizations: [] });
    const html = renderToStaticMarkup(<FinanceAuditOrganizationSelector locale="fr" context={context} />);
    expect(html).toContain("/fr/administration/entreprises/nouvelle");
    expect(html).toContain("Aucune entreprise visible");
    expect(html).not.toContain("<select");
  });

  it("does not silently choose the first client and renders real organization names", () => {
    const context = financeAuditOrganizationContext(undefined, { status: "success", organizations });
    expect(context.organizationId).toBeNull();
    expect(context.state).toBe("CHOOSE");
    const html = renderToStaticMarkup(<FinanceAuditOrganizationSelector locale="fr" context={context} />);
    expect(html).toContain('name="organizationId"');
    expect(html).toContain("Confirmer l’entreprise");
    expect(html).toContain("Matricia référence");
    expect(html).toContain("Client distinct");
    const offres = renderToStaticMarkup(
      <FinanceAuditOrganizationSelector locale="fr" context={context} workshop="offres" />,
    );
    expect(offres).toContain("Ouvrir l’atelier d’offre");
  });

  it("uses the explicitly selected, visible UUID without changing another context", () => {
    expect(financeAuditOrganizationContext(other, { status: "success", organizations })).toEqual({
      state: "READY",
      organizationId: other,
      organizations,
    });
  });

  it("lands offres unlock on the box atelier and keeps territory context", () => {
    const context = financeAuditOrganizationContext(id, { status: "success", organizations });
    const html = renderToStaticMarkup(
      <FinanceAuditOrganizationSelector
        locale="fr"
        context={context}
        workshop="offres"
        preserveParams={{ territory: "CASABLANCA_SETTAT", subject: "site" }}
      />,
    );
    expect(html).toContain("#boxes");
    expect(html).toContain("Aller à l’atelier");
  });

  it.each(["bad-id", "33333333-3333-4333-8333-333333333333", [id, other]])(
    "rejects invalid or unavailable query selection %j",
    (requested) => {
      const result = financeAuditOrganizationContext(requested, { status: "success", organizations });
      expect(result.state).toBe("INVALID");
      expect(result.organizationId).toBeNull();
      expect(result.organizations).toHaveLength(2);
    },
  );

  it("distinguishes failed lookup from an empty installation and does not trust a query UUID", () => {
    const context = financeAuditOrganizationContext(id, { status: "error" });
    expect(context.state).toBe("UNAVAILABLE");
    expect(context.organizationId).toBeNull();
    const html = renderToStaticMarkup(<FinanceAuditOrganizationSelector locale="fr" context={context} />);
    expect(html).toContain("Vous pouvez toujours lire les enregistrements");
    expect(html).not.toContain("Aucune entreprise visible");
    expect(html).not.toContain('name="organizationId"');
  });

  it("provides the same selection and creation route in Arabic", () => {
    const html = renderToStaticMarkup(
      <FinanceAuditOrganizationSelector locale="ar" context={financeAuditOrganizationContext(undefined, { status: "success", organizations })} />,
    );
    expect(html).toContain("/ar/administration/entreprises/nouvelle");
    expect(html).toContain("اختيار مؤسسة");
    expect(html).toContain("تأكيد المؤسسة");
    const offres = renderToStaticMarkup(
      <FinanceAuditOrganizationSelector
        locale="ar"
        context={financeAuditOrganizationContext(undefined, { status: "success", organizations })}
        workshop="offres"
      />,
    );
    expect(offres).toContain("فتح ورشة العرض");
  });
});
