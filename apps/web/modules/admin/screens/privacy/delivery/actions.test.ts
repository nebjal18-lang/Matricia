import {beforeEach, describe, expect, it, vi} from "vitest";
const mocks = vi.hoisted(() => ({rpc: vi.fn(), getUser: vi.fn()}));
vi.mock("next/cache", () => ({revalidatePath: vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({getSupabaseServerClient: async () => ({auth: {getUser: mocks.getUser}, rpc: mocks.rpc})}));
import {manageDsrDelivery} from "./actions";
const id = "11111111-1111-4111-8111-111111111111";
function form(values: Record<string, string>) {const data = new FormData(); for (const [key, value] of Object.entries({locale: "fr", idempotencyKey: id, ...values})) data.set(key, value); return data;}
beforeEach(() => {mocks.rpc.mockReset(); mocks.getUser.mockResolvedValue({data: {user: {id}}});});
describe("private DSR delivery", () => {
  it("requires explicit subject scope confirmation", async () => {
    const data = form({intent: "scope", requestId: id}); data.append("scopes", "ACCOUNT");
    expect(await manageDsrDelivery({status: "idle"}, data)).toEqual({status: "error", reason: "VALIDATION"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not silently combine ALL with a narrower scope", async () => {
    const data = form({intent: "scope", requestId: id, scopeConfirmed: "on"}); data.append("scopes", "ALL"); data.append("scopes", "ACCOUNT");
    expect(await manageDsrDelivery({status: "idle"}, data)).toEqual({status: "error", reason: "VALIDATION"});
  });
  it("requires actual receipt confirmation before calling the acknowledgement RPC", async () => {
    expect(await manageDsrDelivery({status: "idle"}, form({intent: "ack", responseId: id, scopeVersionId: id, sha256: "a".repeat(64)}))).toEqual({status: "error", reason: "VALIDATION"});
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("keeps an incomplete or undelivered scope in review", async () => {
    mocks.rpc.mockResolvedValue({data: null, error: {code: "55000"}});
    expect(await manageDsrDelivery({status: "idle"}, form({intent: "fulfil", requestId: id, responseId: id, rowVersion: "1", completionConfirmed: "on"}))).toEqual({status: "error", reason: "REVIEW_REQUIRED"});
  });
});
