import { describe, expect, it } from "vitest";
import { configuredEmailOtpLength } from "./otp-config";
describe("server OTP length configuration",()=>{
 it("defaults to six outside Vercel",()=>expect(configuredEmailOtpLength("", {})).toBe(6));
 it.each(["production","preview"] as const)("requires an explicit length on Vercel %s",vercelEnv=>{
  expect(()=>configuredEmailOtpLength("", { VERCEL_ENV: vercelEnv })).toThrow("MISSING_AUTH_EMAIL_OTP_LENGTH");
 });
 it.each(["6","7","8"])("accepts provider configured %s digits",value=>expect(configuredEmailOtpLength(value)).toBe(Number(value)));
 it.each(["5","9","6.0","abc"])("rejects invalid provider configuration %s",value=>expect(()=>configuredEmailOtpLength(value)).toThrow("INVALID_AUTH_EMAIL_OTP_LENGTH"));
});
