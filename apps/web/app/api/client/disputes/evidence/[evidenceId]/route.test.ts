import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), admin: vi.fn(), from: vi.fn(), download: vi.fn() }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({ getSupabaseServerClient: async () => ({ auth: { getUser: mocks.user }, rpc: mocks.rpc }) }));
vi.mock("@/modules/shared/lib/supabase/admin", () => ({ getSupabaseAdminClient: mocks.admin }));
import { GET } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const bytes = Buffer.from("%PDF-private-dispute-test");
const grant = (bucket = "provider-qualification") => ({ evidence_id: id, bucket, object_path: `${id}/${id}/source.pdf`, file_name: "preuve.pdf", mime_type: "application/pdf", size_bytes: String(bytes.length), sha256: createHash("sha256").update(bytes).digest("hex") });
const request = () => GET(new Request(`https://matricia.test.invalid/api/client/disputes/evidence/${id}`), { params: Promise.resolve({ evidenceId: id }) });
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ data: { user: { id } } }); mocks.rpc.mockResolvedValue({ data: grant(), error: null }); mocks.admin.mockReturnValue({ storage: { from: mocks.from } }); mocks.from.mockReturnValue({ download: mocks.download }); mocks.download.mockResolvedValue({ data: new Blob([bytes]), error: null }); });
describe("canonical dispute evidence download", () => {
  it("requires authentication before authority or private storage", async () => { mocks.user.mockResolvedValue({ data: { user: null } }); expect((await request()).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.admin).not.toHaveBeenCalled(); });
  it("does not escalate on a visibility, tenant or MFA refusal", async () => { mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } }); expect((await request()).status).toBe(403); expect(mocks.admin).not.toHaveBeenCalled(); });
  it.each(["client-compliance", "provider-qualification", "delivery-proofs"])("serves only authorized exact bytes in %s", async bucket => { mocks.rpc.mockResolvedValue({ data: grant(bucket), error: null }); const r = await request(); expect(r.status).toBe(200); expect(Buffer.from(await r.arrayBuffer())).toEqual(bytes); expect(r.headers.get("cache-control")).toContain("no-store"); expect(mocks.from).toHaveBeenCalledWith(bucket); });
  it("rejects mismatched IDs and public or unrelated buckets before storage", async () => { for (const data of [{ ...grant(), evidence_id: "22222222-2222-4222-8222-222222222222" }, grant("public-assets")]) { mocks.rpc.mockResolvedValue({ data, error: null }); expect((await request()).status).toBe(403); } expect(mocks.admin).not.toHaveBeenCalled(); });
  it("checks the actual downloaded bytes even when scan metadata was clean", async () => { mocks.download.mockResolvedValue({ data: new Blob([Buffer.alloc(bytes.length)]), error: null }); expect((await request()).status).toBe(503); });
});
