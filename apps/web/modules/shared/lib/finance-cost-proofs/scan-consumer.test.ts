import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ scan: vi.fn() }));
vi.mock("@/modules/shared/lib/document-scanning/scanner", () => ({ scanDocumentBytes: mocks.scan }));
import { scanOneFinanceCostDocument } from "./scan-consumer";
const id = "e3700000-0000-4000-8000-000000000001";
const lease = "e3700000-0000-4000-8000-000000000002";
const bytes = Buffer.from("%PDF-1.4\nTEST finance evidence\n%%EOF\n");
const hash = createHash("sha256").update(bytes).digest("hex");
const claim = { upload_id: id, lease_token: lease, row_version: 3, bucket: "finance-cost-proofs", path: `finance-cost/${id}`, expected_sha256: hash, mime_type: "application/pdf", size_bytes: bytes.length };
function client() {
  const download = vi.fn().mockResolvedValue({ data: new Blob([bytes]), error: null });
  const rpc = vi.fn().mockImplementation(async (name: string) => name === "claim_finance_cost_document_scan_jobs_v1"
    ? { data: [claim], error: null } : { data: { outcome: "FINANCE_COST_DOCUMENT_SCAN_RECORDED", upload_id: id, scan_status: "CLEAN" }, error: null });
  return { rpc, storage: { from: vi.fn(() => ({ download })) }, download };
}
beforeEach(() => { vi.clearAllMocks(); mocks.scan.mockResolvedValue({ result: "CLEAN", engineCode: "TEST_SIGNED_SCANNER", engineVersion: "test-only" }); });
describe("trusted Finance evidence scan", () => {
  it("downloads exact private bytes and submits the leased actual hash and size", async () => {
    const c = client();
    expect(await scanOneFinanceCostDocument(c as never, id)).toMatchObject({ ok: true, scanStatus: "CLEAN" });
    expect(c.download).toHaveBeenCalledWith(`finance-cost/${id}`);
    expect(mocks.scan).toHaveBeenCalledWith(bytes, hash, "application/pdf");
    expect(c.rpc).toHaveBeenLastCalledWith("complete_finance_cost_document_scan_v1", expect.objectContaining({ p_upload_id: id, p_lease_token: lease, p_expected_row_version: 3, p_computed_sha256: hash, p_computed_size_bytes: bytes.length, p_result: "CLEAN" }));
  });
  it("blocks a mismatched claim before any privileged storage read", async () => {
    const c = client(); c.rpc.mockResolvedValueOnce({ data: [{ ...claim, path: "other-target/private.pdf" }], error: null });
    expect((await scanOneFinanceCostDocument(c as never, id)).ok).toBe(false);
    expect(c.storage.from).not.toHaveBeenCalled();
  });
  it("never asks an antivirus to certify bytes whose hash differs", async () => {
    const c = client(); c.download.mockResolvedValue({ data: new Blob([Buffer.from("x".repeat(bytes.length))]), error: null });
    c.rpc.mockResolvedValueOnce({ data: [claim], error: null }).mockResolvedValueOnce({ data: { outcome: "FINANCE_COST_DOCUMENT_SCAN_RECORDED", upload_id: id, scan_status: "ERROR" }, error: null });
    expect(await scanOneFinanceCostDocument(c as never, id)).toMatchObject({ ok: false, scanStatus: "ERROR" });
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(c.rpc).toHaveBeenLastCalledWith("complete_finance_cost_document_scan_v1", expect.objectContaining({ p_result: "ERROR", p_engine_code: "MATRICIA_HASH_GUARD" }));
  });
  it("records unavailable storage as unknown bytes, never as a fabricated computed hash", async () => {
    const c = client(); c.download.mockResolvedValue({ data: null, error: { message: "unavailable" } } as never);
    c.rpc.mockResolvedValueOnce({ data: [claim], error: null }).mockResolvedValueOnce({ data: { outcome: "FINANCE_COST_DOCUMENT_SCAN_RECORDED", upload_id: id, scan_status: "ERROR" }, error: null });
    expect((await scanOneFinanceCostDocument(c as never, id)).ok).toBe(false);
    expect(c.rpc).toHaveBeenLastCalledWith("complete_finance_cost_document_scan_v1", expect.objectContaining({ p_result: "ERROR", p_computed_sha256: null, p_computed_size_bytes: null }));
  });
  it("keeps a scanner outage retryable rather than acknowledging proof readiness", async () => {
    const c = client(); mocks.scan.mockResolvedValue({ result: "ERROR", engineCode: "MATRICIA_FAIL_CLOSED", engineVersion: "1.0.0", retryable: true });
    c.rpc.mockResolvedValueOnce({ data: [claim], error: null }).mockResolvedValueOnce({ data: { outcome: "FINANCE_COST_DOCUMENT_SCAN_RECORDED", upload_id: id, scan_status: "ERROR" }, error: null });
    expect(await scanOneFinanceCostDocument(c as never, id)).toMatchObject({ ok: false, code: "FINANCE_COST_SCAN_UNAVAILABLE", scanStatus: "ERROR" });
  });
  it("reports a trusted malware refusal as terminal rejection, not CLEAN", async () => {
    const c = client(); mocks.scan.mockResolvedValue({ result: "INFECTED", engineCode: "TEST_SIGNED_SCANNER", engineVersion: "test-only" });
    c.rpc.mockResolvedValueOnce({ data: [claim], error: null }).mockResolvedValueOnce({ data: { outcome: "FINANCE_COST_DOCUMENT_SCAN_RECORDED", upload_id: id, scan_status: "REJECTED" }, error: null });
    expect(await scanOneFinanceCostDocument(c as never, id)).toMatchObject({ ok: true, scanStatus: "REJECTED" });
    expect(c.rpc).toHaveBeenLastCalledWith("complete_finance_cost_document_scan_v1", expect.objectContaining({ p_result: "INFECTED" }));
  });
  it.each(["PENDING", "ERROR"])("does not ACK a targeted event while its unclaimed job is %s", async (scan_status) => {
    const c = client(); c.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: { upload_id: id, status: "UPLOADED", scan_status }, error: null });
    expect((await scanOneFinanceCostDocument(c as never, id)).ok).toBe(false);
    expect(c.download).not.toHaveBeenCalled();
  });
  it.each(["CLEAN", "REJECTED"])("idempotently ACKs the actual terminal native verdict %s", async (scan_status) => {
    const c = client(); c.rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: { upload_id: id, status: "UPLOADED", scan_status }, error: null });
    expect(await scanOneFinanceCostDocument(c as never, id)).toMatchObject({ ok: true, scanStatus: scan_status });
    expect(c.download).not.toHaveBeenCalled();
  });
  it("returns a true empty queue only for an untargeted sweep", async () => {
    const c = client(); c.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await scanOneFinanceCostDocument(c as never)).toEqual({ ok: true, code: "NO_JOB" });
    expect(c.rpc).toHaveBeenCalledOnce();
  });
});
