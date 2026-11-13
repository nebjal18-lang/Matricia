import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ server: vi.fn(), user: vi.fn(), rpc: vi.fn(), placements: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: mock.server }));
vi.mock("@/modules/shared/lib/signer-preparation/placement", () => ({ validateSignerPlacements: mock.placements }));
import { PUT } from "./route";
const signerId = "018bbbbb-2222-4333-8444-555555555555";
const workspace = { envelopeId: signerId, signerId, contractId: signerId, amendmentId: null, status: "DRAFT", canConfigure: true, firstName: "", lastName: "", locale: "fr", fields: [], documents: [{id:signerId,sha256:"a".repeat(64),fileName:"contract.pdf",contractVersionId:signerId,locale:"fr"}] };
const params = { params: Promise.resolve({ signerId }) };
const input = { firstName: "Mina", lastName: "Alami", locale: "fr", fields: [{ documentSha256: "a".repeat(64), page: 4, x: 50, y: 600 }] };
function request(body: unknown = input, origin = "https://staging.example") { return new Request(`https://staging.example/api/signatures/yousign/signers/${signerId}/configuration`, { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
describe("explicit YouSign signer preparation", () => {
  beforeEach(() => { vi.clearAllMocks(); mock.server.mockResolvedValue({ auth: { getUser: mock.user }, rpc: mock.rpc }); mock.user.mockResolvedValue({ data: { user: { id: signerId } }, error: null }); mock.placements.mockReset().mockResolvedValue(undefined); mock.rpc.mockImplementation(async (name: string) => ({ data: name === "get_my_yousign_preparation_for_signer_v1" ? workspace : { outcome: "YOUSIGN_SIGNER_CONFIGURED" }, error: null })); });
  it("rejects another origin before authentication", async () => { expect((await PUT(request(input, "https://foreign.example"), params)).status).toBe(403); expect(mock.server).not.toHaveBeenCalled(); });
  it("requires a real user session", async () => { mock.user.mockResolvedValue({ data: { user: null }, error: null }); expect((await PUT(request(), params)).status).toBe(401); expect(mock.rpc).not.toHaveBeenCalled(); });
  it("passes explicit names and document-specific placement through the user-bound RPC", async () => {
    expect((await PUT(request(), params)).status).toBe(200);
    expect(mock.rpc).toHaveBeenCalledWith("configure_yousign_signer_v1", { p_signer_id: signerId, p_first_name: "Mina", p_last_name: "Alami", p_locale: "fr", p_fields: input.fields });
  });
  it("does not invent a placement or signer name", async () => { expect((await PUT(request({ ...input, fields: [] }), params)).status).toBe(400); expect(mock.rpc).not.toHaveBeenCalled(); });
  it("bounds a chunked or undeclared oversized body before authentication", async () => { expect((await PUT(request({ ...input, firstName: "x".repeat(9000) }), params)).status).toBe(413); expect(mock.server).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled(); });
  it("respects tenant denial and frozen source configuration", async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: "42501" } }); expect((await PUT(request(), params)).status).toBe(403);
    mock.rpc.mockResolvedValue({ data: workspace, error: null }); mock.placements.mockRejectedValue(new Error("DOCUMENT_CHANGED")); expect((await PUT(request(), params)).status).toBe(409);
  });
  it("rejects a placement outside the exact PDF before configuration is persisted", async () => { mock.placements.mockRejectedValue(new Error("INVALID_PLACEMENT")); expect((await PUT(request(), params)).status).toBe(400); expect(mock.rpc).not.toHaveBeenCalledWith("configure_yousign_signer_v1", expect.anything()); });
  it("refuses a frozen preparation before reading or writing document bytes", async () => { mock.rpc.mockResolvedValue({data:{...workspace,canConfigure:false},error:null}); expect((await PUT(request(),params)).status).toBe(409); expect(mock.placements).not.toHaveBeenCalled(); });
});
