import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), adminRpc: vi.fn(), admin: vi.fn(), download: vi.fn(), scan: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.auth }, rpc: mocks.rpc }) }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: mocks.admin }));
vi.mock("./scan-consumer", () => ({ scanOneFinanceCostDocument: mocks.scan }));
import { transferFinanceCostDocument } from "./server";
const id = "e3700000-0000-4000-8000-000000000001", actor = "e3700000-0000-4000-8000-000000000002", capability = "e3700000-0000-4000-8000-000000000003";
const bytes = Buffer.from("%PDF-1.4\nTEST finance evidence\n%%EOF\n"), hash = createHash("sha256").update(bytes).digest("hex");
const source = { upload_id: id, bucket: "finance-cost-proofs", path: `finance-cost/${id}`, sha256: hash, size_bytes: bytes.length, mime_type: "application/pdf", file_name: "وثيقة-المصاريف.pdf", actor_id: actor, read_capability_id: capability };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id: actor } }, error: null });
  mocks.rpc.mockImplementation(async (name: string) => name === "get_finance_cost_upload_context_v1" ? { data: { ...source, status: "UPLOADED", scan_status: "CLEAN" }, error: null } : name === "commit_finance_cost_document_upload_v1" ? { data: { outcome: "FINANCE_COST_DOCUMENT_UPLOADED", upload_id: id, scan_status: "PENDING" }, error: null } : { data: source, error: null });
  mocks.admin.mockReturnValue({ rpc: mocks.adminRpc, storage: { from: () => ({ download: mocks.download }) } });
  mocks.download.mockResolvedValue({ data: new Blob([bytes]), error: null });
  mocks.adminRpc.mockResolvedValue({ data: { outcome: "FINANCE_COST_DOCUMENT_READ_RECORDED", upload_id: id }, error: null });
  mocks.scan.mockResolvedValue({ ok: true, code: "FINANCE_COST_DOCUMENT_SCAN_RECORDED", scanStatus: "CLEAN" });
});
afterEach(() => { vi.useRealTimers(); });
describe("Finance private evidence transfer", () => {
  it("records actual bytes before returning a private audited download", async () => {
    const response = await transferFinanceCostDocument(id, false);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(mocks.rpc).toHaveBeenCalledWith("authorize_finance_cost_document_read_v1", { p_upload_id: id });
    expect(mocks.adminRpc).toHaveBeenCalledWith("record_finance_cost_document_read_v1", { p_capability_id: capability, p_computed_sha256: hash, p_computed_size_bytes: bytes.length });
    expect(response.headers.get("x-matricia-file-sha256")).toBe(hash);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8");
  });
  it("does not use the service client before native session authorization", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect((await transferFinanceCostDocument(id, false)).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each([{ path: "finance-cost/e3700000-0000-4000-8000-000000000099" }, { bucket: "public" }, { actor_id: capability }])("rejects an inconsistent authorization %j before a privileged read", async (overrides) => {
    mocks.rpc.mockResolvedValue({ data: { ...source, ...overrides }, error: null });
    expect((await transferFinanceCostDocument(id, false)).status).toBe(503);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("distinguishes missing MFA from missing Finance permission without inferring from HTTP403", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "FINANCE_COST_MFA_REQUIRED" } });
    const mfa = await transferFinanceCostDocument(id, false);
    expect(mfa.status).toBe(403);
    expect(await mfa.json()).toEqual({ code: "FINANCE_COST_MFA_REQUIRED" });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "FINANCE_COST_DOCUMENT_READ_DENIED" } });
    const role = await transferFinanceCostDocument(id, false);
    expect(role.status).toBe(403);
    expect(await role.json()).toEqual({ code: "FINANCE_COST_DOCUMENT_ACCESS_DENIED" });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("keeps an Auth outage distinct from an absent session", async () => {
    mocks.auth.mockResolvedValue({ data: { user: { id: actor } }, error: { status: 503, name: "AuthRetryableFetchError" } });
    expect((await transferFinanceCostDocument(id, false)).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
    expect((await transferFinanceCostDocument(id, false)).status).toBe(401);
  });
  it("never returns corrupt private bytes or a false download receipt", async () => {
    mocks.download.mockResolvedValue({ data: new Blob([Buffer.from("x".repeat(bytes.length))]), error: null });
    expect((await transferFinanceCostDocument(id, false)).status).toBe(409);
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it("does not return evidence when native recording of actual retrieval fails", async () => {
    mocks.adminRpc.mockResolvedValue({ data: null, error: { code: "08006" } });
    expect((await transferFinanceCostDocument(id, false)).status).toBe(503);
  });
  it("commits actual upload bytes before invoking the trusted scanner", async () => {
    const response = await transferFinanceCostDocument(id, true);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: "FINANCE_COST_DOCUMENT_UPLOADED", upload_id: id, scan_status: "CLEAN" });
    expect(mocks.rpc).toHaveBeenCalledWith("commit_finance_cost_document_upload_v1", { p_upload_id: id, p_computed_sha256: hash, p_computed_size_bytes: bytes.length });
    expect(mocks.scan).toHaveBeenCalledWith(expect.anything(), id);
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it("returns the actual pending native state after a scanner outage", async () => {
    mocks.scan.mockResolvedValue({ ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE" });
    mocks.rpc.mockImplementation(async (name: string) => name === "commit_finance_cost_document_upload_v1" ? { data: { outcome: "FINANCE_COST_DOCUMENT_UPLOADED", upload_id: id, scan_status: "PENDING" }, error: null } : { data: { ...source, status: "UPLOADED", scan_status: "PENDING" }, error: null });
    const response = await transferFinanceCostDocument(id, true);
    expect(response.status).toBe(200);
    expect((await response.json()).scan_status).toBe("PENDING");
  });
  it("returns the durable pending state when the inline scan reaches its bounded response budget", async () => {
    vi.useFakeTimers();
    mocks.scan.mockReturnValue(new Promise(() => undefined));
    mocks.rpc.mockImplementation(async (name: string) => name === "commit_finance_cost_document_upload_v1" ? { data: { outcome: "FINANCE_COST_DOCUMENT_UPLOADED", upload_id: id, scan_status: "PENDING" }, error: null } : { data: { ...source, status: "UPLOADED", scan_status: "PENDING" }, error: null });
    const pending = transferFinanceCostDocument(id, true);
    await vi.advanceTimersByTimeAsync(20_001);
    const response = await pending;
    expect(response.status).toBe(200);
    expect((await response.json()).scan_status).toBe("PENDING");
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it("rejects a media mismatch before committing or scanning an upload", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...source, mime_type: "image/png", status: "RESERVED", scan_status: "PENDING" }, error: null });
    expect((await transferFinanceCostDocument(id, true)).status).toBe(422);
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith("commit_finance_cost_document_upload_v1", expect.anything());
  });
});
