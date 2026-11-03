import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
const payloadSchema = z.object({ type: z.enum(["email.delivered", "email.bounced", "email.complained"]), created_at: z.string().datetime({ offset: true }), data: z.object({ email_id: z.string().min(3).max(200) }) });
export function verifyResendReceipt(raw: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get("svix-id") ?? "", timestamp = headers.get("svix-timestamp") ?? "";
  const seconds = Number(timestamp);
  if (!/^[A-Za-z0-9_-]{3,200}$/u.test(id) || !/^\d{10,12}$/u.test(timestamp) || !Number.isSafeInteger(seconds) || Math.abs(now / 1000 - seconds) > 300 || !secret.startsWith("whsec_")) throw new Error("EMAIL_RECEIPT_SIGNATURE_INVALID");
  const key = Buffer.from(secret.slice(6), "base64");
  if (key.length < 24) throw new Error("EMAIL_RECEIPT_SIGNATURE_INVALID");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest();
  const valid = (headers.get("svix-signature") ?? "").split(" ").some(entry => { const [version, encoded] = entry.split(","); if (version !== "v1" || !encoded) return false; const supplied = Buffer.from(encoded, "base64"); return supplied.length === expected.length && timingSafeEqual(supplied, expected); });
  if (!valid) throw new Error("EMAIL_RECEIPT_SIGNATURE_INVALID");
  const result = payloadSchema.parse(JSON.parse(raw));
  return { eventId: id, messageId: result.data.email_id, status: result.type === "email.delivered" ? "DELIVERED" : result.type === "email.bounced" ? "BOUNCED" : "COMPLAINED", occurredAt: result.created_at, hash: createHash("sha256").update(raw).digest("hex") };
}
