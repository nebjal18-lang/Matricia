import { describe, expect, it } from "vitest";
import { totp } from "./totp";

const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  it.each([
    [59_000, "287082"],
    [1_111_111_109_000, "081804"],
    [1_234_567_890_000, "005924"],
    [2_000_000_000_000, "279037"],
  ])("matches the RFC 6238 SHA1 vector at %s", (timestamp, code) => {
    expect(totp(secret, timestamp)).toBe(code);
  });
});
