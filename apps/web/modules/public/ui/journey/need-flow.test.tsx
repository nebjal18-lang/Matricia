import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NeedComposer, NeedFlow, NeedResult, needComposerSection, needProgressPercent, parseNeedDraft } from "./need-flow";
import { canonicalizePublicNeedClassification } from "@/modules/public/data/need-intent/model";
import { getNeedStages } from "@/modules/public/data/journey/need-stages";

describe("NeedFlow continuity", () => {
  it("renders an accessible loading heading in both directions", () => {
    expect(renderToStaticMarkup(<NeedFlow locale="fr" />)).toContain("<h1>Décrivez votre besoin</h1>");
    expect(renderToStaticMarkup(<NeedFlow locale="ar" />)).toContain('dir="rtl"');
  });

  it("exposes a real stage progress bar, not a decorative strip", () => {
    expect(needProgressPercent(1, 5)).toBe(20);
    expect(needProgressPercent(5, 5)).toBe(100);
    const html = renderToStaticMarkup(<NeedFlow locale="fr" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('aria-valuemax="5"');
  });

  it("migrates a valid v2 draft without inventing confirmation", () => {
    const future = Date.now() + 10_000;
    const result = parseNeedDraft(JSON.stringify({ version: 2, step: 4, need: "Audit du réseau interne", location: "", timing: "", constraints: "", expiresAt: future }), "fr");
    expect(result.status).toBe("valid");
    expect(result.draft).toMatchObject({ version: 3, step: 4, confirmed: false, answers: {} });
  });

  it("rejects expired drafts and preserves canonical codes", () => {
    const classification = canonicalizePublicNeedClassification({ libraryCode: "IT", serviceCode: "IT-AUDIT-SI" }, "fr");
    expect(parseNeedDraft(JSON.stringify({ version: 3, step: 2, need: "Audit du réseau interne", location: "", timing: "", constraints: "", classification, confirmed: true, expiresAt: 1 }), "fr", "", classification, 2).status).toBe("expired");
    const valid = parseNeedDraft(JSON.stringify({ version: 3, step: 2, need: "Audit du réseau interne", location: "", timing: "", constraints: "", classification, confirmed: true, expiresAt: 20 }), "fr", "", null, 2);
    expect(valid.draft?.classification?.serviceCode).toBe("IT-AUDIT-SI");
  });

  it("plafonne le récapitulatif à l’étape 4", () => {
    const future = Date.now() + 10_000;
    const result = parseNeedDraft(JSON.stringify({ version: 3, step: 9, need: "Audit du réseau interne", location: "", timing: "", constraints: "", expiresAt: future }), "fr");
    expect(result.draft?.step).toBe(4);
  });

  it("découpe le parcours en une section visible à la fois", () => {
    expect(needComposerSection(0)).toBe("describe");
    expect(needComposerSection(1)).toBe("understand");
    expect(needComposerSection(2)).toBe("questions");
    expect(needComposerSection(3)).toBe("complete");
    expect(needComposerSection(4)).toBe("recap");
    expect(needComposerSection(9)).toBe("recap");
  });

  it("restores confirmed answers without inventing a service", () => {
    const future = Date.now() + 10_000;
    const result = parseNeedDraft(JSON.stringify({ version: 3, step: 2, need: "Audit du réseau interne", location: "Casablanca", timing: "", constraints: "", answers: { "site.count": "3" }, expiresAt: future }), "fr");
    expect(result.draft?.answers).toEqual({ "site.count": "3" });
    expect(result.draft?.classification).toBeNull();
  });
});

describe.each(["fr", "ar"] as const)("need stages in %s", (locale) => {
  const draft = (step: number) => parseNeedDraft(JSON.stringify({ version: 3, step, need: "Rénover mon chantier — نصي الأصلي", location: "Casablanca", timing: "Trois mois", constraints: "Accès en journée", tags: [], answers: {}, expiresAt: Date.now() + 100_000 }), locale).draft!;

  it("keeps complements and documents within the same fourth stage", () => {
    const html = renderToStaticMarkup(<NeedComposer locale={locale} draft={draft(3)} setDraft={() => undefined} storageNotice={null} storageAvailable invalidSelection={false} authenticated={false} goRecap={() => undefined} />);
    expect(html).toContain('aria-valuenow="4"');
    expect(html).toContain('aria-valuemax="5"');
    expect(html).toContain('aria-current="step"');
    expect(html).not.toContain("<h2>5.");
  });

  it("marks the recap as the fifth stage and preserves the original input", () => {
    const html = renderToStaticMarkup(<NeedResult locale={locale} draft={draft(4)} authenticated={false} organizations={[]} storageAvailable storageNotice={null} invalidSelection={false} erase={() => undefined} edit={() => undefined} confirm={() => undefined} updateClassification={() => undefined} />);
    expect(html).toContain('aria-valuenow="5"');
    expect(html).toContain('aria-valuemax="5"');
    expect(html).toContain("Rénover mon chantier — نصي الأصلي");
    expect(html).toContain("Casablanca");
    expect(html).toContain("Trois mois");
  });

  it.each([0, 1, 2, 3])("uses the same definition for the rail, heading and progress at step %s", (step) => {
    const stage = getNeedStages(locale)[step]!;
    const html = renderToStaticMarkup(<NeedComposer locale={locale} draft={draft(step)} setDraft={() => undefined} storageNotice={null} storageAvailable invalidSelection={false} authenticated={false} goRecap={() => undefined} />);
    expect(html).toContain(`<h2 id="need-step-title">${step + 1}. ${stage.title}</h2>`);
    expect(html).toContain(`aria-valuenow="${step + 1}"`);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("preserves user free text, answers and canonical codes when restoring in another language", () => {
    const classification = canonicalizePublicNeedClassification({ libraryCode: "BTP", serviceCode: "BTP-RENOV" }, "fr");
    const initial = { ...draft(3), classification, answers: { "site.count": "3 — ثلاثة" } };
    const restored = parseNeedDraft(JSON.stringify(initial), locale).draft!;
    expect(restored.need).toBe(initial.need);
    expect(restored.answers).toEqual(initial.answers);
    expect(restored.classification?.serviceCode).toBe("BTP-RENOV");
    expect(restored.classification?.libraryCode).toBe("BTP");
    expect(restored.step).toBe(3);
    if (locale === "ar") expect(restored.classification?.serviceName).toContain("الاسم العربي غير متاح");
  });
});
