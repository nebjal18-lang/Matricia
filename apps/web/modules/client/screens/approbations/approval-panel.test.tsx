import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClientApprovalsPanel } from "./approval-panel";
import { getApprovalMessages } from "./messages";

describe("ClientApprovalsPanel", () => {
  it("shows an empty state without inventing a pending approval", () => {
    const html = renderToStaticMarkup(<ClientApprovalsPanel locale="fr" items={[]} messages={getApprovalMessages("fr")} />);
    expect(html).toContain("Aucune demande d’approbation");
    expect(html).not.toContain("name=\"decision\"");
  });

  it("exposes a human decision on pending requests", () => {
    const html = renderToStaticMarkup(
      <ClientApprovalsPanel
        locale="fr"
        items={[{
          id: "11111111-1111-4111-8111-111111111111",
          status: "PENDING",
          rowVersion: 1,
          resourceType: "QUOTE",
          resourceId: "22222222-2222-4222-8222-222222222222",
          amountMinor: "10000",
          currency: "MAD",
          requestedAt: "2026-09-21T10:00:00.000Z",
        }]}
        messages={getApprovalMessages("fr")}
      />,
    );
    expect(html).toContain("Dossier métier");
    expect(html).not.toContain("22222222-2222-4222-8222-222222222222");
    expect(html).toContain("name=\"decision\"");
    expect(html).toContain("AAL2");
  });

  it.each(["fr", "ar"] as const)("distinguishes an incident from no requests in %s", (locale) => {
    const messages = getApprovalMessages(locale);
    const html = renderToStaticMarkup(<ClientApprovalsPanel locale={locale} result={{ status: "unavailable" }} organizationId="11111111-1111-4111-8111-111111111111" messages={messages} />);
    expect(html).toContain(messages.unavailable);
    expect(html).not.toContain(messages.empty);
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("organizationId=11111111-1111-4111-8111-111111111111");
  });

  it("keeps tenant context in both history directions", () => {
    const html = renderToStaticMarkup(<ClientApprovalsPanel locale="ar" result={{ status: "success", items: [], page: 3, hasNext: true }} organizationId="11111111-1111-4111-8111-111111111111" messages={getApprovalMessages("ar")} />);
    expect(html).toContain("approvalPage=2");
    expect(html).toContain("approvalPage=4");
    expect(html.match(/organizationId=/g)).toHaveLength(2);
  });
});
