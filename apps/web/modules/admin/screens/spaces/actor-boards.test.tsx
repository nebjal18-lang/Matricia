import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientFicheBoard, ClientsBoard, ComplianceBoard, ComplianceDecisionBoard, UserFicheBoard } from "./actor-boards";

const orgId = "11111111-1111-4111-8111-111111111111";
const caseId = "77777777-7777-4777-8777-777777777777";

const organization = {
  id: orgId,
  display_name: "Studio Atlas",
  legal_name: "Studio Atlas SARL",
  status: "ACTIVE",
  created_at: "2026-09-01T10:00:00.000Z",
  member_count: 2,
  open_requests: 1,
  open_disputes: 0,
};

const fiche = {
  organization: {
    id: orgId,
    display_name: "Studio Atlas",
    legal_name: "Studio Atlas SARL",
    status: "ACTIVE",
    country_code: "MA",
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-18T10:00:00.000Z",
    client_compliance_snapshot: {
      case_id: caseId,
      status: "UNDER_REVIEW",
      profile_version: 1,
      document_count: 1,
      verified_document_count: 1,
      currently_verified: false,
      required_actions: [],
    },
  },
  memberships: [{ id: "22222222-2222-4222-8222-222222222222", user_id: "33333333-3333-4333-8333-333333333333", status: "ACTIVE", roles: ["CLIENT_OWNER"] }],
  requests: [{ id: "44444444-4444-4444-8444-444444444444", status: "OPEN", created_at: "2026-09-18T10:00:00.000Z", service_id: "55555555-5555-4555-8555-555555555555" }],
  missions: [],
  disputes: [],
  diagnostics: [],
  subscriptions: [{ id: "66666666-6666-4666-8666-666666666666", status: "TRIAL", plan_version_id: null, current_period_end: null }],
  timeline: [{ at: "2026-09-18T10:00:00.000Z", kind: "REQUEST", label: "Demande ouverte", ref: "r1" }],
  client_request_count: 1,
};

const complianceCase = {
  id: caseId,
  organizationName: "Studio Atlas",
  status: "UNDER_REVIEW" as const,
  profileVersion: 1,
  submittedAt: "2026-09-18T10:00:00.000Z",
  publicReason: null,
  createdAt: "2026-09-10T10:00:00.000Z",
  updatedAt: "2026-09-18T10:00:00.000Z",
  canDecide: true,
  documents: [],
  evidence: [{ type: "REGISTRATION_DOCUMENT" as const, status: "VERIFIED" as const }],
  anomalies: [],
  questions: [],
};

