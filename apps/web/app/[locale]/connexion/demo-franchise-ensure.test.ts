import { describe, expect, it, vi } from "vitest";
import { demoFranchisePersonaIds, demoFranchiseUuid, ensureDemoFranchisePersona, resolveDemoProjectRef } from "./demo-franchise-ensure";

describe("demoFranchiseUuid", () => {
  it("reste déterministe et version-4", () => {
    const first = demoFranchiseUuid("nbqtuybebrhkqmtonhsd:demo:franchise:operator-org");
    const second = demoFranchiseUuid("nbqtuybebrhkqmtonhsd:demo:franchise:operator-org");
    expect(first).toBe(second);
    expect(first[14]).toBe("4");
  });
});

describe("demoFranchisePersonaIds", () => {
  it("dérive org, mandat et franchise depuis le project ref", () => {
    const ids = demoFranchisePersonaIds("nbqtuybebrhkqmtonhsd");
    expect(ids.organizationId).toBe(demoFranchiseUuid("nbqtuybebrhkqmtonhsd:demo:franchise:operator-org"));
    expect(ids.franchiseId).toBe(demoFranchiseUuid("nbqtuybebrhkqmtonhsd:demo:franchise:franchise"));
    expect(ids.membershipId).toBe(demoFranchiseUuid(`${ids.organizationId}:membership`));
  });
});

describe("resolveDemoProjectRef", () => {
  it("lit le hostname Supabase", () => {
    expect(
      resolveDemoProjectRef({
        NEXT_PUBLIC_SUPABASE_URL: "https://nbqtuybebrhkqmtonhsd.supabase.co",
      }),
    ).toBe("nbqtuybebrhkqmtonhsd");
  });
});

describe("ensureDemoFranchisePersona", () => {
  it("appelle la RPC service_role avec les identifiants déterministes", async () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://nbqtuybebrhkqmtonhsd.supabase.co";
    const rpc = vi.fn(async () => ({
      data: { organization_id: "org", franchise_id: "fr" },
      error: null,
    }));
    try {
      const result = await ensureDemoFranchisePersona({
        admin: { rpc },
        userId: "11111111-1111-4111-8111-111111111111",
        email: "demo.franchise@matricia.test",
      });
      expect(result?.organizationId).toBe(demoFranchiseUuid("nbqtuybebrhkqmtonhsd:demo:franchise:operator-org"));
      expect(rpc).toHaveBeenCalledWith(
        "ensure_demo_franchise_persona_v1",
        expect.objectContaining({
          p_user_id: "11111111-1111-4111-8111-111111111111",
          p_email: "demo.franchise@matricia.test",
          p_organization_id: result?.organizationId,
          p_franchise_id: result?.franchiseId,
        }),
      );
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });

  it("échoue fermé si la RPC refuse", async () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://nbqtuybebrhkqmtonhsd.supabase.co";
    const rpc = vi.fn(async () => ({ data: null, error: { message: "denied", code: "42501" } }));
    try {
      await expect(
        ensureDemoFranchisePersona({
          admin: { rpc },
          userId: "11111111-1111-4111-8111-111111111111",
        }),
      ).resolves.toBeNull();
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
  });
});
