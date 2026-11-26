import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  applyDemoCatalogQuestionsWorkspace,
  buildDemoCatalogQuestionWorkspace,
  canApplyAdminDemoCatalogQuestions,
  demoCatalogQuestionCounts,
  isDemoCatalogQuestionWorkspace,
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
    expect(applyDemoCatalogQuestionsWorkspace(empty)).toEqual({ workspace: empty, demoFallback: false });
  });

  it("remplit un workspace vide et marque la simulation de secours", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    const counts = demoCatalogQuestionCounts();
    const built = buildDemoCatalogQuestionWorkspace();
    expect(built.versions).toHaveLength(counts.versions);
    expect(built.questions).toHaveLength(counts.questions);
    expect(built.questions.every((row) => row.dataKey.startsWith("it."))).toBe(true);
    expect(isDemoCatalogQuestionWorkspace(built)).toBe(true);
    expect(built.versions[0]?.titleFr).toContain("simulation de secours");

    const filled = applyDemoCatalogQuestionsWorkspace(
      { versions: [], selectedVersionId: null, questions: [] },
    );
    expect(filled.demoFallback).toBe(true);
    expect(filled.workspace.versions.length).toBe(1);
    expect(filled.workspace.questions.length).toBe(5);

    // Native COM shell with empty questions must NOT receive IT demo questions.
    const nativeEmptyQuestions = applyDemoCatalogQuestionsWorkspace({
      versions: [{
        id: "11111111-1111-4111-8111-111111111111",
        version: 2,
        status: "PUBLISHED",
        titleFr: "Questionnaire Communication",
        titleAr: "استبيان التواصل",
        audience: "CLIENT",
        engineVersion: "2.0.0",
        policyVersion: "P06",
        libraryId: "22222222-2222-4222-8222-222222222222",
        libraryCode: "COM",
      }],
      selectedVersionId: "11111111-1111-4111-8111-111111111111",
      questions: [],
    });
    expect(nativeEmptyQuestions.demoFallback).toBe(false);
    expect(nativeEmptyQuestions.workspace.questions).toEqual([]);
    expect(nativeEmptyQuestions.workspace.versions[0]?.libraryCode).toBe("COM");
  });

  it("branche la page catalogue/validation sur l’overlay", () => {
    const page = readFileSync(
      fileURLToPath(new URL("../../../../app/[locale]/administration/catalogue/validation/page.tsx", import.meta.url)),
      "utf8",
    );
    expect(page).toContain("resolveDemoCatalogQuestionsWorkspace");
    expect(page).toContain("demoFallback");
  });

  it("retombe sur la démo quand le chargement natif est indisponible", () => {
    process.env.APP_ENV = "development";
    process.env.MATRICIA_DEMO_ACCESS_ENABLED = "true";
    const fallback = resolveDemoCatalogQuestionsWorkspace({ status: "error", reason: "UNAVAILABLE" });
    expect(fallback?.demoFallback).toBe(true);
    expect(fallback?.workspace.questions.length).toBe(5);
    expect(isDemoCatalogQuestionWorkspace(fallback!.workspace)).toBe(true);

    expect(resolveDemoCatalogQuestionsWorkspace({ status: "error", reason: "FORBIDDEN" })).toBeNull();
    expect(resolveDemoCatalogQuestionsWorkspace({
      status: "success",
      value: { versions: [], selectedVersionId: null, questions: [] },
    })?.demoFallback).toBe(true);
  });
});
