import { createHash, createHmac } from "node:crypto";

const purpose = "matricia.franchise.network.invitation.v1";

/** Stable across a lost response; never derives a membership or economic right. */
export function networkInvitationId(batchKey: string, email: string): string {
  const bytes = createHash("sha256").update(`${purpose}:${batchKey}:${email.trim().toLowerCase()}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function networkInvitationToken(invitationId: string, key = process.env.APP_ENCRYPTION_KEY): string {
  if (!key || Buffer.byteLength(key, "utf8") < 32) throw new Error("NETWORK_INVITATION_KEY_UNCONFIGURED");
  return createHmac("sha256", key).update(`${purpose}:${invitationId}`).digest("base64url");
}

export function networkInvitationTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
