import { describe, expect, it } from "vitest";

import {
  clientIdentityContextSchema,
  displayValue,
  formatAddress,
} from "@/modules/admin/screens/client-identity/model";

const hash = "a".repeat(64);
const caseId = "11111111-1111-4111-8111-111111111111";
const orgId = "22222222-2222-4222-8222-222222222222";
const docId = "33333333-3333-4333-8333-333333333333";

function fixture(overrides: Record<string, unknown> = {}) {
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
          id: docId,
          type: "REGISTRATION_DOCUMENT",
          sha256: hash,
          status: "VERIFIED",
          scan_status: "CLEAN",
          version: 1,
          expires_on: "2027-01-01",
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

describe("client identity review model", () => {
  it("accepts Gold Master display fields outside the hashed snapshot", () => {
    const parsed = clientIdentityContextSchema.parse(fixture());
    expect(parsed.profile_display.legal_form).toBe("SARL");
    expect(parsed.profile_display.representative?.title).toBe("Gérante");
    expect(parsed.identity_snapshot.documents[0]?.type).toBe("REGISTRATION_DOCUMENT");
  });

  it("defaults profile_display when the RPC omits the enrichment", () => {
    const raw = fixture();
    delete (raw as { profile_display?: unknown }).profile_display;
    const parsed = clientIdentityContextSchema.parse(raw);
    expect(parsed.profile_display.can_mutate).toBe(true);
    expect(parsed.profile_display.registered_address).toEqual({});
  });

  it("formats address and empty values for the review board", () => {
    expect(formatAddress({ line1: "10 rue Exemple", city: "Casablanca" }, "—")).toBe(
      "10 rue Exemple, Casablanca",
    );
    expect(formatAddress({}, "—")).toBe("—");
    expect(displayValue("  ", "—")).toBe("—");
    expect(displayValue("SARL", "—")).toBe("SARL");
  });
});
