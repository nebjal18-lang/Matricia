import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./actions", () => ({ createRequestAction: vi.fn() }));
vi.mock("@/modules/shared/ui/button", () => ({ Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} /> }));
vi.mock("@/modules/shared/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/modules/shared/ui/textarea", () => ({ Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} /> }));
import { RequestForm } from "./request-form";
import { getClientRfqMessages } from "./messages";

describe("guided client request form", () => {
  it("contains only business fields and preserves the confirmed priority", () => {
    const html = renderToStaticMarkup(<RequestForm locale="fr" messages={getClientRfqMessages("fr")} context={{ source: "opportunity", opportunityId: "11111111-1111-4111-8111-111111111111", organizationId: "22222222-2222-4222-8222-222222222222", organizationName: "Entreprise Test", serviceName: "Sécuriser les accès", title: "Accès à renforcer", description: "Renforcer les accès sensibles de l’entreprise." }} />);
    for (const field of ["libraryId", "serviceId", "questionnaireVersionId", "catalogSnapshotHash", "questionnaireSnapshotHash", "idempotencyKey", "changeReason"]) expect(html).not.toContain(`name="${field}"`);
    expect(html).toContain('name="opportunityId"'); expect(html).toContain("Entreprise Test"); expect(html).toContain("Enregistrer le brouillon");
    expect(html).toContain("client-wizard");
    expect(html).toContain("Votre besoin");
    expect(html).not.toContain("client-wizard-steps");
    expect(html).not.toContain("Continuer");
    expect(html).toContain("Objectif de la demande");
    expect(html).toContain("Résultat attendu");
    expect(html).toContain("Ce que Matricia a compris");
    expect(html).toContain("Fourchette budgétaire estimée");
    expect(html).toContain('name="description" required');
    expect(html).toContain('name="regionCode" required');
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("converts a confirmed need without exposing catalog identifiers", () => {
    const html = renderToStaticMarkup(<RequestForm locale="fr" messages={getClientRfqMessages("fr")} context={{ source: "need", intakeId: "33333333-3333-4333-8333-333333333333", serviceCode: "IT-AUDIT-SI", organizationId: "22222222-2222-4222-8222-222222222222", organizationName: "Entreprise Test", serviceName: "Audit du SI", title: "Audit du SI", description: "Sécuriser le réseau du bureau.", regionCode: "CASABLANCA_SETTAT" }} />);
    for (const field of ["libraryId", "serviceId", "questionnaireVersionId", "catalogSnapshotHash", "questionnaireSnapshotHash", "opportunityId"]) expect(html).not.toContain(`name="${field}"`);
    expect(html).toContain('name="intakeId"');
    expect(html).toContain('name="serviceCode"');
    expect(html).toContain("IT-AUDIT-SI");
    expect(html).toContain("besoin que vous avez confirmé");
    expect(html).toContain("Site concerné");
    expect(html).toContain("Région");
  });

  it("lists registered company sites without catalog identifiers", () => {
    const html = renderToStaticMarkup(
      <RequestForm
        locale="fr"
        messages={getClientRfqMessages("fr")}
        sites={[{ id: "44444444-4444-4444-8444-444444444444", nameFr: "Siège Casablanca", nameAr: "مقر الدار البيضاء" }]}
        context={{ source: "opportunity", opportunityId: "11111111-1111-4111-8111-111111111111", organizationId: "22222222-2222-4222-8222-222222222222", organizationName: "Entreprise Test", serviceName: "Sécuriser les accès", title: "Accès à renforcer", description: "Renforcer les accès sensibles de l’entreprise.", siteId: "44444444-4444-4444-8444-444444444444" }}
      />,
    );
    expect(html).toContain('name="siteId"');
    expect(html).toContain("Siège Casablanca");
    expect(html).not.toContain('name="libraryId"');
  });
});
