import {beforeEach, describe, expect, it, vi} from "vitest";
const mocks = vi.hoisted(() => ({rpc: vi.fn(), getUser: vi.fn()}));
vi.mock("next/cache", () => ({revalidatePath: vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({getSupabaseServerClient: async () => ({auth: {getUser: mocks.getUser}, rpc: mocks.rpc})}));
import {manageEditorialReview} from "./actions";
const id = "11111111-1111-4111-8111-111111111111";
const form = (values: Record<string, string>) => {const data = new FormData();for (const [key, value] of Object.entries({locale: "fr", idempotencyKey: id, rowVersion: "2", ...values})) data.set(key, value);return data;};
beforeEach(() => {mocks.rpc.mockReset();mocks.getUser.mockResolvedValue({data: {user: {id}}});});
describe("central editorial review", () => {
  it("requires explicit full-content FR/AR review before approval", async () => {
    expect(await manageEditorialReview({status: "idle"}, form({intent: "APPROVE", requestId: id, reason: "Reviewed exact bilingual source"}))).toEqual({status: "error", reason: "VALIDATION"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("allows reasoned rejection without a false translation attestation", async () => {
    mocks.rpc.mockResolvedValue({data: {outcome: "CATALOG_CHANGE_REJECTED", reviewProofHash: "a".repeat(64)}, error: null});
    expect(await manageEditorialReview({status: "idle"}, form({intent: "REJECT", requestId: id, reason: "Missing accurate Arabic translation"}))).toMatchObject({status: "success"});
    expect(mocks.rpc).toHaveBeenCalledWith("decide_catalog_editorial_review", expect.objectContaining({p_translation_confirmed: false, p_decision: "REJECT", p_expected_row_version: 2}));
  });
  it("schedules the reviewed server audience with explicit UTC dates", async () => {
    mocks.rpc.mockResolvedValue({data: {outcome: "CATALOG_RELEASE_SCHEDULED"}, error: null});
    expect(await manageEditorialReview({status: "idle"}, form({intent: "schedule", releaseId: id, snapshotHash: "a".repeat(64), effectiveFrom: "2026-11-02T09:30", effectiveUntil: "", scheduleConfirmed: "on"}))).toMatchObject({status: "success", reason: "CATALOG_RELEASE_SCHEDULED"});
    expect(mocks.rpc).toHaveBeenCalledWith("schedule_reviewed_catalog_release", {p_release_id: id, p_expected_row_version: 2, p_expected_snapshot_hash: "a".repeat(64), p_effective_from: "2026-11-02T09:30:00.000Z", p_effective_until: null, p_idempotency_key: id});
    expect(mocks.rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_audience");
  });
  it("does not rename scheduling as publication", async () => {
    mocks.rpc.mockResolvedValue({data: {outcome: "CATALOG_RELEASE_PUBLISHED"}, error: null});
    expect(await manageEditorialReview({status: "idle"}, form({intent: "schedule", releaseId: id, snapshotHash: "a".repeat(64), effectiveFrom: "2026-11-02T09:30", effectiveUntil: "", scheduleConfirmed: "on"}))).toEqual({status: "error", reason: "FAILED"});
  });
});
