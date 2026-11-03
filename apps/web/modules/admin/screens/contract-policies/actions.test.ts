import {beforeEach, describe, expect, it, vi} from "vitest";
const mocks = vi.hoisted(() => ({rpc: vi.fn(), getUser: vi.fn()}));
vi.mock("next/cache", () => ({revalidatePath: vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({getSupabaseServerClient: async () => ({auth: {getUser: mocks.getUser}, rpc: mocks.rpc})}));
import {manageContractPolicy} from "./actions";
const id = "11111111-1111-4111-8111-111111111111";
const form = (values: Record<string, string>) => {const data = new FormData(); for (const [key, value] of Object.entries({locale: "fr", idempotencyKey: id, ...values})) data.set(key, value); return data;};
beforeEach(() => {mocks.rpc.mockReset(); mocks.getUser.mockResolvedValue({data: {user: {id}}});});
describe("approved contract policies", () => {
  it("requires explicit review before approval", async () => {
    expect(await manageContractPolicy({status: "idle"}, form({intent: "approve", policyId: id, reason: "Independent actual review"}))).toEqual({status: "error", reason: "VALIDATION"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("permits a reasoned refusal without a false approval attestation", async () => {
    mocks.rpc.mockResolvedValue({data: {outcome: "CONTRACT_POLICY_VERSION_DECIDED", policy_version_id: id}, error: null});
    expect(await manageContractPolicy({status: "idle"}, form({intent: "reject", policyId: id, reason: "Incomplete legal review"}))).toEqual({status: "success"});
    expect(mocks.rpc).toHaveBeenCalledWith("decide_contract_policy_version_v1", expect.objectContaining({p_approve: false}));
  });
  it("preserves overlap refusal", async () => {
    mocks.rpc.mockResolvedValue({data: null, error: {code: "55000", message: "COMMISSION_POLICY_EFFECTIVE_WINDOW_OVERLAP"}});
    expect(await manageContractPolicy({status: "idle"}, form({intent: "approve", policyId: id, reason: "Independent actual review", reviewConfirmed: "on"}))).toEqual({status: "error", reason: "OVERLAP"});
  });
  it("does not accept an arbitrary successful response as a decision", async () => {
    mocks.rpc.mockResolvedValue({data: {outcome: "REQUEST_TRACKED", policy_version_id: id}, error: null});
    expect(await manageContractPolicy({status: "idle"}, form({intent: "reject", policyId: id, reason: "Incomplete legal review"}))).toEqual({status: "error", reason: "FAILED"});
  });
});
