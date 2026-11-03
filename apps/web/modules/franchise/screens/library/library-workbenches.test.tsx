import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FranchiseQuestionnairesWorkbench, FranchiseRulesWorkbench, FranchiseServicesWorkbench } from "./library-workbenches";
import type { FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace";

vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()}),usePathname:()=>"/fr/franchise/services",useSearchParams:()=>new URLSearchParams()}));

const workspace: FranchiseLibraryWorkspace = {
  mandate: {
    franchiseId: "11111111-1111-4111-8111-111111111111",
    operatorCode: "HATIM_AHMITECH",
    type: "IT",
    libraryId: "22222222-2222-4222-8222-222222222222",
    libraryCode: "IT",
    libraryName: "Informatique",
    libraryStatus: "PUBLISHED",
    libraryRowVersion: 1,
    currentReleaseId: null,
  },
  counts: { drafts: 1, inReview: 0, published: 1, returns: 0 },
  categories: [{ id: "cat-1", title: "Infrastructure", children: [{ id: "sub-1", title: "Sauvegarde" }] }],
  services: [{ id: "33333333-3333-4333-8333-333333333333", kind: "SERVICE", title: "Sauvegarde gérée", code: "IT-BACKUP", status: "PUBLISHED", versionLabel: "v1", href: "/fr/franchise/services?serviceId=s1", category: "Infrastructure", subcategory: "Sauvegarde", subcategoryId: "sub-1", description: "Sauvegarde managée", nameFr: "Sauvegarde gérée", nameAr: "نسخ احتياطي" }],
  questionnaires: [{ id: "44444444-4444-4444-8444-444444444444", kind: "QUESTIONNAIRE", title: "Diagnostic SI", code: "IT-DIAG", status: "DRAFT", versionLabel: "v1", href: "/fr/franchise/questionnaires/q1", category: null, subcategory: null, subcategoryId: null, description: null, nameFr: "Diagnostic SI", nameAr: "تشخيص نظم المعلومات", questionnaireVersionId: "77777777-7777-4777-8777-777777777777", draftVersionId: "77777777-7777-4777-8777-777777777777", identityRowVersion: 1, versionRowVersion: 1 }],
  rules: [{ id: "55555555-5555-4555-8555-555555555555", kind: "RULE", title: "BACKUP_TESTED", code: "BACKUP_TESTED", status: "DRAFT", versionLabel: "v1", href: "/fr/franchise/regles?ruleId=r1", category: null, subcategory: null, subcategoryId: null, description: null, nameFr: null, nameAr: null, draftVersionId: "88888888-8888-4888-8888-888888888888", identityRowVersion: 1, versionRowVersion: 1 }],
  questions: [{ id: "66666666-6666-4666-8666-666666666666", key: "HAS_BACKUP", status: "DRAFT", label: "Disposez-vous d’une sauvegarde testée ?", help: "", answerType: "YES_NO", required: true, questionnaireId: "44444444-4444-4444-8444-444444444444" }],
  releases: [],
};

const command = { idempotencyKey: "11111111-1111-4111-8111-111111111111", correlationId: "11111111-1111-4111-8111-111111111112" };

describe("franchise library workbenches", () => {
  it("compose le catalogue services en trois colonnes comme la maquette", () => {
    const html = renderToStaticMarkup(
      <FranchiseServicesWorkbench locale="fr" query="" workspace={workspace} selectedId={workspace.services[0]!.id} createMode={false} organizationId={null} commandIdentity={command} />,
    );
    expect(html).toContain("Catalogue de ma bibliothèque");
    expect(html).toContain("Sauvegarde gérée");
    expect(html).toContain("Nouveau service");

    expect(html).toContain("#contenu");
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("keeps the selected mandate in a new service form",()=>{
    const html=renderToStaticMarkup(<FranchiseServicesWorkbench locale="fr" query="" workspace={workspace} selectedId={null} createMode organizationId={null} commandIdentity={command}/>);
    expect(html).toContain(`name="franchiseId" value="${workspace.mandate.franchiseId}"`);
  });

  it("marks only the actual descriptive fields and presents persisted review feedback",()=>{
    const actual={...workspace,services:[{...workspace.services[0]!,nameFr:"",nameAr:"نص محفوظ",description:"Description présente",reviewEvents:[{id:"review",versionId:"version",status:"REJECTED",requestedAt:"2026-11-01T00:00:00Z",reviewedAt:"2026-11-02T00:00:00Z",comment:"Compléter le justificatif original"}]}]};
    const html=renderToStaticMarkup(<FranchiseServicesWorkbench locale="fr" query="" workspace={actual} selectedId={actual.services[0]!.id} createMode={false} organizationId={null} commandIdentity={command}/>);
    expect(html).toContain("Compléter le justificatif original");
    expect(html).not.toContain("Questionnaire associé");
    expect(html).toContain("Champs descriptifs renseignés");
    expect(html).toContain('<li>Contenu FR renseigné</li>');
    expect(html).toContain('<li data-done="true">Contenu AR renseigné</li>');
    expect(html).toContain("Ouvrir le coffre documentaire");
  });

  it("affiche le cycle questionnaire et le bandeau de mandat", () => {
    const html = renderToStaticMarkup(
      <FranchiseQuestionnairesWorkbench locale="fr" query="" workspace={workspace} selectedId={null} createMode={false} commandIdentity={command} />,
    );
    expect(html).toContain("Diagnostic SI");
    expect(html).toContain("Vous voyez uniquement votre bibliothèque mandatée");
    expect(html).toContain("franchise-mini-pipe");
    expect(html).toContain("Ajouter un questionnaire");
    expect(html).toContain("Soumettre à Matricia");
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("branche simulation et soumission sur l’écran règles", () => {
    const html = renderToStaticMarkup(
      <FranchiseRulesWorkbench locale="fr" query="" workspace={workspace} selectedId={null} createMode={false} commandIdentity={command} />,
    );
    expect(html).toContain("BACKUP_TESTED");
    expect(html).toContain("Simulation (en bac à sable)");
    expect(html).toContain("Soumettre à Matricia");
    expect(html).toContain("name=\"ruleId\"");
    expect(html).toContain("#simulation");
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("propose la publication immuable d’un service APPROVED", () => {
    const approved = {
      ...workspace,
      services: [{ ...workspace.services[0]!, status: "APPROVED" }],
    };
    const html = renderToStaticMarkup(
      <FranchiseServicesWorkbench locale="fr" query="" workspace={approved} selectedId={approved.services[0]!.id} createMode={false} organizationId={null} commandIdentity={command} />,
    );
    expect(html).toContain("Publier le snapshot validé");
    expect(html).toContain("publication immuable");
  });
});
