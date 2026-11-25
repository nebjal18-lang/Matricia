import { describe, expect, it } from "vitest";
import { diagnosticNeedHandoff } from "./diagnostic-handoff";

const answers = {
  sector: "construction",
  team_size: "small",
  goals: ["control_costs", "grow_sales"],
  priority_tracking: "partial",
  sales_tracking: "manual",
  backup_restore: "no",
  decision_trace: "no",
  next_action: "Améliorer le suivi des devis et la rentabilité des chantiers.",
};
const stored = JSON.stringify({ version: 2, expiresAt: 2_000_000, step: 8, answers });

describe("diagnostic to need handoff", () => {
  it.each(["fr", "ar"] as const)("preserves the eight declared answers and selected sales priority in %s", (locale) => {
    const result = diagnosticNeedHandoff(stored, "sales", locale, 1_000_000);
    expect(result?.priority).toBe("sales");
    expect(result?.need).toContain(answers.next_action);
    expect(result?.need).toContain(locale === "fr" ? "Fiabiliser le suivi commercial" : "المتابعة التجارية");
    expect(result?.constraints).toContain(locale === "fr" ? "BTP, immobilier & aménagement" : "بناء وعقار وتهيئة");
    expect(result?.constraints).toContain(locale === "fr" ? "Maîtriser mes coûts" : "ضبط التكاليف");
    expect(result?.constraints).toContain(locale === "fr" ? "Développer mes ventes" : "تطوير المبيعات");
    expect(result?.constraints).toContain(locale === "fr" ? "Tableaux manuels" : "جداول يدوية");
    expect(result?.constraints).toContain(locale === "fr" ? "Rentabilité par chantier à mesurer" : "ربحية كل ورش يجب قياسها");
    expect(result?.questions).toEqual({ chantierCosts: true, quoteFollowup: true });
  });

  it("distinguishes sector from service and leaves profitability unverified", () => {
    const result = diagnosticNeedHandoff(stored, "organization", "fr", 1_000_000);
    expect(result?.need).toContain("Priorité choisie : Mieux structurer le suivi des priorités");
    expect(result?.constraints).toContain("coûts et marges non renseignés");
    expect(result).not.toHaveProperty("classification");
  });

  it("rejects missing, expired, incomplete or untriggered contexts", () => {
    expect(diagnosticNeedHandoff(null, "sales", "fr", 1_000_000)).toBeNull();
    expect(diagnosticNeedHandoff(stored, "sales", "fr", 2_000_000)).toBeNull();
    expect(diagnosticNeedHandoff(stored, "other", "fr", 1_000_000)).toBeNull();
    expect(diagnosticNeedHandoff(JSON.stringify({ version: 2, expiresAt: 2_000_000, step: 7, answers }), "sales", "fr", 1_000_000)).toBeNull();
    expect(diagnosticNeedHandoff(stored, "verify", "fr", 1_000_000)).toBeNull();
  });

  it("keeps different goals for the same sector and the same sales issue across sectors", () => {
    const make = (sector: string, goals: string[], salesTracking: string) => JSON.stringify({
      version: 2, expiresAt: 2_000_000, step: 8,
      answers: { ...answers, sector, goals, sales_tracking: salesTracking },
    });
    const costsOnly = diagnosticNeedHandoff(make("construction", ["control_costs"], "shared"), "organization", "fr", 1_000_000);
    const salesInBtp = diagnosticNeedHandoff(make("construction", ["grow_sales"], "manual"), "sales", "fr", 1_000_000);
    const salesInCommerce = diagnosticNeedHandoff(make("commerce", ["grow_sales"], "manual"), "sales", "fr", 1_000_000);
    expect(costsOnly?.constraints).toContain("Maîtriser mes coûts");
    expect(costsOnly?.constraints).not.toContain("Développer mes ventes");
    expect(salesInBtp?.constraints).toContain("BTP, immobilier & aménagement");
    expect(salesInCommerce?.constraints).toContain("Commerce & distribution");
    expect(salesInBtp?.priority).toBe(salesInCommerce?.priority);
    expect(salesInCommerce?.constraints).not.toContain("Rentabilité par chantier à mesurer");
    expect(salesInCommerce?.questions).toEqual({ chantierCosts: false, quoteFollowup: true });
  });
});
