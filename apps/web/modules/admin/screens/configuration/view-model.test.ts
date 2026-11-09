import { describe, expect, it } from "vitest";
import { activeRevision, configurationProgress, editableRevision, mayReview, probeFresh, visibleFieldValue, type ConfigurationDashboardView, type ConfigurationRevision, type ConfigurationSection } from "./view-model";
import { actionMessage } from "./copy";
const author = "11111111-1111-4111-8111-111111111111", reviewer = "22222222-2222-4222-8222-222222222222";
const revision: ConfigurationRevision = { id: author, section: "RESEND", environment: "STAGING", settings: {}, secret_keys: ["RESEND_API_KEY"], content_hash: "a".repeat(64), status: "DRAFT", created_by: author, created_at: "2026-11-09T12:00:00Z", approved_by: null, approved_at: null, probe: { status: "PASS", code: "CONNECTED", checked_at: "2026-11-09T12:01:00Z", valid_until: "2026-11-09T12:31:00Z" } };
const section = { section: "RESEND" as const, active_revision_id: null, latest_revision_id: author, revisions: [revision] };
const data: ConfigurationDashboardView = { environment: "STAGING", actor_id: reviewer, can_write: true, sections: [section] };
describe("configuration progress and independent review", () => {
  it("does not turn a saved or tested draft into an active configuration", () => {
    expect(configurationProgress(data)).toEqual({ active: 0, total: 5, percent: 0 });
    expect(activeRevision(section)).toBeNull();
    expect(editableRevision(section)).toEqual(revision);
  });
  it("requires both the active pointer and ACTIVE status", () => {
    const active = { ...revision, status: "ACTIVE" as const };
    expect(configurationProgress({ ...data, sections: [{ ...section, revisions: [active] }] }).active).toBe(0);
    expect(configurationProgress({ ...data, sections: [{ ...section, active_revision_id: author }] }).active).toBe(0);
    expect(configurationProgress({ ...data, sections: [{ ...section, active_revision_id: author, revisions: [active] }] }).active).toBe(1);
  });
  it("counts each configuration only once and keeps the total at five", () => {
    const sections: ConfigurationSection[] = ["COMPANY", "RESEND", "PAYPAL", "YOUSIGN", "SCANNER"];
    const activeSections = sections.map(key => ({ ...section, section: key, active_revision_id: author, revisions: [{ ...revision, section: key, status: "ACTIVE" as const }] }));
    expect(configurationProgress({ ...data, sections: [...activeSections, activeSections[0]!] })).toEqual({ active: 5, total: 5, percent: 100 });
  });
  it("forbids self review, read-only review and review of an already active revision", () => {
    expect(mayReview(revision, data)).toBe(true);
    expect(mayReview(revision, { ...data, actor_id: author })).toBe(false);
    expect(mayReview(revision, { ...data, can_write: false })).toBe(false);
    expect(mayReview({ ...revision, status: "ACTIVE" }, data)).toBe(false);
  });
  it("does not reuse a failed, missing, expired or invalid-dated connection probe", () => {
    const now = Date.parse("2026-11-09T12:15:00Z");
    expect(probeFresh(revision, now)).toBe(true);
    expect(probeFresh(revision, Date.parse("2026-11-09T12:31:00Z"))).toBe(false);
    expect(probeFresh({ ...revision, probe: null }, now)).toBe(false);
    expect(probeFresh({ ...revision, probe: { ...revision.probe!, status: "FAIL" } }, now)).toBe(false);
    expect(probeFresh({ ...revision, probe: { ...revision.probe!, valid_until: "bad date" } }, now)).toBe(false);
  });
  it("never uses any private value as the default of a secret field", () => {
    expect(visibleFieldValue({ RESEND_API_KEY: "MUST-NEVER-BE-RENDERED" }, { key: "RESEND_API_KEY", secret: true }, { RESEND_API_KEY: "ALSO-PRIVATE" })).toBe("");
    expect(visibleFieldValue({ displayName: "Client" }, { key: "displayName", secret: false })).toBe("Client");
  });
  it("maps errors to safe translated copy without displaying the supplied error", () => {
    const unsafe = "PROVIDER_ERROR_private_value_forbidden";
    expect(actionMessage("error", unsafe, "test", "fr")).not.toContain(unsafe);
    expect(actionMessage("error", "ENCRYPTION_NOT_CONFIGURED", "save", "fr")).toContain("coffre");
    expect(actionMessage("error", "STALE_CONFIGURATION", "save", "ar")).toContain("تغير");
  });
});
