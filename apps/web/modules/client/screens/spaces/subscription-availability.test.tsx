import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SubscriptionDashboard } from "@/modules/shared/lib/subscriptions/model";
import { SubscriptionBoard } from "./subscription-board";

const dashboard: SubscriptionDashboard = { organizationId: "test", organizationName: "Test", plans: [], subscription: null, capabilities: { canStartTrial: false, canChangePlan: false } };
describe("subscription partial availability", () => {
  it.each(["fr", "ar"] as const)("does not present failed Box or team loading as an empty result (%s)", (locale) => {
    const html = renderToStaticMarkup(<SubscriptionBoard locale={locale} query="?organizationId=test" dashboard={dashboard} credits={{ available: false, balance: "—", unitCode: "—", memberCount: null, boxes: [], operations: [] }} />);
    expect(html).toContain(locale === "fr" ? "Non disponible" : "غير متاح");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain(locale === "fr" ? "Aucune Box visible" : "لا صندوق ظاهر");
  });
});
