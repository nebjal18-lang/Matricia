import { describe, expect, it } from "vitest";
import { networkInvitationId, networkInvitationToken, networkInvitationTokenHash } from "./invitation-token";

describe("network invitation credentials", () => {
  const key = "local-test-key-with-at-least-32-bytes";
  it("normalizes recipient email and keeps a stable valid UUID after a response loss", () => {
    const id = networkInvitationId("batch-one", " User@example.invalid ");
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(networkInvitationId("batch-one", "user@example.invalid")).toBe(id);
    expect(networkInvitationId("batch-two", "user@example.invalid")).not.toBe(id);
  });
  it("derives a bounded secret token from purpose, invitation and deployment key", () => {
    const id = networkInvitationId("batch-one", "user@example.invalid");
    const token = networkInvitationToken(id, key);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(networkInvitationToken(id, key)).toBe(token);
    expect(networkInvitationToken(id, key + "other")).not.toBe(token);
    expect(networkInvitationToken(id + "other", key)).not.toBe(token);
    expect(networkInvitationTokenHash(token)).toMatch(/^[0-9a-f]{64}$/u);
    expect(networkInvitationTokenHash(token)).not.toContain(token);
  });
  it("refuses missing or weak deployment configuration", () => {
    expect(() => networkInvitationToken("id", "")).toThrow("UNCONFIGURED");
    expect(() => networkInvitationToken("id", "short")).toThrow("UNCONFIGURED");
  });
});
