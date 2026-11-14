import { describe, expect, it } from "vitest";
import type { AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import { buildHubMetrics } from "./hub-metrics";

const dash = {
  as_of: "2026-11-13T00:00:00.000Z",
  read_only: false,
  organizations: [
    { id: "11111111-1111-4111-8111-111111111111", display_name: "Client A", legal_name: "Client A", status: "ACTIVE", created_at: "2026-09-01T00:00:00.000Z", role_codes: ["CLIENT"], member_count: 2, open_requests: 1, open_disputes: 0 },
    { id: "22222222-2222-4222-8222-222222222222", display_name: "Provider B", legal_name: "Provider B", status: "PENDING", created_at: "2026-09-02T00:00:00.000Z", role_codes: ["PROVIDER"], member_count: 1, open_requests: 0, open_disputes: 1 },
  ],
  requests: [{ id: "33333333-3333-4333-8333-333333333333", organization_id: "11111111-1111-4111-8111-111111111111", organization_name: "Client A", status: "OPEN", library_id: "44444444-4444-4444-8444-444444444444", service_id: "55555555-5555-4555-8555-555555555555", created_at: "2026-09-03T00:00:00.000Z", matching_runs: 1, rfq_count: 1, quote_count: 1 }],
  quotes: [{ id: "66666666-6666-4666-8666-666666666666", rfq_id: "77777777-7777-4777-8777-777777777777", request_id: "33333333-3333-4333-8333-333333333333", provider_organization_id: "22222222-2222-4222-8222-222222222222", provider_name: "Provider B", client_name: "Client A", status: "SUBMITTED", updated_at: null }],
  missions: [{ id: "88888888-8888-4888-8888-888888888888", contract_id: "99999999-9999-4999-8999-999999999999", status: "ACTIVE", client_organization_id: "11111111-1111-4111-8111-111111111111", provider_organization_id: "22222222-2222-4222-8222-222222222222", client_name: "Client A", provider_name: "Provider B", updated_at: null, milestone_count: 1, deliverable_count: 1 }],
  diagnostics: [],
  work_enrichment: {},
  matching: [],
  contracts: [],
  amendments: [],
  documents: [],
  messages: [],
} as unknown as AdminSupervisionDashboard;

describe("buildHubMetrics", () => {
  it("builds KPI strips without charts for every admin hub", () => {
    for (const group of ["home", "actors", "parcours", "catalog", "finance", "growth", "ops"] as const) {
      const metrics = buildHubMetrics(group, dash, "fr");
      expect(metrics.kpis).toHaveLength(4);
      expect(metrics.kpis.every((item) => Number.isFinite(item.value))).toBe(true);
      expect("charts" in metrics).toBe(false);
    }
    expect(buildHubMetrics("actors", dash, "fr").kpis.map((item) => item.value)).toEqual([1, 1, 0, 1]);
  });
});
