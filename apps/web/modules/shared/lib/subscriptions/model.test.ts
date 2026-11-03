import { describe, expect, it } from "vitest";
import { formatMinor, planChangeMode, planChangeSchema } from "./model";

describe("subscriptions", () => {
  it("formate les unités mineures sans conversion flottante", () => {
    expect(formatMinor("123456789012345678", "MAD", "fr").replaceAll("\u00a0", " ")).toContain(",78 MAD");
  });

  it("respects zero/three-decimal currencies, negative amounts and exact large integers",()=>{
    expect(formatMinor("100","JPY","fr")).toContain("100");expect(formatMinor("100","JPY","fr")).not.toContain(",00");
    expect(formatMinor("1234","KWD","fr")).toContain("1,234");
    expect(formatMinor("-1550","MAD","fr")).toContain("-15,50");
    expect(formatMinor("9007199254740993123","KWD","fr").replace(/[.\s\u00a0\u202f]/gu,"")).toContain("9007199254740993,123");
  });

  it("refuse un mode de changement inconnu", () => {
    expect(planChangeSchema.safeParse({
      locale: "fr",
      organizationId: crypto.randomUUID(),
      subscriptionId: crypto.randomUUID(),
      targetPlanVersionId: crypto.randomUUID(),
      changeMode: "IMMEDIATE",
      idempotencyKey: crypto.randomUUID(),
    }).success).toBe(false);
  });

  it("compare les prix historiques exacts sans conversion flottante", () => {
    expect(planChangeMode("9007199254740993", "9007199254740994")).toBe("UPGRADE_IMMEDIATE");
  });
});
