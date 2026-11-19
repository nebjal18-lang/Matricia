import { describe, expect, it, vi } from "vitest";
import { ensureDemoPersonaAuthorization } from "./demo-authorization";

describe("ensureDemoPersonaAuthorization", () => {
  it("accorde MATRICIA_ADMIN via RPC pour le persona admin", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const upsert = vi.fn(async () => ({ error: null }));
    const ok = await ensureDemoPersonaAuthorization({
      persona: "admin",
      userId: "11111111-1111-4111-8111-111111111111",
      admin: { rpc, from: () => ({ upsert }) },
    });
    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("ensure_demo_admin_platform_role_v1", {
      p_user_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("retombe sur upsert si la RPC est absente", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "missing", code: "PGRST202" } }));
    const upsert = vi.fn(async () => ({ error: null }));
    const ok = await ensureDemoPersonaAuthorization({
      persona: "admin",
      userId: "11111111-1111-4111-8111-111111111111",
      admin: { rpc, from: () => ({ upsert }) },
    });
    expect(ok).toBe(true);
    expect(upsert).toHaveBeenCalled();
  });

  it("ne touche pas aux autres personas", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const ok = await ensureDemoPersonaAuthorization({
      persona: "client",
      userId: "11111111-1111-4111-8111-111111111111",
      admin: { rpc, from: () => ({ upsert: vi.fn() }) },
    });
    expect(ok).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
