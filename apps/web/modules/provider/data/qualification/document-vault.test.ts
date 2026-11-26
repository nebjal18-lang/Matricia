import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({ from: mocks.from, rpc: mocks.rpc }),
  getServerAuthUser: mocks.auth,
}));

import { loadProviderDocumentVault } from "./document-vault";

const org = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const docId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === "organization_memberships") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({
                in: () => ({
                  limit: async () => ({
                    data: [{
                      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                      organization_id: org,
                      organizations: { display_name: "Prestataire · Assurance" },
                      organization_member_roles: [{ role_code: "PROVIDER_OWNER", revoked_at: null }],
                    }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "provider_document_scan_jobs") {
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({ data: [{ storage_object_path: "vault/doc.pdf", scan_status: "CLEAN" }], error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  mocks.rpc.mockResolvedValue({
    data: {
      items: [{
        id: docId,
        version_number: 1,
        status: "VERIFIED",
        expires_on: "2027-01-01",
        storage_object_path: "vault/doc.pdf",
        provider_document_families: { document_kind: "INSURANCE", code: "RC_2026" },
      }],
      required_documents_complete: true,
    },
    error: null,
  });
});

describe("loadProviderDocumentVault", () => {
  it("loads the vault without depending on catalogue or eligibility", async () => {
    const result = await loadProviderDocumentVault(org);
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected vault");
    expect(result.documents).toEqual([{
      id: docId,
      kind: "INSURANCE",
      code: "RC_2026",
      version: 1,
      status: "VERIFIED",
      scanStatus: "CLEAN",
      expiresOn: "2027-01-01",
    }]);
    expect(mocks.rpc).toHaveBeenCalledWith("list_provider_entry_documents_v1", expect.objectContaining({ p_provider_organization_id: org }));
  });

  it("distinguishes an empty vault from a documents query failure", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { items: [], required_documents_complete: false }, error: null });
    const empty = await loadProviderDocumentVault(org);
    expect(empty.status).toBe("success");
    if (empty.status === "success") expect(empty.documents).toEqual([]);

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "denied" } });
    const failed = await loadProviderDocumentVault(org);
    expect(failed).toEqual({ status: "error", reason: "DOCUMENTS_QUERY_FAILED" });
  });
});
