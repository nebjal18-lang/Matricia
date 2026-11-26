import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applyDemoCatalogQuestionsWorkspace,
  buildDemoCatalogQuestionWorkspace,
  canApplyAdminDemoCatalogQuestions,
  demoCatalogQuestionCounts,
  resolveDemoCatalogQuestionsWorkspace,
} from "./demo-catalog-questions";

describe("demo catalogue questions (validation thin path)", () => {
  afterEach(() => {
    delete process.env.MATRICIA_DEMO_ACCESS_ENABLED;
    delete process.env.APP_ENV;
  });

  it("reste masqué hors flag", () => {
    process.env.APP_ENV = "development";
    expect(canApplyAdminDemoCatalogQuestions()).toBe(false);
    const empty = { versions: [], selectedVersionId: null, questions: [] };
    expect(applyDemoCatalogQuestionsWorkspace(empty)).toEqual(empty);
  });

  it("remplit versions + questions quand le workspace est vide", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    const counts = demoCatalogQuestionCounts();
    const built = buildDemoCatalogQuestionWorkspace();
    expect(built.versions).toHaveLength(counts.versions);
    expect(built.questions).toHaveLength(counts.questions);
    expect(built.questions.every((row) => row.dataKey.startsWith("it."))).toBe(true);

    const filled = applyDemoCatalogQuestionsWorkspace(
      { versions: [], selectedVersionId: null, questions: [] },
    );
    expect(filled.versions.length).toBe(1);
    expect(filled.questions.length).toBe(5);

    const thinQuestions = applyDemoCatalogQuestionsWorkspace(
      {
        versions: built.versions,
        selectedVersionId: built.selectedVersionId,
        questions: [],
      },
    );
    expect(thinQuestions.questions).toHaveLength(5);
  });

  it("branche la page catalogue/validation sur l’overlay", () => {
    const page = readFileSync(
      fileURLToPath(new URL("../../../../app/[locale]/administration/catalogue/validation/page.tsx", import.meta.url)),
      "utf8",
    );
    expect(page).toContain("resolveDemoCatalogQuestionsWorkspace");
  });

  it("retombe sur la démo quand le chargement natif est indisponible", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    const fallback = resolveDemoCatalogQuestionsWorkspace({ status: "error", reason: "UNAVAILABLE" });
    expect(fallback?.demoFallback).toBe(true);
    expect(fallback?.workspace.questions.length).toBe(5);

    expect(resolveDemoCatalogQuestionsWorkspace({ status: "error", reason: "FORBIDDEN" })).toBeNull();
    expect(resolveDemoCatalogQuestionsWorkspace({
      status: "success",
      value: { versions: [], selectedVersionId: null, questions: [] },
    })?.demoFallback).toBe(false);
  });
});
