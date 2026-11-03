import { describe, expect, it } from "vitest";
import { getClientOnboardingMessages } from "../onboarding/messages";
import { portfolioCalendarTitle } from "./calendar-title";

describe("generated calendar document labels", () => {
  it.each(["fr", "ar"] as const)("uses the existing approved document labels in %s", (locale) => {
    for (const [code, label] of Object.entries(getClientOnboardingMessages(locale).evidenceTypes)) {
      const title = portfolioCalendarTitle({ sourceKind: "DOCUMENT_EXPIRY", titleFr: `Expiration document ${code}`, titleAr: `انتهاء صلاحية المستند ${code}` }, locale);
      expect(title).toContain(label);
      expect(title).not.toContain(code);
    }
  });
  it("leaves manually entered event text unchanged even when it contains a document code", () => {
    const item = { sourceKind: "CLIENT_EVENT", titleFr: "Réviser REGISTRATION_DOCUMENT", titleAr: "مراجعة REGISTRATION_DOCUMENT" };
    expect(portfolioCalendarTitle(item, "fr")).toBe(item.titleFr);
    expect(portfolioCalendarTitle(item, "ar")).toBe(item.titleAr);
  });
  it("does not expose an unknown generated code as an approved document name", () => {
    expect(portfolioCalendarTitle({ sourceKind: "DOCUMENT_EXPIRY", titleFr: "Expiration document UNKNOWN_INTERNAL_TYPE", titleAr: "UNKNOWN_INTERNAL_TYPE" }, "ar")).not.toContain("UNKNOWN_INTERNAL_TYPE");
  });
});
