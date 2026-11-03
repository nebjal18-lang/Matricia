import { describe, expect, it } from "vitest";
import { applyOtpDigits, normalizeEmail, normalizeOtp } from "./otp";
import { getDictionary } from "../i18n/dictionaries";

describe("OTP identity primitives", () => {
  it("normalizes a valid email without accepting malformed input", () => {
    expect(normalizeEmail("  User@Entreprise.MA ")).toBe("user@entreprise.ma");
    expect(normalizeEmail("missing-domain@" )).toBeNull();
  });

  it("accepts exactly the configured provider length and defaults to six", () => {
    expect(normalizeOtp("12345678")).toBeNull();
    expect(normalizeOtp("12345678",8)).toBe("12345678");
    expect(normalizeOtp("123456",8)).toBeNull();
    expect(normalizeOtp("1234567",7)).toBe("1234567");
    expect(normalizeOtp("123456")).toBe("123456");
    expect(normalizeOtp("1234567")).toBeNull();
    expect(normalizeOtp("12345x")).toBeNull();
  });

  it("writes one digit or a pasted code without dropping the tail", () => {
    expect(applyOtpDigits("12", 2, "9")).toBe("129");
    expect(applyOtpDigits("", 0, "123456789")).toBe("123456");
    expect(applyOtpDigits("123456", 2, "")).toBe("12456");
  });

  it("keeps French and Arabic authentication keys aligned", () => {
    expect(Object.keys(getDictionary("ar").auth).sort()).toEqual(Object.keys(getDictionary("fr").auth).sort());
    expect(Object.keys(getDictionary("ar").dashboard).sort()).toEqual(Object.keys(getDictionary("fr").dashboard).sort());
  });
});
