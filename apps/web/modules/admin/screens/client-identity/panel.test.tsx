import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [{ status: "idle" }, "review-action", false],
    useId: () => "identity-review",
  };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/modules/admin/screens/client-identity/actions", () => ({
  reviewClientIdentity: vi.fn(async () => ({ status: "idle" })),
}));

import { getClientIdentityMessages } from "@/modules/admin/screens/client-identity/messages";
import type { ClientIdentityContext } from "@/modules/admin/screens/client-identity/model";
import { ClientIdentityPanel } from "@/modules/admin/screens/client-identity/panel";

const hash = "a".repeat(64);
const caseId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";

function context(overrides: Partial<ClientIdentityContext> = {}): ClientIdentityContext {
  return {
    compliance_case_id: caseId,
    organization_id: orgId,
    case_row_version: 2,
    profile_version: 1,
    status: "UNDER_REVIEW",
    identity_hash: hash,
    identity_snapshot: {
      legal_name: "Atlas Conseil SARL",
      country_code: "MA",
      identifiers: { ICE: "123456789012345", IF: "12345678", RC: "RC-42" },
      documents: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          type: "REGISTRATION_DOCUMENT",
          sha256: hash,
          status: "VERIFIED",
          scan_status: "CLEAN",
          version: 1,
          expires_on: "2027-01-01",
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          type: "REPRESENTATIVE_AUTHORITY",
          sha256: "b".repeat(64),
          status: "VERIFIED",
          scan_status: "CLEAN",
          version: 1,
          expires_on: null,
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          type: "TAX_DOCUMENT",
          sha256: "c".repeat(64),
          status: "VERIFIED",
          scan_status: "CLEAN",
          version: 1,
          expires_on: null,
        },
      ],
    },
    profile_display: {
      display_name: "Atlas Conseil",
      legal_form: "SARL",
      incorporation_date: "2020-02-20",
      activity: "Conseil",
      sector: "Services",
      registered_city: "Casablanca",
      registered_address: {
        line1: "10 rue Exemple",
        city: "Casablanca",
        postal_code: "20000",
        country_code: "MA",
      },
      representative: {
        first_name: "Amal",
        last_name: "Alami",
        title: "Gérante",
        email: "amal@example.invalid",
        phone: "+212600000001",
        power: "Gérante statutaire",
      },
      can_mutate: true,
    },
    ...overrides,
  };
}

describe("ClientIdentityPanel", () => {
  it("renders Design Authority A sections with Gold Master identity fields", () => {
    const html = renderToStaticMarkup(
      <ClientIdentityPanel
        data={context()}
        locale="fr"
        requestKey="66666666-6666-4666-8666-666666666666"
        messages={getClientIdentityMessages("fr")}
      />,
    );

    expect(html).toContain("Identité de l’organisation");
    expect(html).toContain("Identifiants canoniques");
    expect(html).toContain("Représentant autorisé");
    expect(html).toContain("SARL");
    expect(html).toContain("2020-02-20");
    expect(html).toContain("10 rue Exemple, 20000, Casablanca");
    expect(html).toContain("Amal");
    expect(html).toContain("Gérante statutaire");
    expect(html).toContain("123456789012345");
    expect(html).toContain("Document d’immatriculation");
    expect(html).toContain("Enregistrer la vérification des identifiants");
    expect(html).toContain(`/fr/administration/conformite-clients/${caseId}`);
    expect(html).toContain('name="confirmed"');
    expect(html).toContain('value="yes"');
  });

  it("hides the mutate form for read-only auditors", () => {
    const html = renderToStaticMarkup(
      <ClientIdentityPanel
        data={context({
          profile_display: {
            ...context().profile_display,
            can_mutate: false,
          },
        })}
        locale="fr"
        requestKey="66666666-6666-4666-8666-666666666666"
        messages={getClientIdentityMessages("fr")}
      />,
    );

    expect(html).toContain("Lecture seule");
    expect(html).not.toContain('name="confirmed"');
    expect(html).not.toContain("Enregistrer la vérification des identifiants");
  });

  it("localizes the board in Arabic", () => {
    const html = renderToStaticMarkup(
      <ClientIdentityPanel
        data={context()}
        locale="ar"
        requestKey="66666666-6666-4666-8666-666666666666"
        messages={getClientIdentityMessages("ar")}
      />,
    );

    expect(html).toContain("هوية المؤسسة");
    expect(html).toContain("الممثل المخول");
    expect(html).toContain("توثيق مراجعة المعرّفات");
  });
});
