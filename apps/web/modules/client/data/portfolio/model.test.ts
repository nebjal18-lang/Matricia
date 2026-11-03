import { describe, expect, it } from "vitest";
import {
  budgetConsumption,
  displayCalendarDate,
  exactMoney,
  formatProgressBasisPoints,
  moneyToMinor,
  netAllocatedMinor,
  progressBarPercent,
  type Allocation,
  type CalendarItem,
} from "./model";

describe("client portfolio exact money", () => {
  it.each([
    ["0", "MAD", "0.00 MAD"],
    ["125005", "MAD", "1250.05 MAD"],
    ["100", "JPY", "100 JPY"],
    ["-100", "JPY", "-100 JPY"],
    ["1234", "KWD", "1.234 KWD"],
    ["9007199254740993", "JPY", "9007199254740993 JPY"],
    ["-150", "MAD", "-1.50 MAD"],
    ["900719925474099312345", "MAD", "9007199254740993123.45 MAD"],
  ])("formats %s without floating point", (minor, currency, expected) => expect(exactMoney(minor, currency)).toBe(expected));

  it.each([["1250", "125000"], ["1250,5", "125050"], ["1250.05", "125005"]])("parses %s exactly", (input, expected) => expect(moneyToMinor(input)).toBe(expected));
  it.each([["100","JPY","100"],["1,234","KWD","1234"],["١٫٢٣٤","KWD","1234"],["9007199254740993","JPY","9007199254740993"]])("uses currency exponents for %s %s",(amount,currency,expected)=>expect(moneyToMinor(amount,currency)).toBe(expected));
  it.each(["-1", "1.001", "NaN", "1e3", "", "12,345"])("rejects malformed amount %s", input => expect(moneyToMinor(input)).toBeNull());
});

describe("client portfolio budget consumption", () => {
  const allocations: Allocation[] = [
    { id: "a", organizationId: "o", costCenterId: "c", budgetId: "b", projectId: null, type: "COMMITMENT", amountMinor: "800000", currency: "MAD", createdAt: "2026-01-01" },
    { id: "b", organizationId: "o", costCenterId: "c", budgetId: "b", projectId: null, type: "ACTUAL", amountMinor: "250000", currency: "MAD", createdAt: "2026-02-01" },
    { id: "c", organizationId: "o", costCenterId: "c", budgetId: "b", projectId: null, type: "RELEASE", amountMinor: "50000", currency: "MAD", createdAt: "2026-03-01" },
  ];

  it("nets commitments, actuals and releases in minor units", () => {
    expect(netAllocatedMinor(allocations, "b").toString()).toBe("1000000");
  });

  it("raises a watch alert at 80 percent without floating point", () => {
    expect(budgetConsumption(BigInt("800000"), BigInt("1000000"))).toEqual({ usedBasisPoints: 8000, remainingMinor: "200000", level: "watch" });
    expect(budgetConsumption(BigInt("1000000"), BigInt("1000000")).level).toBe("over");
    expect(budgetConsumption(BigInt("1000001"), BigInt("1000000")).level).toBe("exceeded");
    expect(budgetConsumption(BigInt("0"), BigInt("1000000")).level).toBe("ok");
  });
});

describe("client portfolio progress", () => {
  it("formats basis points as a truncated percent", () => {
    expect(formatProgressBasisPoints(8520, "fr")).toBe("85 %");
    expect(formatProgressBasisPoints(8520, "ar")).toBe("85٪");
    expect(progressBarPercent(8520)).toBe(85);
    expect(progressBarPercent(12000)).toBe(100);
  });
});

describe("client portfolio calendar dates", () => {
  const item: CalendarItem = { organizationId:"00000000-0000-4000-8000-000000000001",projectId:null,itemId:"00000000-0000-4000-8000-000000000002",sourceKind:"DOCUMENT_EXPIRY",eventType:"DOCUMENT",titleFr:"Expiration",titleAr:"انتهاء",startsAt:"2026-12-31T00:00:00Z",endsAt:null,status:"VERIFIED",occursOn:"2026-12-31",allDay:true };
  it("preserves an all-day business date without browser timezone drift", () => expect(displayCalendarDate(item,"fr")).toContain("31 décembre 2026"));
  it("formats timestamps in the Morocco business timezone", () => expect(displayCalendarDate({...item,allDay:false,occursOn:null,startsAt:"2026-12-15T14:30:00Z"},"fr")).toContain("15:30"));
});
