import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpaceRow } from "@/modules/admin/data/spaces/space-data";
import { SpaceQueueBoard } from "./queue-kit";

const fixtureRow: SpaceRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  href: "/fr/administration/diagnostics/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "P05 A",
  cells: ["P05 A", "Diagnostic entreprise", "v2", "55 %", "Priorité Importante", "21 sept. 2025, 21:03", "COMPLETED"],
  status: "COMPLETED",
  tone: "mint",
  fixture: true,
  extras: { scorePercent: "55", progressPercent: "55" },
};

const operationalRow: SpaceRow = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  href: "/fr/administration/diagnostics/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  title: "Atlas Conseil",
  cells: ["Atlas Conseil", "Diagnostic entreprise", "v1", "72 %", "Priorité Critique", "13 nov. 2026, 10:00", "IN_PROGRESS"],
  status: "IN_PROGRESS",
  tone: "peach",
  treat: true,
  extras: { scorePercent: "72", progressPercent: "72" },
};

describe("diagnostics SpaceQueueBoard", () => {
  it("masque les fixtures, localise l’état et affiche le score (pas une fausse progression)", () => {
    const hidden = renderToStaticMarkup(
      <SpaceQueueBoard locale="fr" query="" space="diagnostics" rows={[fixtureRow, operationalRow]} treat={[operationalRow]} />,
    );
    expect(hidden).toContain("Atlas Conseil");
    expect(hidden).toContain("1 élément(s) de test / démo masqué(s).");
    expect(hidden).toContain("fixtures=1");
    expect(hidden).toContain("admin-queue-progress");
    expect(hidden).toContain("Score");
    expect(hidden).not.toContain(">Progression<");
    expect(hidden).toContain("Terminé");
    expect(hidden).toContain("v1");
    expect(hidden).not.toContain(">P05 A<");

    const shown = renderToStaticMarkup(
      <SpaceQueueBoard locale="fr" query="?fixtures=1" space="diagnostics" rows={[fixtureRow, operationalRow]} treat={[operationalRow]} includeFixtures />,
    );
    expect(shown).toContain("P05 A");
    expect(shown).toContain("Atlas Conseil");
    expect(shown).toContain("v2");
  });
});
