import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAdminSpace: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
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
  AdminAppShell: ({ children, parcoursCurrent }: { children: ReactNode; parcoursCurrent?: string }) => <div data-parcours={parcoursCurrent}>{children}</div>,
  AdminCrumb: () => <nav>crumb</nav>,
}));
vi.mock("@/modules/admin/screens/franchise-applications/review-forms", () => ({
  FranchiseApplicationReview: () => <div data-review="true" />,
}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

import FranchiseApplicationsPage from "./page";

function query(result: { data: unknown; error: null }) {
  const api: Record<string, unknown> = {};
  const next = () => api;
  api.select = next;
  api.in = next;
  api.eq = next;
  api.order = next;
  api.limit = async () => result;
  api.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return api;
}

describe("FranchiseApplicationsPage", () => {
  beforeEach(() => {
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
