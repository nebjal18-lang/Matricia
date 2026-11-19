import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [{ status: "idle" }, "review-action", false],
    useId: () => "provider-identity",
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

vi.mock("@/modules/admin/screens/provider-identity/actions", () => ({
  revalidateProviderIdentity: vi.fn(async () => ({ status: "idle" })),
}));

import { getProviderIdentityMessages } from "@/modules/admin/screens/provider-identity/messages";
import type { ProviderIdentityReview } from "@/modules/admin/screens/provider-identity/model";
import { ProviderIdentityReviewPanel } from "@/modules/admin/screens/provider-identity/panel";

const id = "11111111-1111-4111-8111-111111111111";
const hash = "a".repeat(64);

const data: ProviderIdentityReview = {
  organization_id: id,
  organization_row_version: 2,
  profile_row_version: 3,
  organization_status: "ACTIVE",
  identity_snapshot: {
    legal_name: "Atelier Prestataire",
    country_code: "MA",
    identifiers: { ICE: "123456789012345", IF: "12345678", RC: "RC-9" },
  },
  identity_hash: hash,
  company_decision_id: id,
  document_version_ids: [id, "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"],
  canonical_client_legal_profile: {
    legal_form: "SARL",
    registered_city: "Rabat",
    registered_address: { line1: "1 avenue Test", country_code: "MA" },
  },
  canonical_organization_profile: {
    version: 3,
    profile: {
      legal_form: "SARL",
      incorporation_date: "2019-01-01",
      activity: "Maintenance",
      sector: "Services",
      employee_count: 4,
      registered_city: "Rabat",
      registered_address: { line1: "1 avenue Test", country_code: "MA" },
      contact: { phone: "0600000000", email: "contact@example.invalid" },
      representative: {
        first_name: "Nora",
        last_name: "Benali",
        title: "Gérante",
        email: "nora@example.invalid",
        phone: "0600000001",
        power: "Mandat déclaré",
      },
      declarations: { accuracy_confirmed: true, representation_authorized: true },
      if_number: "12345678",
      rc_number: "RC-9",
    },
  },
  currently_verified: false,
};

describe("ProviderIdentityReviewPanel", () => {
  it("renders Gold Master identity fields with Version A colors", () => {
    const html = renderToStaticMarkup(
      <ProviderIdentityReviewPanel
        data={data}
        locale="fr"
        requestKey={id}
        messages={getProviderIdentityMessages("fr")}
      />,
    );
    expect(html).toContain("Atelier Prestataire");
    expect(html).toContain("Identité de l’organisation");
    expect(html).toContain("SARL");
    expect(html).toContain("Nora");
    expect(html).toContain("Mandat déclaré");
    expect(html).toContain('data-tone="mint"');
    expect(html).toContain('name="confirmed"');
  });
});
