import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPublicJourneyCopy } from "@/modules/public/data/journey/copy";

describe("prédiagnostic mobile — hiérarchie du premier écran", () => {
  const source = readFileSync(new URL("./prediagnostic-flow.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("./diagnostic-premium.module.css", import.meta.url), "utf8");

  it("raccourcit l’introduction et retire le slogan du flux des questions", () => {
    const fr = getPublicJourneyCopy("fr").diagnostic;
    const ar = getPublicJourneyCopy("ar").diagnostic;
    expect(fr.title).toBe("Orientez votre entreprise");
    expect(ar.title).toBe("وجّهوا مؤسستكم");
    expect(fr.intro.length).toBeLessThan(90);
    expect(ar.intro.length).toBeLessThan(90);
    expect(source).toContain("heroCompact");
    expect(source).not.toMatch(/phase === "questions"[\s\S]*scriptNote/);
    expect(source).toContain("stepsDetails");
    expect(source).not.toContain("styles.progressPct");
    expect(source).not.toContain("copy.percent");
  });

  it("empêche le point d’interrogation français d’être isolé", () => {
    for (const [question] of getPublicJourneyCopy("fr").diagnostic.questions) {
      if (question.includes("?")) expect(question).toContain("\u202F?");
    }
  });

  it("garde la progression compacte et les étapes à la demande sur mobile", () => {
    expect(css).toContain(".progressRow");
    expect(css).toContain(".stepsDetails");
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*\.railDesktop \{ display: none; \}/);
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*\.stepsDetails \{ display: block; \}/);
    expect(css).toMatch(/@media \(max-width: 980px\)[\s\S]*\.script \{ display: none; \}/);
    expect(source).toContain('role="progressbar"');
    expect(source).toContain("autoSaveNote");
  });
});
