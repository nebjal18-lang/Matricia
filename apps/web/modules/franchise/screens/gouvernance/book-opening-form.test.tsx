import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("./book-opening-actions", () => ({ openFranchiseBookForMandate: vi.fn() }));
import { FranchiseBookOpeningForm } from "./book-opening-form";
import type { BookOpeningContext } from "@/modules/franchise/data/governance/book-opening";
const id = "11111111-1111-4111-8111-111111111111";
const context: BookOpeningContext = { complete: true, reviewRequired: true, choices: [{ franchiseId: id, franchiseStatus: "ENTRY_FEE_SETUP", approvedMandateVersionId: id, expectedMandateHash: "a".repeat(64), mandateVersion: 2, financeRuleId: id, financeRuleVersion: 1, libraryCode: "TEST_BTP", territoryCode: "TEST_TERRITOIRE", organizationName: "Organisation test approuvée", entryFeeMinor: "100000", feeCurrency: "MAD", currency: "MAD", effectiveFrom: "2026-11-03", effectiveUntil: null, boundBookId: null }] };
describe("financial book recovery form", () => {
  it("offers named approved choices and no raw identifier, hash, operator or share input", () => {
    const html = renderToStaticMarkup(<FranchiseBookOpeningForm context={context} locale="fr" keys={[id]} returnPath="/fr/administration/gouvernance-franchise/livres"/>);
    expect(html).toContain("Organisation test approuvée"); expect(html).toContain("TEST_TERRITOIRE"); expect(html).toContain("Version 2"); expect(html).toContain("Règle financière 1"); expect(html).toContain("Aucune conversion de devise");
    expect(html).toContain("Certains livres nécessitent un rapprochement"); expect(html).not.toMatch(/type="text"|name="operatorCode"|name="franchiseType"|name="share/); expect(html).toContain("min-h-11");
  });
  it("renders native Arabic RTL and a precise authorized empty state", () => {
    const html = renderToStaticMarkup(<FranchiseBookOpeningForm context={{ ...context, choices: [] }} locale="ar" keys={[]} returnPath="/ar/administration/gouvernance-franchise/livres"/>);
    expect(html).toContain('dir="rtl"'); expect(html).toContain("لا يوجد تفويض معتمد"); expect(html).not.toContain("<form"); expect(html).not.toContain("Ouvrir le livre");
  });
});
