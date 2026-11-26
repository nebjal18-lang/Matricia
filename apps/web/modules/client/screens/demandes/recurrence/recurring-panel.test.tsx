import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/modules/shared/ui/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/modules/shared/ui/button", () => ({ Button: ({ children, ...props }: ComponentPropsWithoutRef<"button">) => <button {...props}>{children}</button> }));
vi.mock("@/modules/shared/ui/input", () => ({ Input: (props: ComponentPropsWithoutRef<"input">) => <input {...props} /> }));
vi.mock("@/modules/shared/ui/label", () => ({ Label: ({ children, ...props }: ComponentPropsWithoutRef<"label">) => <label {...props}>{children}</label> }));
vi.mock("@/modules/shared/ui/textarea", () => ({ Textarea: (props: ComponentPropsWithoutRef<"textarea">) => <textarea {...props} /> }));
vi.mock("@/modules/client/data/recurring/command-identity", async () => await import("@/modules/client/data/recurring/command-identity"));
vi.mock("./actions", () => ({ cloneRequestAction: async () => ({ status: "idle" }), createPlanAction: async () => ({ status: "idle" }), generateOccurrencesAction: async () => ({ status: "idle" }), transitionPlanAction: async () => ({ status: "idle" }) }));
import { RecurringPanel } from "./recurring-panel";
import { getClientRecurringMessages } from "./messages";
const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`, identity = { idempotencyKey: id(8), correlationId: id(9) };
const dashboard = { access: { activeRole: "CLIENT_OWNER" as const, canManage: true }, requests: [{ id: id(1), canManage: true, status: "CONTRACTED" as const, description: "Clôture comptable", desiredDate: "2026-10-01", versionNumber: 2, createdAt: "2026-09-01T00:00:00Z" }], plans: [{ id: id(2), canManage: true, templateRequestId: id(1), status: "ACTIVE" as const, rowVersion: 2, currentVersion: 2, cadence: "MONTHLY" as const, startsOn: "2026-10-01", endsOn: null, reason: "Cycle actif", updatedAt: "2026-09-12T00:00:00Z", occurrences: [{ id: id(3), scheduledOn: "2026-10-01", generatedRequestId: id(4), createdAt: "2026-09-12T00:00:00Z" }] }] };
const identities = { clone: identity, create: identity, plans: { [id(2)]: { transition: identity, generate: identity } } };
describe("RecurringPanel", () => {
  it("preserves the selected organization when opening generated drafts", () => {
    const selectedQuery = `?organizationId=${id(6)}`;
    const html = renderToStaticMarkup(<RecurringPanel dashboard={dashboard} locale="fr" messages={getClientRecurringMessages("fr")} today="2026-09-12" horizon="2027-09-13" identities={identities} selectedQuery={selectedQuery} />);
    expect(html).toContain(`/fr/client/demandes/${id(4)}${selectedQuery}`);
  });
  it("associe les contrôles à des libellés et annonce chaque retour", () => { const html = renderToStaticMarkup(<RecurringPanel dashboard={dashboard} locale="fr" messages={getClientRecurringMessages("fr")} today="2026-09-12" horizon="2027-09-13" identities={identities} />); const controls = [...html.matchAll(/<(?:input|select|textarea)[^>]*\sid="([^"]+)"/g)].map((match) => match[1]), labels = [...html.matchAll(/<label[^>]+for="([^"]+)"/g)].map((match) => match[1]); expect(labels.every((label) => controls.includes(label))).toBe(true); expect((html.match(/aria-live="polite"/g) ?? []).length).toBe(4); expect(html).toContain('name="expectedRowVersion" value="2"'); expect(html).toContain('max="24"'); });
  it("rend l’arabe RTL sans largeur fixe incompatible 360 px", () => { const html = renderToStaticMarkup(<div dir="rtl" lang="ar"><RecurringPanel dashboard={dashboard} locale="ar" messages={getClientRecurringMessages("ar")} today="2026-09-12" horizon="2027-09-13" identities={identities} /></div>); expect(html).toContain('dir="rtl"'); expect(html).toContain("الخطط المتكررة"); expect(html).toContain("w-full sm:w-auto"); expect(html).not.toMatch(/(?:min-w|max-w|w)-\[(?:[4-9]\d\d|\d{4,})px\]/u); });
  it("rend les états vides sans formulaire inactif", () => { const html = renderToStaticMarkup(<RecurringPanel dashboard={{ access: { activeRole: "CLIENT_OWNER", canManage: true }, requests: [], plans: [] }} locale="fr" messages={getClientRecurringMessages("fr")} today="2026-09-12" horizon="2027-09-13" identities={{ clone: identity, create: identity, plans: {} }} />); expect(html).toContain("Aucune demande disponible"); expect(html).toContain("Aucun plan récurrent"); expect(html).not.toContain("<form"); });
  it("rend CLIENT_VIEWER en lecture seule sans aucune mutation", () => { const html = renderToStaticMarkup(<RecurringPanel dashboard={{ ...dashboard, access: { activeRole: "CLIENT_VIEWER", canManage: false } }} locale="fr" messages={getClientRecurringMessages("fr")} today="2026-09-12" horizon="2027-09-13" identities={identities} />); expect(html).toContain("Consultation uniquement"); expect(html).not.toContain("<form"); expect(html).toContain("Ouvrir le brouillon"); });
  it("masque clonage et génération sans détruire l’historique ni pause/fin", () => {
    const html = renderToStaticMarkup(<RecurringPanel dashboard={dashboard} locale="fr" messages={getClientRecurringMessages("fr")} today="2026-09-12" horizon="2027-09-13" identities={identities} canOpenNew={false} />);
    expect(html).not.toContain("Créer le brouillon");
    expect(html).not.toContain("Créer le plan");
    expect(html).not.toContain("Générer les prochains cycles");
    expect(html).toContain("Mettre en pause");
    expect(html).toContain("Terminer");
    expect(html).toContain("Ouvrir le brouillon");
  });
});
