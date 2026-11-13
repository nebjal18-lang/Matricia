import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), getUser: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from, rpc: mocks.rpc }),
  getServerAuthUser: async () => mocks.getUser(),
}));
import { loadUserActionCenter } from "./repository";

function query(result: { data: unknown; error: { code: string } | null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit"]) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

const organizationId = "22222222-2222-4222-8222-222222222222";
const notificationId = "33333333-3333-4333-8333-333333333333";
const threadId = "44444444-4444-4444-8444-444444444444";

describe("action center repository", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null });
    mocks.from.mockImplementation((table: string) => table === "organization_memberships"
      ? query({ data: [{ organization_id: organizationId, organizations: { display_name: "Client A" } }], error: null })
      : query({ data: null, error: { code: "42501" } }));
    mocks.rpc.mockImplementation((name: string) => name === "list_notification_center" ? Promise.resolve({ data: { preferences: [], notifications: [{ id: notificationId, category_code: "SECURITY", event_type: "ACCESS_ALERT", locale: "fr-MA", subject: "Accès à vérifier", body: "Une revue est requise.", cta_path: "/fr/securite", priority: "CRITICAL", mandatory: true, read_at: null, row_version: 1, created_at: "2026-09-12T10:00:00+00:00", deliveries: [] }] }, error: null }) : Promise.resolve({ data: [{ id: threadId, object_type: "RFQ", object_id: "55555555-5555-4555-8555-555555555555", service_request_id: "66666666-6666-4666-8666-666666666666", subject: "Clarification", status: "OPEN", contact_policy_version: "v1", participant_organization_id: organizationId, participant_kind: "CLIENT", counterparty_alias: "PROVIDER", created_at: "2026-09-11T10:00:00+00:00", last_message_at: "2026-09-12T09:00:00+00:00", message_count: 2 }], error: null }));
  });

  it("agrège les obligations et messages sans exiger un rôle plateforme", async () => {
    const result = await loadUserActionCenter("fr", "2026-09-12T12:00:00Z");
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.value.items.map((item) => item.kind)).toEqual(["NOTIFICATION", "MESSAGE"]);
      expect(result.value.items[0]?.mandatory).toBe(true);
      expect(result.value.degradedSources).toEqual([]);
    }
    expect(mocks.from).not.toHaveBeenCalledWith("platform_user_roles");
  });
});

