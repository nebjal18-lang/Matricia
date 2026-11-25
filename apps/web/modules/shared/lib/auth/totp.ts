import { createHmac } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function decodeBase32(value: string): Buffer {
  const normalized = value.toUpperCase().replace(/=+$/u, "").replace(/\s+/gu, "");
  if (!normalized || [...normalized].some((character) => !BASE32.includes(character))) {
    throw new Error("Invalid TOTP secret encoding");
  }
  let bits = "";
  for (const character of normalized) bits += BASE32.indexOf(character).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 TOTP, HMAC-SHA1, used only to complete a factor the server just enrolled. */
export function totp(secret: string, timestamp = Date.now(), digits = 6, periodSeconds = 30): string {
  if (!Number.isInteger(timestamp) || timestamp < 0 || !Number.isInteger(digits) || digits < 6 || digits > 8) {
    throw new Error("Invalid TOTP parameters");
  }
  const counter = Math.floor(timestamp / 1000 / periodSeconds);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = ((digest[offset]! & 0x7f) << 24)
    | ((digest[offset + 1]! & 0xff) << 16)
    | ((digest[offset + 2]! & 0xff) << 8)
    | (digest[offset + 3]! & 0xff);
  return String(binary % (10 ** digits)).padStart(digits, "0");
}
