import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyResendReceipt } from "./resend-receipt";
const now = Date.parse("2026-10-31T12:00:00Z");
const secret = "whsec_" + Buffer.alloc(32, 7).toString("base64");
function envelope() {
  const raw = JSON.stringify({ type: "email.delivered", created_at: new Date(now).toISOString(), data: { email_id: "message-example" } });
  const id = "msg_verified", timestamp = String(now / 1000);
  const signature = createHmac("sha256", Buffer.alloc(32, 7)).update(`${id}.${timestamp}.${raw}`).digest("base64");
  return { raw, headers: new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` }) };
}
describe("Resend receipt authenticity", () => {
  it("verifies an authoritative delivered event without returning recipient data", () => {
    const { raw, headers } = envelope();
    expect(verifyResendReceipt(raw, headers, secret, now)).toMatchObject({ status: "DELIVERED", messageId: "message-example", eventId: "msg_verified" });
  });
  it("rejects modified body, expired timestamps and wrong keys", () => {
    const { raw, headers } = envelope();
    expect(() => verifyResendReceipt(raw + " ", headers, secret, now)).toThrow();
    expect(() => verifyResendReceipt(raw, headers, secret, now + 301000)).toThrow();
    expect(() => verifyResendReceipt(raw, headers, "whsec_" + Buffer.alloc(32, 9).toString("base64"), now)).toThrow();
  });
});
