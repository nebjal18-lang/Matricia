import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ completeLatestAction: vi.fn(), idle: { status: "idle" } }));
vi.mock("@/modules/shared/ui/button", () => ({ Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} /> }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
import { CompleteForm } from "./complete-form";
import { messages } from "./messages";

describe("client analysis form", () => {
  it("does not expose a session or service identifier", () => {
    const html = renderToStaticMarkup(<CompleteForm locale="fr" organizations={[{ id: "11111111-1111-4111-8111-111111111111", name: "Entreprise A", latestAt: "2026-09-15T12:00:00Z" }]} questionnaireHref="/fr/client/questionnaires" m={messages("fr")} keyValue="44444444-4444-4444-8444-444444444444" />);
    expect(html).not.toContain('name="sessionId"');
    expect(html).not.toContain('name="serviceId"');
    expect(html).not.toContain("Session soumise");
    expect(html).toContain("Actualiser mon analyse");
  });

  it("offers a named explicit choice when several services are published in the same scope",()=>{const html=renderToStaticMarkup(<CompleteForm locale="fr" organizations={[{id:"11111111-1111-4111-8111-111111111111",name:"Entreprise",latestAt:"2026-09-15T12:00:00Z"}]} serviceChoices={[{id:"22222222-2222-4222-8222-222222222222",name:"Audit de conformité"},{id:"33333333-3333-4333-8333-333333333333",name:"Préparation administrative"}]} questionnaireHref="/fr/client/questionnaires" m={messages("fr")} keyValue="44444444-4444-4444-8444-444444444444"/>);expect(html).toContain('name="analysisServiceId"');expect(html).toContain("Audit de conformité");expect(html).toContain("Préparation administrative");expect(html).toContain('value=""');});

  it("renders an honest empty state without an inactive form action", () => {
    const html = renderToStaticMarkup(<CompleteForm locale="ar" organizations={[]} questionnaireHref="/ar/client/questionnaires" m={messages("ar")} keyValue="44444444-4444-4444-8444-444444444444" />);
    expect(html).toContain("لا يوجد تقييم مكتمل");
    expect(html).toContain('href="/ar/client/questionnaires"');
    expect(html).not.toContain("<button");
  });

  it("asks for a named organization when several authorized contexts exist", () => {
    const html = renderToStaticMarkup(<CompleteForm locale="fr" organizations={[{ id: "11111111-1111-4111-8111-111111111111", name: "Entreprise A", latestAt: "2026-09-15T12:00:00Z" }, { id: "22222222-2222-4222-8222-222222222222", name: "Entreprise B", latestAt: "2026-09-14T12:00:00Z" }]} questionnaireHref="/fr/client/questionnaires" m={messages("fr")} keyValue="44444444-4444-4444-8444-444444444444" />);
    expect(html).toContain("Entreprise concernée");
    expect(html).toContain("Entreprise A");
    expect(html).toContain("Entreprise B");
  });
});
