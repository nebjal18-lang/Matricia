import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ runtime: vi.fn(), webhook: vi.fn() }));
vi.mock("@/modules/shared/lib/signature-runtime/yousign", () => ({ createYousignRuntime: mock.runtime }));
import { POST } from "./route";
const raw = '{ "event_id": "not-parsed-before-hmac", "data": {"x":1} }';
function request(body = raw, signature?: string) { return new Request("https://staging.example/api/webhooks/yousign", { method: "POST", body, headers: signature ? { "X-Yousign-Signature-256": signature } : {} }); }
describe("YouSign webhook HTTP boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); mock.runtime.mockReturnValue({ webhook: mock.webhook }); mock.webhook.mockResolvedValue({ replayed: false }); });
  it("rejects unsigned input without resolving credentials or touching a repository", async () => {
    expect((await POST(request())).status).toBe(401); expect(mock.runtime).not.toHaveBeenCalled();
  });
  it("bounds unknown-length bodies before provider verification", async () => {
    expect((await POST(request("x".repeat(128 * 1024 + 1), `sha256=${"a".repeat(64)}`))).status).toBe(413);
    expect(mock.runtime).not.toHaveBeenCalled();
  });
  it("preserves raw bytes and delegates cryptographic verification, acknowledging only the durable receipt", async () => {
    const signature = `sha256=${"b".repeat(64)}`;
    const response = await POST(request(raw, signature));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mock.webhook).toHaveBeenCalledWith(new TextEncoder().encode(raw), { "x-yousign-signature-256": signature }, expect.any(Date));
    expect(await response.json()).toEqual({ outcome: "YOUSIGN_EVENT_RECORDED", replayed: false });
  });
  it("retains retries when repository or evidence processing fails", async () => {
    mock.webhook.mockRejectedValue(new Error("YOUSIGN_REPOSITORY_UNAVAILABLE"));
    const response = await POST(request(raw, `sha256=${"c".repeat(64)}`));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ code: "YOUSIGN_WEBHOOK_RECONCILIATION_REQUIRED" });
  });
  it("reports cryptographic rejection without exposing secret-bearing provider errors", async () => {
    mock.webhook.mockRejectedValue(new Error("YOUSIGN_WEBHOOK_SIGNATURE_INVALID"));
    const response = await POST(request(raw, `sha256=${"c".repeat(64)}`));
    expect(response.status).toBe(401); expect(await response.json()).toEqual({ code: "YOUSIGN_WEBHOOK_INVALID" });
  });
});
