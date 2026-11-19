import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/modules/shared/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  }),
}));

import { reviewClientIdentity } from "@/modules/admin/screens/client-identity/actions";

const id = "11111111-1111-4111-8111-111111111111";
const hash = "a".repeat(64);
const docs = [
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];

function form() {
  const data = new FormData();
  Object.entries({
    caseId: id,
    caseVersion: "2",
    profileVersion: "1",
    identityHash: hash,
    documents: JSON.stringify(docs),
    reason: "Contrôle humain des trois pièces du dossier courant",
    idempotencyKey: id,
    confirmed: "yes",
    locale: "fr",
  }).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id } } });
  mocks.revalidatePath.mockReset();
  mocks.rpc.mockReset().mockResolvedValue({
    data: {
      outcome: "CLIENT_CANONICAL_IDENTIFIERS_VERIFIED",
      identity_hash: hash,
      proof_hash: "b".repeat(64),
    },
    error: null,
  });
});

describe("reviewClientIdentity", () => {
  it("requires an explicit human confirmation", async () => {
    const data = form();
    data.delete("confirmed");
    expect(await reviewClientIdentity({ status: "idle" }, data)).toEqual({
      status: "error",
      reason: "VALIDATION",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("binds the review to the displayed identity and versions", async () => {
    expect(await reviewClientIdentity({ status: "idle" }, form())).toEqual({
      status: "success",
      proofHash: "b".repeat(64),
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "review_client_canonical_identifiers_v1",
      expect.objectContaining({
        p_compliance_case_id: id,
        p_expected_case_row_version: 2,
        p_expected_profile_version: 1,
        p_expected_identity_hash: hash,
        p_document_ids: docs,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/fr/administration/conformite-clients/${id}/identite`,
    );
  });

  it("maps stale and document failures without claiming verification", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "40001" } });
    expect(await reviewClientIdentity({ status: "idle" }, form())).toEqual({
      status: "error",
      reason: "STALE",
    });

    mocks.rpc.mockResolvedValueOnce({ error: { code: "55000" } });
    expect(await reviewClientIdentity({ status: "idle" }, form())).toEqual({
      status: "error",
      reason: "DOCUMENTS_REQUIRED",
    });
  });
});
