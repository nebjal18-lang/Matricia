import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getRoleMessages } from "./messages";
import { RoleRequestForm } from "./role-request-form";
vi.mock("./actions", () => ({ requestAdditionalRole: vi.fn() }));
describe("role request organizations", () => {
  const messages = getRoleMessages("fr");
  it("renders an empty state when no organization is available", () => {
    const html = renderToStaticMarkup(<RoleRequestForm locale="fr" organizations={[]} idempotencyKey="key" messages={messages} />);
    expect(html).toContain(messages.noOrganization);
    expect(html).not.toContain("<form");
  });
  it("offers roles not already held for an available organization", () => {
    const html = renderToStaticMarkup(<RoleRequestForm locale="fr" organizations={[{ id: "org", displayName: "Example", currentRoles: ["CLIENT_OWNER"] }]} idempotencyKey="key" messages={messages} />);
    expect(html).toContain("Example");
    expect(html).toContain("CLIENT_ADMIN");
    expect(html).not.toContain('value="CLIENT_OWNER"');
  });
});