describe("admin actor boards", () => {
  it("compose clients, conformité et fiches sans exemple illustratif", () => {
    const html = [
      renderToStaticMarkup(<ClientsBoard locale="fr" query="" organizations={[organization]} cases={[]} diagnostics={[]} />),
      renderToStaticMarkup(<ClientFicheBoard locale="fr" query="" fiche={fiche} />),
      renderToStaticMarkup(<ComplianceBoard locale="fr" query="" cases={[complianceCase]} />),
      renderToStaticMarkup(<ComplianceDecisionBoard locale="fr" query="" item={complianceCase} form={<p>Formulaire réel</p>} />),
    ].join("\n");
    expect(html).toContain("Studio Atlas");
    expect(html).toContain("Parcours client");
    expect(html).toContain("Décision de conformité client");
    expect(html).toContain("/fr/administration/clients/" + orgId);
    expect(html).toContain("/fr/administration/conformite-clients/" + caseId);
    expect(html).toContain(`/fr/administration/conformite-clients/${caseId}/identite`);
    expect(html).toContain(`href="/fr/administration/conformite-clients/${caseId}"`);
    expect(html).toContain("/fr/administration/entreprises/" + orgId + "/modifier");
    expect(html).not.toContain("admin-chart-grid");
    expect(html).not.toMatch(/exemple illustratif/i);
    const ficheHtml = renderToStaticMarkup(<ClientFicheBoard locale="fr" query="" fiche={fiche as never} />);
    expect(ficheHtml).toContain(`href="/fr/administration/conformite-clients/${caseId}"`);
    expect(ficheHtml).toContain("Voir la conformité");
    expect(ficheHtml).not.toMatch(/href="\/fr\/administration\/conformite-clients(?:\?[^"]*)?"/);
  });

  it("opens treat-rail compliance cases on their dossier, not the queue index", () => {
    const html = renderToStaticMarkup(
      <ClientsBoard locale="fr" query="" organizations={[organization]} cases={[complianceCase]} diagnostics={[]} />,
    );
    expect(html).toContain(`href="/fr/administration/conformite-clients/${caseId}"`);
    const treat = html.match(/Clients nécessitant une action[\s\S]*?<\/aside>/)?.[0] ?? "";
    expect(treat).toContain(`href="/fr/administration/conformite-clients/${caseId}"`);
    expect(treat).not.toMatch(/href="\/fr\/administration\/conformite-clients"/);
  });

  it("lists expected pieces instead of a false « not visible » message when none are deposited", () => {
    const pending = {
      ...complianceCase,
      organizationName: "Atlas Conseil",
      status: "DOCUMENTS_REQUIRED" as const,
      evidence: [],
    };
    const html = renderToStaticMarkup(<ComplianceBoard locale="fr" query="" cases={[pending]} />);
    expect(html).toContain("Immatriculation · Pouvoir · Fiscal");
    expect(html).toContain("Gérer les documents");
    expect(html).not.toContain("Aucun justificatif visible");
    expect(html).not.toContain("Aucune pièce déposée");
  });

  it("hides phase-lab compliance fixtures by default and relabels them when shown", () => {
    const fixture = {
      ...complianceCase,
      organizationName: "P05 E2E A c7d9160c-c012-4926-8165-2aa6646f0f19",
      status: "DOCUMENTS_REQUIRED" as const,
      evidence: [],
    };
    const operational = { ...complianceCase, organizationName: "Atlas Conseil" };
    const hidden = renderToStaticMarkup(<ComplianceBoard locale="fr" query="" cases={[fixture, operational]} />);
    expect(hidden).toContain("Atlas Conseil");
    expect(hidden).toContain("1 élément(s) de test / démo masqué(s).");
    expect(hidden).toContain("fixtures=1");
    expect(hidden).not.toContain("Client test A");
    expect(hidden).not.toContain("P05 A");
    const shown = renderToStaticMarkup(<ComplianceBoard locale="fr" query="?fixtures=1" cases={[fixture, operational]} includeFixtures />);
    expect(shown).toContain("Client test A");
    expect(shown).toContain("Atlas Conseil");
    expect(shown).not.toContain("P05 E2E");
  });

  it("renders an ORG-002 user fiche with person initial, scopes and in-page sections", () => {
    const userId = "55555555-5555-4555-8555-555555555555";
    const html = renderToStaticMarkup(
      <UserFicheBoard
        locale="fr"
        query=""
        userId={userId}
        fiche={null}
        rows={[{
          userId,
          membershipId: "66666666-6666-4666-8666-666666666666",
          organizationId: orgId,
          organizationName: "Ahmitech Franchise IT",
          roles: ["FRANCHISE_OWNER"],
          status: "ACTIVE",
          updatedAt: null,
          displayName: "Hatim Ahmitech",
          email: "hatim.ahmitech@matricia.test",
          phone: "+212612000004",
          preferredLocale: "fr-MA",
          givenName: "Hatim",
          familyName: "Ahmitech",
          platformRoles: [],
          libraryScopes: ["IT"],
          franchiseScopes: ["IT:HATIM_AHMITECH · MA"],
          accountStatus: "ACTIVE",
          lastSignInAt: "2026-11-12T10:00:00.000Z",
          mfaStatus: "DISABLED",
          sessionCount: 1,
        }]}
      />,
    );
    expect(html).toContain("Hatim Ahmitech");
    expect(html).toContain("hatim.ahmitech@matricia.test");
    expect(html).toContain("Ahmitech Franchise IT");
    expect(html).toContain("Propriétaire franchise");
    expect(html).toContain("IT:HATIM_AHMITECH");
    expect(html).toContain("Requis — non activée");
    expect(html).toContain("#perimetres");
    expect(html).toContain('aria-hidden="true">H</span>');
    expect(html).toContain("Ouvrir les invitations");
    const tabs = html.match(/<nav class="client-tabs"[\s\S]*?<\/nav>/)?.[0] ?? "";
    expect(tabs).toContain("#securite-compte");
    expect(tabs).not.toContain("/fr/invitations");
    expect(html).not.toMatch(/Identité\s*:/);
  });

  it("requires an explicit organization before suspend/revoke on multi-membership accounts", () => {
    const userId = "55555555-5555-4555-8555-555555555555";
    const orgB = "22222222-2222-4222-8222-222222222222";
    const row = (organizationId: string, organizationName: string, membershipId: string) => ({
      userId,
      membershipId,
      organizationId,
      organizationName,
      roles: ["CLIENT_OWNER"],
      status: "ACTIVE",
      updatedAt: null,
      displayName: "Sara Kadiri",
      email: "sara@matricia.test",
      givenName: "Sara",
      familyName: "Kadiri",
      platformRoles: [],
      libraryScopes: [],
      franchiseScopes: [],
      accountStatus: "ACTIVE",
      mfaStatus: "DISABLED" as const,
      sessionCount: 0,
    });
    const withoutOrg = renderToStaticMarkup(
      <UserFicheBoard
        locale="fr"
        query=""
        userId={userId}
        fiche={null}
        rows={[row(orgId, "Org A", "66666666-6666-4666-8666-666666666661"), row(orgB, "Org B", "66666666-6666-4666-8666-666666666662")]}
      />,
    );
    expect(withoutOrg).toContain("Choisissez une organisation avant de suspendre");
    expect(withoutOrg).not.toContain("Suspendre le compte");
    const withOrg = renderToStaticMarkup(
      <UserFicheBoard
        locale="fr"
        query={`?organizationId=${orgB}`}
        userId={userId}
        fiche={null}
        rows={[row(orgId, "Org A", "66666666-6666-4666-8666-666666666661"), row(orgB, "Org B", "66666666-6666-4666-8666-666666666662")]}
      />,
    );
    expect(withOrg).toContain("Suspendre le compte");
    expect(withOrg).toContain(`value="${orgB}"`);
  });
});
