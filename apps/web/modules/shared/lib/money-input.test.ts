import { describe, expect, it } from "vitest";
import { currencyFractionDigits, formatMoneyInput, parseMoneyInput } from "./money-input";
describe("exact localized monetary input", () => {
 it("parses French and Arabic entry without floating point", () => {
  expect(parseMoneyInput("15,50", "MAD")).toBe("1550");
  expect(parseMoneyInput("١٥٫٥٠", "MAD")).toBe("1550");
  expect(parseMoneyInput("۱۵٫۵۰", "MAD")).toBe("1550");
  expect(parseMoneyInput("-0,01", "MAD")).toBe("-1");
  expect(parseMoneyInput("900719925474099312345,67", "MAD")).toBe("90071992547409931234567");
 });
 it("uses the currency exponent instead of assuming two decimal places", () => {
  expect(currencyFractionDigits("JPY")).toBe(0);
  expect(parseMoneyInput("15", "JPY")).toBe("15");
  expect(parseMoneyInput("15.5", "JPY")).toBeNull();
  expect(parseMoneyInput("15.123", "KWD")).toBe("15123");
  expect(formatMoneyInput("15123", "KWD")).toBe("15.123");
 });
 it("rejects ambiguous grouping, overprecision and malformed values", () => {
  for (const value of ["", "1,234", "1.234,56", "1 234,56", "1٬234٫56", "1e3", "NaN", "12-3"]) expect(parseMoneyInput(value, "MAD")).toBeNull();
  expect(parseMoneyInput("15", "not-a-currency")).toBeNull();
 });
 it("round-trips exact signed values and canonicalizes zero", () => {
  for (const minor of ["0", "1", "-1", "1550", "90071992547409931234567"]) expect(parseMoneyInput(formatMoneyInput(minor, "MAD"), "MAD")).toBe(minor);
  expect(formatMoneyInput("-1", "MAD")).toBe("-0.01");
  expect(parseMoneyInput("-0,00", "MAD")).toBe("0");
 });
});
