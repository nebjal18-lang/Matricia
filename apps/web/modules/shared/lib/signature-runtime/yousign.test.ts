import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: mock.admin }));
import { consumeGovernedSignatureEnvelope, createYousignRuntime } from "./yousign";
const id = "018bbbbb-2222-4333-8444-555555555555";
describe("governed signature runtime selection", () => {
  beforeEach(() => { vi.clearAllMocks(); mock.admin.mockReturnValue({ rpc: mock.rpc }); });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects production before constructing an admin client", () => {
    vi.stubEnv("APP_ENV", "production");
    expect(() => createYousignRuntime()).toThrow("YOUSIGN_SANDBOX_CONFIGURATION_REQUIRED");
    expect(mock.admin).not.toHaveBeenCalled();
  });
  it("requires explicit sandbox mode and code even on staging", () => {
    vi.stubEnv("APP_ENV", "staging"); vi.stubEnv("SIGNATURE_PROVIDER_MODE", "DEVELOPMENT_MOCK");
    expect(() => createYousignRuntime()).toThrow("YOUSIGN_SANDBOX_CONFIGURATION_REQUIRED");
    expect(mock.admin).not.toHaveBeenCalled();
  });
  it("validates the exact identifier before privileged lookup", async () => {
    expect(await consumeGovernedSignatureEnvelope("../other")).toMatchObject({ ok: false, code: "SIGNATURE_ENVELOPE_PAYLOAD_INVALID" });
    expect(mock.admin).not.toHaveBeenCalled();
  });
  it("preserves the governed SQL mock path only for its explicit provider", async () => {
    mock.rpc.mockResolvedValueOnce({ data: "MATRICIA_DEV_MOCK", error: null }).mockResolvedValueOnce({ data: { outcome: "SIGNATURE_ENVELOPE_SENT" }, error: null });
    expect(await consumeGovernedSignatureEnvelope(id)).toEqual({ ok: true, code: "SIGNATURE_ENVELOPE_SENT", developmentMock: true });
    expect(mock.rpc).toHaveBeenNthCalledWith(1, "get_signature_dispatch_provider_v1", { p_envelope_id: id });
    expect(mock.rpc).toHaveBeenNthCalledWith(2, "dispatch_governed_signature_envelope_v1", { p_envelope_id: id });
  });
  it("does not disguise another provider as a development simulation", async () => {
    mock.rpc.mockResolvedValue({ data: "UNREGISTERED", error: null });
    expect(await consumeGovernedSignatureEnvelope(id)).toEqual({ ok: false, code: "SIGNATURE_PROVIDER_NOT_REGISTERED", developmentMock: false });
    expect(mock.rpc).toHaveBeenCalledOnce();
  });
  it("does not fall back to the mock when YouSign configuration is incomplete", async () => {
    mock.rpc.mockResolvedValue({ data: "YOUSIGN", error: null }); vi.stubEnv("APP_ENV", "production");
    expect(await consumeGovernedSignatureEnvelope(id)).toEqual({ ok: false, code: "SIGNATURE_PROVIDER_DISPATCH_UNAVAILABLE", developmentMock: false });
    expect(mock.rpc).toHaveBeenCalledOnce();
  });
  it("does not acknowledge a missing SQL provider receipt", async () => {
    mock.rpc.mockResolvedValueOnce({ data: "MATRICIA_DEV_MOCK", error: null }).mockResolvedValueOnce({ data: { outcome: "UNKNOWN" }, error: null });
    expect(await consumeGovernedSignatureEnvelope(id)).toMatchObject({ ok: false });
  });
});
