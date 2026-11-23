import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAdminSpace: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  review: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("notFound");
  },
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  },
}));
vi.mock("@/modules/admin/data/spaces/context", () => ({ resolveAdminSpace: mocks.resolveAdminSpace }));
vi.mock("@/modules/admin/ui/admin-app-shell", () => ({
  AdminAppShell: ({ children, parcoursCurrent, actorCurrent }: { children: ReactNode; parcoursCurrent?: string; actorCurrent?: string }) => (
    <div data-parcours={parcoursCurrent ?? actorCurrent}>{children}</div>
  ),
  AdminCrumb: () => <nav>crumb</nav>,
}));
vi.mock("@/modules/admin/screens/franchise-applications/review-forms", () => ({
  FranchiseApplicationReview: (props: unknown) => { mocks.review(props); return <div data-review="true" />; },
}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

import FranchiseApplicationsPage from "./page";

function query(result: { data: unknown; error: { code: string } | null }) {
  const api: Record<string, unknown> = {};
  const next = () => api;
  api.select = next;
  api.in = next;
  api.eq = next;
  api.order = next;
  api.limit = async () => result;
  api.range = async () => result;
  api.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return api;
}

describe("FranchiseApplicationsPage", () => {
  beforeEach(() => {
    mocks.review.mockReset();
    mocks.resolveAdminSpace.mockResolvedValue({
      status: "success",
      selectedQuery: "",
      selectedOrganizationId: null,
      userEmail: "admin@example.invalid",
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } } });
    mocks.from.mockImplementation((table: string) => {
      if (table === "franchise_applications") {
        return query({
          data: [{
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            applicant_name: "Hatim Ahmitech",
            reply_email: "parcours.franchise@matricia.test",
            territory_code: "CASABLANCA_SETTAT",
            domain_label: "IT — Informatique, cybersécurité et data",
            status: "ACTIVE",
            organization_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            franchise_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            row_version: 1,
            created_at: "2026-11-01T10:00:00.000Z",
          }],
          error: null,
        });
      }
      if (table === "organizations") {
        return query({
          data: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", display_name: "Ahmitech" }],
          error: null,
        });
      }
      return query({ data: [], error: null });
    });
  });

  it("renders a dense human card without dumping UUID fragments", async () => {
    const html = renderToStaticMarkup(await FranchiseApplicationsPage({
      params: Promise.resolve({ locale: "fr" }),
      searchParams: Promise.resolve({}),
    }));
    expect(html).toContain('data-parcours="franchise-applications"');
    expect(html).toContain("Hatim Ahmitech");
    expect(html).toContain("Franchise active");
    expect(html).toContain("admin-franchise-card");
    expect(html).toContain("admin-franchise-card__avatar");
    expect(html).toContain("admin-franchise-card__pipeline");
    expect(html).toContain("admin-franchise-applications__stats");
    expect(html).toContain('data-tone="ok"');
    expect(html).toContain("Gouvernance du mandat");
    expect(html).toContain("Ahmitech");
    expect(html).toContain("Liée");
    expect(html).toContain("Franchise active — aucune action de revue");
    expect(html).toContain("À traiter");
    expect(html).not.toContain("Organisation rattachée");
    expect(html).not.toContain("BBBBBBBB");
    expect(html).not.toMatch(/ACTIVE\s*·\s*[0-9A-F]{8}/i);
  });

  it("keeps persisted IDs under the demo flag and blocks review on failed related reads", async () => {
    vi.stubEnv("MATRICIA_DEMO_ACCESS_ENABLED", "true");
    vi.stubEnv("APP_ENV", "development");
    mocks.from.mockImplementation((table: string) => query(table === "franchise_applications" ? {
      data: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", applicant_name: "Persisted candidate", reply_email: "candidate@example.invalid", territory_code: "CASABLANCA_SETTAT", domain_label: "IT", status: "CONTRACT_PENDING", organization_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", franchise_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", row_version: 7, created_at: "2026-11-01T10:00:00.000Z" }], error: null,
    } : { data: null, error: { code: "42501" } }));
    try {
      const html = renderToStaticMarkup(await FranchiseApplicationsPage({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve({ fixtures: "1" }) }));
      expect(html).toContain("Persisted candidate");
      expect(html).toContain("Données de revue indisponibles");
      expect(mocks.review).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });

  it("exposes continuation instead of silently truncating the 51st application", async () => {
    mocks.from.mockImplementation((table: string) => query({ data: table === "franchise_applications" ? Array.from({ length: 51 }, (_, index) => ({ id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index).padStart(12, "0")}`, applicant_name: `Candidate ${index}`, reply_email: "candidate@example.invalid", territory_code: "CASABLANCA_SETTAT", domain_label: "IT", status: "REGISTERED", organization_id: null, franchise_id: null, row_version: 1, created_at: "2026-11-01T10:00:00.000Z" })) : [], error: null }));
    const html = renderToStaticMarkup(await FranchiseApplicationsPage({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve({ fixtures: "1" }) }));
    expect(html).toContain("page=2");
    expect(html).toContain("Candidate 49");
    expect(html).not.toContain("Candidate 50");
    expect(mocks.review.mock.calls[0]?.[0]).toMatchObject({ application: { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000000", rowVersion: 1 } });
  });

  it("keeps the persisted empty state when demo flag is on", async () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    mocks.from.mockImplementation(() => query({ data: [], error: null }));
    const html = renderToStaticMarkup(await FranchiseApplicationsPage({
      params: Promise.resolve({ locale: "fr" }),
      searchParams: Promise.resolve({}),
    }));
    expect(html).not.toContain("admin-franchise-card");
    expect(html).not.toContain("@matricia.test");
    expect(html).toContain("Inscrit");
    expect(html).toContain("Revue de la société");
    expect(html).toContain("Pièces demandées");
    expect(html).toContain("Mandat proposé");
    expect(html).toContain("À traiter");
    expect(html).toContain("Aucune candidature sur cette page.");
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("hides fixture applications by default and exposes a treat filter", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "franchise_applications") {
        return query({
          data: [
            {
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              applicant_name: "Hatim Ahmitech",
              reply_email: "parcours.franchise@matricia.test",
              territory_code: "CASABLANCA_SETTAT",
              domain_label: "IT — Informatique, cybersécurité et data",
              status: "ACTIVE",
              organization_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              franchise_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              row_version: 1,
              created_at: "2026-11-01T10:00:00.000Z",
            },
            {
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              applicant_name: "TEST AUDIT 20261105 Franchisé",
              reply_email: "audit.franchise.20261105@example.com",
              territory_code: "CASABLANCA_SETTAT",
              domain_label: "IT — Informatique, cybersécurité et data",
              status: "REGISTERED",
              organization_id: null,
              franchise_id: null,
              row_version: 1,
              created_at: "2026-11-05T12:00:00.000Z",
            },
          ],
          error: null,
        });
      }
      if (table === "organizations") {
        return query({
          data: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", display_name: "Ahmitech" }],
          error: null,
        });
      }
      return query({ data: [], error: null });
    });
    const html = renderToStaticMarkup(await FranchiseApplicationsPage({
      params: Promise.resolve({ locale: "fr" }),
      searchParams: Promise.resolve({}),
    }));
    expect(html).toContain("Hatim Ahmitech");
    expect(html).not.toContain("TEST AUDIT 20261105");
    expect(html).toContain("fixtures=1");
    expect(html).toContain("vue=treat");
  });
});
