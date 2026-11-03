import {createHash} from "node:crypto";
import {beforeEach, describe, expect, it, vi} from "vitest";
const mocks = vi.hoisted(() => ({rpc: vi.fn(), getUser: vi.fn()}));
vi.mock("@/modules/shared/lib/supabase/server", () => ({getSupabaseServerClient: async () => ({auth: {getUser: mocks.getUser}, rpc: mocks.rpc})}));
import {GET} from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const context = {params: Promise.resolve({responseId: id})};
beforeEach(() => {mocks.rpc.mockReset(); mocks.getUser.mockResolvedValue({data: {user: {id}}});});
describe("private DSR artifact", () => {
  it("does not disclose a response when the authoritative RPC denies access", async () => {
    mocks.rpc.mockResolvedValue({data: null, error: {code: "42501"}});
    const response = await GET(new Request("http://local.test"), context);
    expect(response.status).toBe(403); expect(await response.text()).not.toContain("response_json");
  });
  it("refuses mismatched artifact bytes", async () => {
    mocks.rpc.mockResolvedValue({data: {response_id: id, response_json: '{"account":"test"}', sha256: "0".repeat(64)}, error: null});
    expect((await GET(new Request("http://local.test"), context)).status).toBe(503);
  });
  it("delivers exact verified UTF-8 bytes privately", async () => {
    const body = '{"account":"تجربة privée"}', sha256 = createHash("sha256").update(body).digest("hex");
    mocks.rpc.mockResolvedValue({data: {response_id: id, response_json: body, sha256}, error: null});
    const response = await GET(new Request("http://local.test"), context);
    expect(response.status).toBe(200); expect(await response.text()).toBe(body);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
    expect(response.headers.get("x-matricia-export-sha256")).toBe(sha256);
  });
});
