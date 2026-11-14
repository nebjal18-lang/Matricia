import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminDirectoryBoard, OrganizationFicheBoard, OrganizationsBoard } from "./boards";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Client · Communication",
  legalName: "Client Communication SARL",
  type: "Client",
  status: "Active",
  statusTone: "mint" as const,
  compliance: "À jour",
  complianceTone: "mint" as const,
  plan: "Non affiché",
  lastAction: "Demande ouverte",
};

const fiche = {
  organization: {
    id: row.id,
    display_name: "Studio Atlas",
    legal_name: "Studio Atlas SARL",
    status: "ACTIVE",
    country_code: "MA",
    created_at: "2026-09-01T10:00:00.000Z",
    updated_at: "2026-09-18T10:00:00.000Z",
  },
  memberships: [{ id: "22222222-2222-4222-8222-222222222222", user_id: "33333333-3333-4333-8333-333333333333", status: "ACTIVE", roles: ["CLIENT_OWNER"] }],
  requests: [{ id: "44444444-4444-4444-8444-444444444444", status: "OPEN", created_at: "2026-09-18T10:00:00.000Z", service_id: "55555555-5555-4555-8555-555555555555" }],
  missions: [],
  disputes: [],
  diagnostics: [],
  subscriptions: [{ id: "66666666-6666-4666-8666-666666666666", status: "TRIAL", plan_version_id: null, current_period_end: null }],
  timeline: [{ at: "2026-09-18T10:00:00.000Z", kind: "REQUEST", label: "Demande ouverte", ref: "r1" }],
};

describe("admin space boards", () => {
  it("compose l’annuaire, la liste et la fiche sans exemple illustratif", () => {
    const html = [
      renderToStaticMarkup(<AdminDirectoryBoard locale="fr" query="" />),
      renderToStaticMarkup(<OrganizationsBoard locale="fr" query="" rows={[row]} treat={[{ id: "t1", title: "Client · Communication", detail: "Demande ouverte", href: "/fr/administration/entreprises", tone: "sky" }]} />),
      renderToStaticMarkup(<OrganizationFicheBoard locale="fr" query="" fiche={fiche} />),
    ].join("\n");
    expect(html).toContain("Acteurs &amp; accès");
    expect(html).toContain("Organisations");
    expect(html).not.toContain("admin-dir-tip");
    expect(html).toContain("Actions sensibles");
    expect(html).toContain("Toutes les pages d’administration");
    expect(html).toContain("Créer");
    expect(html).toContain("Archiver / restaurer");
    expect(html).toContain("Client · Communication");
    expect(html).toContain("Studio Atlas");
    expect(html).toContain("Aucune suppression définitive");
    expect(html).toContain("À traiter");
    expect(html).toContain("1 résultat");
    expect(html).toContain('data-layout="orgs"');
    expect(html).not.toContain("admin-chart-grid");
    expect(html).toContain('data-tone="amber"');
    expect(html).toContain('data-tone="plum"');
    expect(html).not.toMatch(/exemple illustratif/i);
  });

  it("masque les fixtures E2E par défaut et nettoie l’affichage", () => {
    const fixture = {
      ...row,
      id: "c7d9160c-c012-4926-8165-2aa6646f0f19",
      name: "P05 A",
      legalName: "P05 E2E A c7d9160c-c012-4926-8165-2aa6646f0f19",
      type: "Non renseigné",
      typeCodes: [] as string[],
      typeTone: "peach" as const,
      fixture: true,
    };
    const hidden = renderToStaticMarkup(<OrganizationsBoard locale="fr" query="" rows={[row, fixture]} treat={[]} />);
    expect(hidden).toContain("Client · Communication");
    expect(hidden).not.toContain("P05 A");
    expect(hidden).toContain("1 élément(s) de test / démo masqué(s).");
    expect(hidden).toContain("fixtures=1");
    const shown = renderToStaticMarkup(<OrganizationsBoard locale="fr" query="?fixtures=1" rows={[row, fixture]} treat={[]} includeFixtures />);
    expect(shown).toContain("P05 A");
    expect(shown).toContain("Non renseigné");
    expect(shown).toContain('value="NONE"');
    expect(shown).toContain("2 résultats");
  });
});

for (const locale of ["fr", "ar"] as const) {
  it(`shows legal facts, exact membership statuses and unavailable Boxes in ${locale}`, () => {
    const html = renderToStaticMarkup(<OrganizationFicheBoard locale={locale} query="?organizationId=other" fiche={{ ...fiche,
      organization: { ...fiche.organization, client_legal_profile: { version: 1, legal_form: "SARL", activity: "Conseil technique", registered_city: null, registered_address: null, if_number: "12345678", rc_number: "87654" } },
      memberships: ["ACTIVE", "INVITED", "SUSPENDED", "REVOKED"].map((status, index) => ({ ...fiche.memberships[0]!, id: `member-${index}`, status, roles: index === 0 ? ["CLIENT_OWNER"] : ["PROVIDER_OWNER"] })),
      subscriptions: [...fiche.subscriptions, { ...fiche.subscriptions[0]!, id: "cancelled", status: "CANCELLED" }],
    }} />);
    expect(html).toContain("Conseil technique");
    expect(html).toContain("12345678");
    expect(html).toContain("87654");
    expect(html).toContain("CLIENT_OWNER, PROVIDER_OWNER");
    expect(html).toContain(`${locale === "ar" ? "دعوات معلّقة" : "Invitations en attente"}</strong><small>1</small>`);
    expect(html).toContain(`${locale === "ar" ? "صناديق نشطة" : "Boxes actives"}</strong><small>${locale === "ar" ? "غير متاح" : "Non disponible"}</small>`);
    expect(html).toContain(`/administration/utilisateurs?organizationId=${row.id}&amp;org=${row.id}`);
    expect(html).not.toContain("organizationId=other\" class=\"admin-soft-cta\">" + (locale === "ar" ? "إدارة الأعضاء" : "Gérer les membres"));
  });
}
