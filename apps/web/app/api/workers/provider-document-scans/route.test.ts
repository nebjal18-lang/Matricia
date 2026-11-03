import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), download: vi.fn(), scan: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => ({ rpc: mocks.rpc, storage: { from: () => ({ download: mocks.download }) } }) }));
vi.mock("@/modules/shared/lib/document-scanning/scanner", () => ({ scanDocumentBytes: mocks.scan }));
vi.mock("@/modules/shared/lib/operations/heartbeat", () => ({ withOperationalHeartbeat: (_s: string, _e: number, run: () => Promise<Response>) => run() }));
vi.mock("node:crypto", async original => ({ ...await original<typeof import("node:crypto")>(), randomUUID: () => "11111111-1111-4111-8111-111111111111" }));
import { GET, POST } from "./route";
const token = "s".repeat(32), bytes = Buffer.from("%PDF-1.7 document"), hash = createHash("sha256").update(bytes).digest("hex");
const claim = { proof_id: "22222222-2222-4222-8222-222222222222", lease_token: "33333333-3333-4333-8333-333333333333", worker_id: "11111111-1111-4111-8111-111111111111", row_version: 2, attempt_count: 1, storage_bucket: "provider-qualification", storage_path: "owner/doc/pdf", expected_sha256: hash, media_type: "application/pdf" };
const request = (secret = token) => new Request("http://localhost/api/workers/provider-document-scans", { method: "POST", headers: { authorization: `Bearer ${secret}` } });
beforeEach(() => { vi.clearAllMocks(); process.env.CRON_SECRET = token; mocks.download.mockResolvedValue({ data: new Blob([bytes]), error: null }); mocks.scan.mockResolvedValue({ result: "CLEAN", engineCode: "ACME_AV", engineVersion: "1.2" }); });
it("exposes GET cron with identical authorization", async () => { expect(GET).toBe(POST); expect((await GET(request("bad"))).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled(); });
it("records only a trusted scan of the exact claimed hash", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: [claim], error: null }).mockResolvedValueOnce({ data: { outcome: "PROVIDER_DOCUMENT_SCAN_RECORDED" }, error: null });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.rpc).toHaveBeenNthCalledWith(2, "complete_provider_document_scan_job", expect.objectContaining({ p_proof_id: claim.proof_id, p_result: "CLEAN", p_computed_sha256: hash, p_expected_row_version: 2 }));
});
it("never scans or approves a different stored object", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: [{ ...claim, expected_sha256: "a".repeat(64) }], error: null }).mockResolvedValueOnce({ data: { outcome: "PROVIDER_DOCUMENT_SCAN_RECORDED" }, error: null });
  expect((await POST(request())).status).toBe(200); expect(mocks.scan).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenNthCalledWith(2, "complete_provider_document_scan_job", expect.objectContaining({ p_result: "ERROR" }));
});
it("retries scanner outages without accepting the document", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: [claim], error: null }).mockResolvedValueOnce({ data: { outcome: "PROVIDER_DOCUMENT_SCAN_RETRY_SCHEDULED" }, error: null });
  mocks.scan.mockResolvedValue({ result: "ERROR", retryable: true, retryCode: "SCANNER_UNAVAILABLE" });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.rpc).toHaveBeenNthCalledWith(2, "fail_provider_document_scan_job", expect.objectContaining({ p_failure_code: "SCANNER_UNAVAILABLE" }));
});
it("fails closed before Storage for an unbound claim", async () => {
  mocks.rpc.mockResolvedValue({ data: [{ ...claim, worker_id: "44444444-4444-4444-8444-444444444444" }], error: null });
  expect((await POST(request())).status).toBe(503); expect(mocks.download).not.toHaveBeenCalled();
});
