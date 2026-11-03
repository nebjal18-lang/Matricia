import { renderToStaticMarkup } from "react-dom/server";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { DiagnosticTools } from "./diagnostic-tools";

vi.mock("@/modules/shared/ui/card", () => {
  const Slot = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return { Card: Slot, CardContent: Slot, CardHeader: Slot, CardTitle: Slot };
});

const copy = { tools: "Outils", assistance: "Assistance", assistanceHelp: "Aide", openAssistance: "Ouvrir", evolution: "Évolution", evolutionHelp: "Historique", openEvolution: "Voir" };

describe("DiagnosticTools", () => {
  it("keeps the selected organization on assistance and evolution links",()=>{const html=renderToStaticMarkup(<DiagnosticTools locale="fr" query="?organizationId=selected-B" m={copy}/>);expect(html).toContain('href="/fr/client/diagnostics/assistance?organizationId=selected-B"');expect(html).toContain('href="/fr/client/diagnostics/evolution?organizationId=selected-B"');});
  it.each(["fr", "ar"] as const)("rend les parcours d’assistance et d’évolution en %s", (locale) => {
    const html = renderToStaticMarkup(<DiagnosticTools locale={locale} m={copy}/>);
    expect(html).toContain(`href="/${locale}/client/diagnostics/assistance"`);
    expect(html).toContain(`href="/${locale}/client/diagnostics/evolution"`);
    expect(html).toContain("min-h-11");
  });
});
