import { describe, expect, it } from "vitest";
import { configuredEmailOtpLength } from "./otp-config";
describe("server OTP length configuration",()=>{
 it("defaults to six",()=>expect(configuredEmailOtpLength("")).toBe(6));
 it.each(["6","7","8"])("accepts provider configured %s digits",value=>expect(configuredEmailOtpLength(value)).toBe(Number(value)));
 it.each(["5","9","6.0","abc"])("rejects invalid provider configuration %s",value=>expect(()=>configuredEmailOtpLength(value)).toThrow("INVALID_AUTH_EMAIL_OTP_LENGTH"));
});
