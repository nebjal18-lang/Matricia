import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({ opened: { status: "idle" } as unknown, accepted: { status: "idle" } as unknown }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useActionState: (action: { name: string }) => [action.name.startsWith("open") ? state.opened : state.accepted, () => {}, false] }));
import { NetworkRecipientForm } from "./recipient-form";
const id = "11111111-1111-4111-8111-111111111111", org = "22222222-2222-4222-8222-222222222222", token = "a".repeat(43);
beforeEach(() => { state.opened = { status: "idle" }; state.accepted = { status: "idle" }; });
describe("network recipient interface", () => {
  it.each(["fr", "ar"] as const)("returns an accepted organization to its existing %s dashboard with an explicit workspace", locale => {
    for (const prospectType of ["CLIENT", "PROVIDER"] as const) {
      state.accepted = { status: "success", organizationId: org, prospectType };
      const html = renderToStaticMarkup(<NetworkRecipientForm locale={locale} invitationId={id} token={token} idempotencyKey={id} />);
      expect(html).toContain(`/${locale}/tableau-de-bord?organizationId=${org}&amp;workspace=${prospectType === "CLIENT" ? "client" : "provider"}`);
      expect(html).not.toContain("/client/accueil");
    }
  });
  it("shows the authorized organization name as entered in the Arabic interface", () => {
    state.opened = { status: "opened", invitation: { prospect_type: "CLIENT", delivery_mode: "NON_CONTRACTUAL_DEMO", organizations: [{ id: org, name: "Société TEST en français" }] } };
    const html = renderToStaticMarkup(<NetworkRecipientForm locale="ar" invitationId={id} token={token} idempotencyKey={id} />);
    expect(html).toContain("Société TEST en français"); expect(html).toContain("لم يُرسل بريد حقيقي"); expect(html).toContain('name="confirmed"');
  });
  it("keeps the invitation credential in a strictly validated passport return rather than creating an operator membership", () => {
    state.opened = { status: "opened", invitation: { prospect_type: "PROVIDER", delivery_mode: "EXTERNAL", organizations: [] } };
    const html = renderToStaticMarkup(<NetworkRecipientForm locale="fr" invitationId={id} token={token} idempotencyKey={id} />);
    expect(html).toContain("/fr/organisation?role=fournisseur&amp;next="); expect(html).toContain("rejoindre-reseau%3FinvitationId%3D"); expect(html).toContain("Aucune organisation active autorisée");
  });
});
