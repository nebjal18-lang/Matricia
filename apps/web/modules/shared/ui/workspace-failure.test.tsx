import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceFailure } from "./workspace-failure";
afterEach(() => vi.restoreAllMocks());

describe("safe workspace failures", () => {
  it.each(["fr", "ar"] as const)("provides an actionable technical failure and an opaque support reference in %s", locale => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(<WorkspaceFailure locale={locale} reason="QUERY_FAILED" returnPath={`/${locale}/client/demandes/id?token=never-log-this`} supportReference="support-test-123" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("support-test-123");
    expect(html).toContain(locale === "fr" ? "Réessayer le chargement" : "إعادة التحميل");
    expect(html).not.toContain("PostgREST");
    expect(html).not.toContain("QUERY_FAILED</");
    expect(JSON.stringify(log.mock.calls)).not.toContain("never-log-this");
    expect(JSON.stringify(log.mock.calls)).toContain("support-test-123");
  });
  it.each(["fr", "ar"] as const)("MFA CTA retains the exact destination in %s", locale => {
    const next = `/${locale}/administration/entreprises/nouvelle`;
    const html = renderToStaticMarkup(<WorkspaceFailure locale={locale} reason="MFA_REQUIRED" returnPath={next} />);
    expect(html).toContain(`/${locale}/securite/compte?next=${encodeURIComponent(next)}`);
    expect(html).not.toContain("support-test");
  });
  it("does not treat a role denial as an empty result or an expired session", () => {
    const html = renderToStaticMarkup(<WorkspaceFailure locale="fr" reason="FORBIDDEN" returnPath="/fr/administration" />);
    expect(html).toContain("habilitations nécessaires");
    expect(html).not.toContain("Me reconnecter");
    expect(html).not.toContain("Réessayer");
  });
});
