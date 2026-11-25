import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CockpitActionGroups, CockpitFeed, CockpitHero, CockpitMetricGrid } from "./cockpit";

describe("cockpit SIP primitives", () => {
  it("affiche la date et le contexte réel sans badge LIVE", () => {
    const html = renderToStaticMarkup(
      createElement(CockpitHero, {
        locale: "fr",
        eyebrow: "Pilotage",
        title: "Tableau de bord",
        lead: "Priorités du jour",
        contextLine: "Client · Assurance",
        statusLine: "3 dossiers ouverts",
        date: "2026-09-18T12:00:00.000Z",
      }),
    );
    expect(html).toContain("Client · Assurance");
    expect(html).toContain("3 dossiers ouverts");
    expect(html).not.toMatch(/\bLIVE\b/);
  });

  it("n’invente pas un zéro quand la métrique est indisponible", () => {
    const html = renderToStaticMarkup(
      createElement(CockpitMetricGrid, {
        title: "Indicateurs",
        metrics: [
          { id: "a", label: "Demandes", value: 4, unavailableLabel: "Indisponible", tone: "warn", href: "/fr/client/demandes" },
          { id: "b", label: "Devis", value: null, unavailableLabel: "Indisponible", tone: "critical", href: "/fr/client/demandes" },
        ],
      }),
    );
    expect(html).toContain("4");
    expect(html).toContain("Indisponible");
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain(">0<");
  });

  it("groupe les accès Clients, Prestataires, Franchises et Dépenses", () => {
    const html = renderToStaticMarkup(
      createElement(CockpitActionGroups, {
        title: "Accès rapides",
        groups: [
          { id: "clients", title: "Clients", links: [{ href: "/fr/administration/clients", label: "Dossiers" }] },
          { id: "providers", title: "Sous-traitants", links: [{ href: "/fr/administration/providers", label: "Qualification" }] },
          { id: "franchise", title: "Franchises", links: [{ href: "/fr/administration/gouvernance-franchise", label: "Gouvernance" }] },
          { id: "finance", title: "Dépenses", links: [{ href: "/fr/administration/finance", label: "Sorties" }] },
        ],
      }),
    );
    expect(html).toContain("Clients");
    expect(html).toContain("Sous-traitants");
    expect(html).toContain("Franchises");
    expect(html).toContain("Dépenses");
  });

  it("les pages clients et franchise passent par le chrome produit", async () => {
    const { readFile } = await import("node:fs/promises");
    const clients = await readFile(new URL("../../../app/[locale]/administration/clients/page.tsx", import.meta.url), "utf8");
    const franchise = await readFile(new URL("../../../app/[locale]/administration/gouvernance-franchise/page.tsx", import.meta.url), "utf8");
    const providers = await readFile(new URL("../../../app/[locale]/administration/providers/page.tsx", import.meta.url), "utf8");
    const finance = await readFile(new URL("../../../app/[locale]/administration/finance/page.tsx", import.meta.url), "utf8");
    expect(clients).toContain("AdminAppShell");
    expect(clients).not.toContain("bg-muted/40");
    expect(franchise).toContain("/administration/gouvernance");
    expect(franchise).not.toContain("bg-muted/40");
    expect(providers).toContain("renderAdminSpacePage");
    expect(finance).toContain("AdminModulePage");
    expect(finance).toContain("FinanceSorties");
    expect(finance).toContain("FinancePanel");
    expect(finance).toContain("admin-section-head");
    expect(finance).toContain('id="boxes"');
    const shell = await readFile(new URL("../../admin/ui/admin-app-shell.tsx", import.meta.url), "utf8");
    expect(shell).toContain("admin-page-standard.css");
    expect(shell).toContain("admin-page-standard");
    expect(shell).toContain("WorkspaceHashScroll");
    const clientShell = await readFile(new URL("../../client/ui/client-app-shell.tsx", import.meta.url), "utf8");
    expect(clientShell).toContain("client-page-standard.css");
    expect(clientShell).toContain("client-page-standard");
    const providerShell = await readFile(new URL("../../provider/ui/provider-app-shell.tsx", import.meta.url), "utf8");
    expect(providerShell).toContain("provider-page-standard.css");
    expect(providerShell).toContain("provider-page-standard");
    const franchiseShell = await readFile(new URL("../../franchise/ui/franchise-app-shell.tsx", import.meta.url), "utf8");
    expect(franchiseShell).toContain("franchise-page-standard.css");
    expect(franchiseShell).toContain("franchise-page-standard");
  });

  it("expose une file vide sans inventer de ligne", () => {
    const html = renderToStaticMarkup(
      createElement(CockpitFeed, {
        locale: "ar",
        title: "أولويات",
        empty: "لا توجد مهام",
        openLabel: "فتح",
        items: [],
      }),
    );
    expect(html).toContain("لا توجد مهام");
    expect(html).toContain('role="status"');
  });

  it("garde une grille simple sous 360 px", async () => {
    const { readFile } = await import("node:fs/promises");
    const css = await readFile(new URL("./admin-experience.css", import.meta.url), "utf8");
    const base = css.match(/\.cockpit-metric-grid \{[^}]*\}/)?.[0] ?? "";
    expect(base).toContain("display: grid");
    expect(base).not.toContain("repeat(");
    expect(css).toMatch(/@media \(min-width: 640px\) \{\s*\.cockpit-metric-grid/);
    expect(css).toMatch(/@media \(min-width: 1100px\) \{\s*\.cockpit-metric-grid/);
  });
});
