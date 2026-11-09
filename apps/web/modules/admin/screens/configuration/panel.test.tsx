import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/link", () => ({ default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ managePlatformConfiguration: async () => ({ status: "idle" }) }));
import { ConfigurationPanel } from "./panel";
import type { ConfigurationDashboardView, ConfigurationRevision, ConfigurationSection } from "./view-model";
const actor = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const sections: ConfigurationSection[] = ["COMPANY", "RESEND", "PAYPAL", "YOUSIGN", "SCANNER"];
const revision: ConfigurationRevision = { id: other, section: "RESEND", environment: "STAGING", settings: { RESEND_FROM_EMAIL: "support@example.test", RESEND_FROM_NAME: "Client", EMAIL_RECIPIENT_ALLOWLIST: "@example.test", RESEND_API_KEY: "PRIVATE-MUST-NOT-BE-RENDERED" }, secret_keys: ["RESEND_API_KEY", "RESEND_WEBHOOK_SECRET"], content_hash: "b".repeat(64), status: "DRAFT", created_by: other, created_at: "2026-11-09T10:00:00Z", approved_by: null, approved_at: null, probe: null };
function dashboard(): ConfigurationDashboardView { return { environment: "STAGING", actor_id: actor, can_write: true, sections: sections.map(section => ({ section, active_revision_id: null, latest_revision_id: section === "RESEND" ? other : null, revisions: section === "RESEND" ? [revision] : [] })) }; }
const keys = { ...Object.fromEntries(sections.map(section => [`save:${section}`, actor])), [`revision:${other}`]: actor };
function render(locale: "fr" | "ar", data = dashboard()) { return renderToStaticMarkup(<ConfigurationPanel locale={locale} data={data} keys={keys} observedAt="2026-11-09T10:15:00Z"/>); }
describe("Admin configuration UI", () => {
  it("provides actual persisted configuration forms, safe links and five explicit stages", () => {
    const html = render("fr");
    expect(html).toContain('name="settings:legalName"'); expect(html).toContain('name="secret:RESEND_API_KEY"');
    expect(html).toContain('name="sourceRevisionId" value="'+other+'"'); expect(html).toContain('name="expectedActiveId" value=""');
    expect(html).toContain('href="/fr/administration/politiques-contrats"'); expect(html).toContain('href="/fr/administration/utilisateurs"');
    expect(html).toContain('href="#configuration-step-review"'); expect(html).toContain('value="0"');
    expect(html).toContain("ne certifie ni la livraison"); expect(html).not.toContain("prête pour la production");
  });
  it("never renders a private key even if it is accidentally present in settings", () => {
    const html = render("fr"); expect(html).not.toContain("PRIVATE-MUST-NOT-BE-RENDERED");
    const secrets = html.match(/<input[^>]*data-configuration-secret[^>]*>/gu) ?? [];
    expect(secrets.length).toBeGreaterThan(5);
    for (const input of secrets) { expect(input).toContain('type="password"'); expect(input).not.toContain('value="'); expect(input).toContain('autoComplete="new-password"'); }
    expect(html).toContain("Laissez un champ secret vide");
  });
  it("uses explicitly associated labels, readable status and mobile RTL layouts", () => {
    const html = render("ar");
    expect(html).toContain('dir="rtl"'); expect(html).toContain("الإعدادات المفعلة"); expect(html).toContain("مفتاح YouSign API"); expect(html).toContain('role="status"');
    const controls = [...html.matchAll(/<(?:input|textarea|select)[^>]*\sid="([^"]+)"/gu)].map(row => row[1]);
    const labels = [...html.matchAll(/<label[^>]*\sfor="([^"]+)"/gu)].map(row => row[1]);
    expect(controls.length).toBeGreaterThan(20); for (const id of controls) expect(labels).toContain(id);
    expect(html).not.toMatch(/(?:min-w|w)-\[(?:[4-9]\d\d|\d{4,})px\]/u);
  });
  it("keeps activation disabled until the exact provider revision has a fresh successful probe", () => {
    const html = render("fr");
    expect(html).toMatch(/<button[^>]*value="approve"[^>]*disabled=""/u);
    expect(html).toContain("encore valide"); expect(html).toContain('value="test"');
    const data = dashboard(); data.sections[1]!.revisions[0] = { ...revision, probe: { status: "PASS", code: "CONNECTED", checked_at: "2026-11-09T10:10:00Z", valid_until: "2026-11-09T10:40:00Z" } };
    const approved = render("fr", data); expect(approved).not.toMatch(/<button[^>]*value="approve"[^>]*disabled=""/u); expect(approved).toContain("Connexion vérifiée");
  });
  it("does not show self-approval or mutating controls to a read-only administrator", () => {
    const own = dashboard(); own.actor_id = other;
    expect(render("fr", own)).not.toContain('value="approve"'); expect(render("fr", own)).toContain("Un autre administrateur");
    const readOnly = dashboard(); readOnly.can_write = false;
    expect(render("fr", readOnly)).not.toContain("Enregistrer pour approbation"); expect(render("fr", readOnly)).not.toContain('value="test"');
  });
});
