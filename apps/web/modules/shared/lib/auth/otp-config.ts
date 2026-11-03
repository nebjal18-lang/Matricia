export type EmailOtpLength = 6 | 7 | 8;
/** Server-owned configuration, aligned with the Auth provider. */
export function configuredEmailOtpLength(value = process.env.AUTH_EMAIL_OTP_LENGTH): EmailOtpLength {
  if (value === undefined || value.trim() === "") return 6;
  if (!/^[6-8]$/u.test(value)) throw new Error("INVALID_AUTH_EMAIL_OTP_LENGTH");
  return Number(value) as EmailOtpLength;
}
