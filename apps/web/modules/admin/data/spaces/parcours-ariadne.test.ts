import { describe, expect, it } from "vitest";
import type { AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import {
  buildParcoursAriadneChain,
  buildParcoursFilmIndex,
  formatCompleteness,
  formatExclusionReasons,
  formatScoreBasisPoints,
  resolveParcoursFilmIds,
} from "./parcours-ariadne";
import { mapAvenantsRows, mapDemandesRows, mapMatchingRows } from "./parcours-space-rows";

const dash = {
  as_of: "2026-11-18T00:00:00.000Z",
  read_only: true,
  organizations: [],
  requests: [{
    id: "11111111-1111-4111-8111-111111111111",
    organization_id: "22222222-2222-4222-8222-222222222222",
    organization_name: "Client Demo",
    status: "OPEN",
    library_id: "33333333-3333-4333-8333-333333333333",
    service_id: "44444444-4444-4444-8444-444444444444",
    created_at: "2026-09-10T09:00:00.000Z",
    matching_runs: 1,
    rfq_count: 1,
    quote_count: 1,
    title_fr: "Audit SEO Casablanca",
    title_ar: "تدقيق سيو الدار البيضاء",
    domain_label_fr: "Marketing digital",
    domain_label_ar: "تسويق رقمي",
    completeness_percent: 88,
    source_code: "DIAGNOSTIC",
  }],
  quotes: [{
    id: "55555555-5555-4555-8555-555555555555",
    rfq_id: "66666666-6666-4666-8666-666666666666",
    request_id: "11111111-1111-4111-8111-111111111111",
    provider_organization_id: "77777777-7777-4777-8777-777777777777",
    provider_name: "ST Demo",
    client_name: "Client Demo",
    status: "SELECTED",
    version_number: 1,
    currency: "MAD",
    subtotal_minor: "100000",
    tax_minor: "20000",
    total_minor: "120000",
    line_count: 3,
    compliance_label: "CONFORME",
    updated_at: null,
  }],
  missions: [{
    id: "88888888-8888-4888-8888-888888888888",
    contract_id: "99999999-9999-4999-8999-999999999999",
    status: "ACTIVE",
    client_organization_id: "22222222-2222-4222-8222-222222222222",
    provider_organization_id: "77777777-7777-4777-8777-777777777777",
    client_name: "Client Demo",
    provider_name: "ST Demo",
    updated_at: null,
    milestone_count: 1,
    deliverable_count: 0,
  }],
  diagnostics: [],
  work_enrichment: {},
  matching: [{
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    request_id: "11111111-1111-4111-8111-111111111111",
    organization_id: "22222222-2222-4222-8222-222222222222",
    organization_name: "Client Demo",
    status: "COMPLETED",
    policy_version: "MATCH_V1",
    started_at: null,
    eligible_count: 1,
    excluded_count: 1,
    rfq_count: 1,
    candidates: [
      {
        provider_organization_id: "77777777-7777-4777-8777-777777777777",
        provider_name: "ST Demo",
        eligible: true,
        score_basis_points: 8750,
        exclusion_reasons: [],
      },
      {
        provider_organization_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        provider_name: "ST Exclu",
        eligible: false,
        score_basis_points: 3200,
        exclusion_reasons: ["CAPACITY_INSUFFICIENT"],
      },
    ],
  }],
  contracts: [{
    id: "99999999-9999-4999-8999-999999999999",
    status: "ACTIVE",
    current_version: 1,
    client_organization_id: "22222222-2222-4222-8222-222222222222",
    provider_organization_id: "77777777-7777-4777-8777-777777777777",
    client_name: "Client Demo",
    provider_name: "ST Demo",
    signature_count: 2,
    mission_id: "88888888-8888-4888-8888-888888888888",
  }],
  amendments: [{
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    contract_id: "99999999-9999-4999-8999-999999999999",
    status: "DRAFT",
    amendment_number: 1,
    price_delta_minor: "50000",
    client_name: "Client Demo",
    provider_name: "ST Demo",
    client_organization_id: "22222222-2222-4222-8222-222222222222",
    object_fr: "Extension périmètre",
    object_ar: "توسيع النطاق",
    currency: "MAD",
  }],
  documents: [],
  messages: [],
} as unknown as AdminSupervisionDashboard;

describe("parcours ariadne + rows", () => {
  it("indexes the film and builds a clickable chain", () => {
    const index = buildParcoursFilmIndex(dash);
    const ids = resolveParcoursFilmIds(index, { requestId: dash.requests[0]!.id });
    expect(ids.matchingId).toBe(dash.matching[0]!.id);
    expect(ids.quoteId).toBe(dash.quotes[0]!.id);
    expect(ids.contractId).toBe(dash.contracts[0]!.id);
    expect(ids.missionId).toBe(dash.missions[0]!.id);
    const chain = buildParcoursAriadneChain("fr", "", ids);
    expect(chain.map((item) => item.key)).toEqual(["demande", "matching", "devis", "contrat", "mission"]);
    expect(chain[0]?.href).toContain("/administration/demandes/");
  });

  it("maps demandes / matching / avenants to métier cells", () => {
    const demandes = mapDemandesRows("fr", "", dash, true);
    expect(demandes[0]?.cells[1]).toBe("Audit SEO Casablanca");
    expect(demandes[0]?.cells[2]).toBe("Marketing digital");
    expect(demandes[0]?.cells[4]).toBe("88 %");
    expect(demandes[0]?.demoFilm).toBe(true);
    expect(demandes[0]?.chain?.length).toBeGreaterThan(0);

    const matching = mapMatchingRows("fr", "", dash, true);
    expect(matching[0]?.cells[4]).toBe("88 %");
    expect(matching[0]?.cells[5]).toContain("CAPACITY_INSUFFICIENT");

    const avenants = mapAvenantsRows("fr", "", dash, true);
    expect(avenants[0]?.cells[2]).toBe("Extension périmètre");
    expect(avenants[0]?.cells[3]).toContain("500");
  });

  it("formats score, exclusions and completeness", () => {
    expect(formatScoreBasisPoints(8750, "fr")).toBe("88 %");
    expect(formatExclusionReasons([], "fr")).toBe("Aucune exclusion");
    expect(formatCompleteness(55, "ar")).toBe("55٪");
  });
});
