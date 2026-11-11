import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ admin: vi.fn(), rpc: vi.fn(), environment: vi.fn() }));
vi.mock("@/modules/shared/lib/platform-configuration/runtime", () => ({ getPlatformRuntimeEnvironment: mock.environment }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: mock.admin }));
import { consumeGovernedSignatureEnvelope, createYousignRuntime } from "./yousign";
const id = "018bbbbb-2222-4333-8444-555555555555";
describe("governed signature runtime selection", () => {
  beforeEach(() => { vi.clearAllMocks(); mock.admin.mockReturnValue({ rpc: mock.rpc }); mock.environment.mockImplementation(async () => ({...process.env})); });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects production without explicit live mode before constructing an admin client", async () => {
    vi.stubEnv("APP_ENV", "production");
    await expect(createYousignRuntime()).rejects.toThrow("YOUSIGN_CONFIGURATION_REQUIRED");
    expect(mock.admin).not.toHaveBeenCalled();
  });
  it("requires explicit sandbox mode and code even on staging", async () => {
    vi.stubEnv("APP_ENV", "staging"); vi.stubEnv("SIGNATURE_PROVIDER_MODE", "DEVELOPMENT_MOCK");
    await expect(createYousignRuntime()).rejects.toThrow("YOUSIGN_CONFIGURATION_REQUIRED");
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


describe("YouSign trusted runtime environment", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mock.admin.mockReturnValue({rpc: mock.rpc});
    mock.environment.mockResolvedValue({ APP_ENV: "production", YOUSIGN_ENVIRONMENT: "live", SIGNATURE_PROVIDER_MODE: "EXTERNAL", SIGNATURE_PROVIDER_CODE: "YOUSIGN", YOUSIGN_API_KEY: "synthetic-live-unit-key", YOUSIGN_WEBHOOK_SECRET: "unit-only-long-webhook-secret-32-characters" });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("rejects a claimed live APP_ENV if the trusted database is staging", async () => {
    mock.rpc.mockResolvedValueOnce({data: "STAGING", error: null});
    await expect(createYousignRuntime()).rejects.toThrow("YOUSIGN_DEPLOYMENT_ENVIRONMENT_MISMATCH");
    expect(mock.rpc).toHaveBeenCalledWith("get_yousign_runtime_environment_v1", {});
  });
  it("constructs the live runtime only after the trusted production tag matches", async () => {
    mock.rpc.mockResolvedValueOnce({data: "PRODUCTION", error: null});
    await expect(createYousignRuntime()).resolves.toMatchObject({execute: expect.any(Function), webhook: expect.any(Function)});
    expect(mock.rpc).toHaveBeenCalledOnce();
  });
  it("does not send before the current independently approved SQL policy admits a claim", async () => {
    mock.rpc.mockResolvedValueOnce({data: "PRODUCTION", error: null}).mockResolvedValueOnce({data: null, error: {code: "55000"}});
    const runtime = await createYousignRuntime();
    await expect(runtime.execute(id, "SEND", "unit-only-send-operation")).rejects.toThrow("YOUSIGN_REPOSITORY_UNAVAILABLE");
    expect(mock.rpc).toHaveBeenLastCalledWith("begin_yousign_dispatch_v1", {p_envelope_id: id, p_operation: "SEND", p_key: "unit-only-send-operation"});
  });
});
