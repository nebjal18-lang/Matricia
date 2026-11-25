import { describe, expect, it } from "vitest";
import { applyMarginBps, sumWholesaleCosts } from "./margin";

describe("wholesale margin", () => {
  it("ajoute 15 % en basis points sans float", () => {
    // 25 000,00 MAD = 2_500_000 centimes
    const cost = BigInt("2500000");
    expect(applyMarginBps(cost, 1500).toString()).toBe("2875000");
  });

  it("agrège plusieurs lignes de gros", () => {
    expect(sumWholesaleCosts(["2500000", "1000000", "50000"]).toString()).toBe("3550000");
  });
});
