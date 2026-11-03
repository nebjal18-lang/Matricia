import { describe, expect, it } from "vitest";
import { taxContextSchema,taxDecisionSchema, taxProposalSchema, taxSimulationSchema } from "./model";

const uuid = "11111111-1111-4111-8111-111111111111";
describe("morocco tax contracts", () => {
  it("discrimine un contexte central sans organisation et un contexte explicite d’organisation",()=>{
    expect(taxContextSchema.safeParse({kind:"PLATFORM"}).success).toBe(true);
    expect(taxContextSchema.safeParse({kind:"PLATFORM",organizationId:uuid}).success).toBe(false);
    expect(taxContextSchema.safeParse({kind:"ORGANIZATION",organizationId:uuid}).success).toBe(true);
    expect(taxContextSchema.safeParse({kind:"ORGANIZATION"}).success).toBe(false);
  });
  it("accepte un calcul exact et refuse zéro", () => { expect(taxSimulationSchema.safeParse({ categoryCode: "PROVIDER_COMMISSION", effectiveOn: "2026-09-12", netMinor: "12500", sourceRuleVersionId: "" }).success).toBe(true); expect(taxSimulationSchema.safeParse({ categoryCode: "PROVIDER_COMMISSION", effectiveOn: "2026-09-12", netMinor: "0", sourceRuleVersionId: "" }).success).toBe(false); });
  it("interdit un taux non nul sur une exonération", () => { const base = { context:{kind:"PLATFORM"}, categoryCode: "SERVICE", ruleType: "EXEMPT", rateBasisPoints: 100, priority: 100, legalReference: "Référence professionnelle Maroc", effectiveFrom: "2026-09-12", effectiveTo: "", changeReason: "Validation professionnelle requise", idempotencyKey: uuid }; expect(taxProposalSchema.safeParse(base).success).toBe(false); expect(taxProposalSchema.safeParse({ ...base, rateBasisPoints: 0 }).success).toBe(true); });
  it("exige une décision documentée", () => { expect(taxDecisionSchema.safeParse({ context:{kind:"PLATFORM"}, taxRuleVersionId: uuid, decision: "APPROVE", professionalValidationStatus: "VALIDATED", validationReference: "REF-CPA-2026", reason: "Validation documentée par le professionnel", rowVersion: 0, idempotencyKey: uuid }).success).toBe(true); });
});
