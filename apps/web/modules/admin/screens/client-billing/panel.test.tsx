import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock("./actions", () => ({
  manageClientBilling: async () => ({ status: "idle" }),
}));

import { ClientBillingPanel } from "./panel";
import type { ClientBillingConsole } from "./model";

const empty: ClientBillingConsole = {
  page: 1,
  has_next: false,
  policies: [],
  sources: [],
};

describe("ClientBillingPanel empty sources copy", () => {
  it("shows fiscal prerequisite when no approved policy exists (draft-only counts as missing)", () => {
    const data: ClientBillingConsole = {
      ...empty,
      policies: [{
        id: "11111111-1111-4111-8111-111111111111",
        series_key: "TEST",
        version: 1,
        currency: "MAD",
        tax_rate_bps: 2000,
        tax_label_fr: "TVA",
        tax_label_ar: "ضريبة",
        jurisdiction: "MA",
        valid_from: "2026-01-01",
        invoice_prefix: "FAC",
        credit_prefix: "AVO",
        invoice_start_number: "1",
        credit_start_number: "1",
        service_label_fr: "Service",
        service_label_ar: "خدمة",
        approval_reference: "REF",
        issuer_snapshot: { legal_name: "Matricia" },
        created_by: "22222222-2222-4222-8222-222222222222",
        approval: null,
      }],
    };
    const html = renderToStaticMarkup(
      <ClientBillingPanel locale="fr" data={data} actorId="33333333-3333-4333-8333-333333333333" keys={{ create: "44444444-4444-4444-8444-444444444444" }} />,
    );
    expect(html).toContain("Aucune politique fiscale approuvée ne couvre les devises/dates");
    expect(html).not.toContain("Aucune source accessible dans ce périmètre");
  });

  it("shows source-perimeter copy when an approved policy exists but sources are empty", () => {
    const data: ClientBillingConsole = {
      ...empty,
      policies: [{
        id: "11111111-1111-4111-8111-111111111111",
        series_key: "TEST",
        version: 1,
        currency: "MAD",
        tax_rate_bps: 0,
        tax_label_fr: "Exonération",
        tax_label_ar: "إعفاء",
        jurisdiction: "MA",
        valid_from: "2026-01-01",
        invoice_prefix: "FAC",
        credit_prefix: "AVO",
        invoice_start_number: "1",
        credit_start_number: "1",
        service_label_fr: "Service",
        service_label_ar: "خدمة",
        approval_reference: "REF",
        issuer_snapshot: { legal_name: "Matricia" },
        created_by: "22222222-2222-4222-8222-222222222222",
        approval: {
          decision: "APPROVED",
          decided_by: "55555555-5555-4555-8555-555555555555",
          reason: "ok",
          decided_at: "2026-01-02T00:00:00.000Z",
        },
      }],
    };
    const html = renderToStaticMarkup(
      <ClientBillingPanel locale="fr" data={data} actorId="33333333-3333-4333-8333-333333333333" keys={{ create: "44444444-4444-4444-8444-444444444444" }} />,
    );
    expect(html).toContain("Aucune source accessible dans ce périmètre");
    expect(html).not.toContain("Aucune politique fiscale approuvée ne couvre les devises/dates");
  });
});
