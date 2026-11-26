import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureDemoRegionalActor = vi.fn();

vi.mock("./demo-regional-ensure", () => ({
  ensureDemoRegionalActor: (...args: unknown[]) => ensureDemoRegionalActor(...args),
}));

import { ensureDemoClientComFilm } from "./demo-client-com-film-ensure";

const client = {
  kind: "client" as const,
  persona: "client" as const,
  territoryCode: "TANGER_TETOUAN_AL_HOCEIMA",
  territoryNameFr: "Tanger",
  territoryNameAr: "طنجة",
  slot: "1",
  email: "demo.client.tanger-tetouan-al-hoceima.1@matricia.test",
  labelFr: "Hôtel Bayt Al Bahar",
  labelAr: "فندق بيت البحر",
};

describe("ensureDemoClientComFilm", () => {
  beforeEach(() => {
    ensureDemoRegionalActor.mockReset();
  });

  it("seeds after providers A/B are ensured", async () => {
    ensureDemoRegionalActor
      .mockResolvedValueOnce({ userId: "00000000-0000-4000-8000-000000000001", organizationId: "00000000-0000-4000-8000-000000000011" })
      .mockResolvedValueOnce({ userId: "00000000-0000-4000-8000-000000000002", organizationId: "00000000-0000-4000-8000-000000000012" });
    const rpc = vi.fn(async () => ({ data: { dispute_count: 0 }, error: null }));
    const admin = {
      auth: { admin: { getUserById: vi.fn(), listUsers: vi.fn(), createUser: vi.fn(), updateUserById: vi.fn() } },
      rpc,
    };

    await expect(
      ensureDemoClientComFilm({
        admin,
        client,
        clientUserId: "00000000-0000-4000-8000-000000000099",
        clientOrganizationId: "00000000-0000-4000-8000-000000000010",
      }),
    ).resolves.toBe(true);

    expect(ensureDemoRegionalActor).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith(
      "ensure_demo_client_com_film_v1",
      expect.objectContaining({
        p_client_organization_id: "00000000-0000-4000-8000-000000000010",
        p_provider_a_organization_id: "00000000-0000-4000-8000-000000000011",
        p_provider_b_organization_id: "00000000-0000-4000-8000-000000000012",
      }),
    );
  });

  it("returns false for non-client personas", async () => {
    await expect(
      ensureDemoClientComFilm({
        admin: { auth: { admin: { getUserById: vi.fn(), listUsers: vi.fn(), createUser: vi.fn(), updateUserById: vi.fn() } }, rpc: vi.fn() },
        client: { ...client, persona: "provider", kind: "provider", slot: "A", email: "demo.st@matricia.test" },
        clientUserId: "00000000-0000-4000-8000-000000000099",
        clientOrganizationId: "00000000-0000-4000-8000-000000000010",
      }),
    ).resolves.toBe(false);
    expect(ensureDemoRegionalActor).not.toHaveBeenCalled();
  });
});
