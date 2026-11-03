import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),marketing:vi.fn(),capture:vi.fn(),
}));

vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
}));
vi.mock("@/modules/shared/lib/marketing-autopilot/funnel",()=>({recordMarketingFunnelEvent:mocks.marketing,captureMarketingFunnelTouch:mocks.capture}));
vi.mock("node:crypto", () => ({ randomUUID: () => "11111111-1111-4111-8111-111111111111" }));

import { createOrRequestOrganization, type OrganizationActionState } from "./actions";

const idle: OrganizationActionState = { status: "idle" };
const requestKey = "22222222-2222-4222-8222-222222222222";

function validForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  const values = {
    legalName: "Société Exemple SARL",
    displayName: "Exemple",
    ice: "001-234-567-890-123",
    ownerRole: "CLIENT_OWNER",
    idempotencyKey: requestKey,
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("createOrRequestOrganization", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.rpc.mockReset();mocks.marketing.mockReset();mocks.capture.mockReset();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("valide tous les champs avant tout accès serveur", async () => {
    const result = await createOrRequestOrganization(idle, validForm({ legalName: "A", ice: "12", ownerRole: "ADMIN" }));
    expect(result).toEqual({
      status: "error",
      reason: "VALIDATION",
      fieldErrors: { legalName: true, ice: true, ownerRole: true },
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuse une session absente", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(createOrRequestOrganization(idle, validForm())).resolves.toEqual({ status: "error", reason: "UNAUTHENTICATED" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuse une clé d’idempotence altérée sans appeler le RPC", async () => {
    await expect(createOrRequestOrganization(idle, validForm({ idempotencyKey: "invalid" }))).resolves.toEqual({ status: "error", reason: "UNAVAILABLE" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("normalise l’ICE et transmet la clé d’idempotence au RPC authentifié", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "ORGANIZATION_CREATED",organization_id:"11111111-1111-4111-8111-111111111111" }, error: null });
    await expect(createOrRequestOrganization(idle, validForm())).resolves.toEqual({ status: "success", outcome: "ORGANIZATION_CREATED" });
    expect(mocks.capture.mock.invocationCallOrder[0]).toBeLessThan(mocks.rpc.mock.invocationCallOrder[0]!);
    expect(mocks.marketing).toHaveBeenCalledWith("REGISTRATION_STARTED","11111111-1111-4111-8111-111111111111");
    expect(mocks.rpc).toHaveBeenCalledWith("create_or_request_organization", {
      p_legal_name: "Société Exemple SARL",
      p_display_name: "Exemple",
      p_ice: "001234567890123",
      p_owner_role: "CLIENT_OWNER",
      p_idempotency_key: requestKey,
      p_correlation_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("ne divulgue aucune donnée de l’organisation existante lors d’une demande d’accès", async () => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "ACCESS_REQUESTED", request_id: "request-secret", organization_id: "org-secret" }, error: null });
    const result = await createOrRequestOrganization(idle, validForm());
    expect(result).toEqual({ status: "success", outcome: "ACCESS_REQUESTED" });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(mocks.marketing).not.toHaveBeenCalled();
  });

  it.each([
    ["ALREADY_MEMBER", "ALREADY_MEMBER"],
    ["IDEMPOTENCY_PAYLOAD_MISMATCH", "IDEMPOTENCY_MISMATCH"],
    ["unexpected failure", "UNAVAILABLE"],
  ] as const)("traduit l’erreur serveur %s en erreur stable", async (message, reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(createOrRequestOrganization(idle, validForm())).resolves.toEqual({ status: "error", reason });
  });
});
