export type EmailOtpLength = 6 | 7 | 8;

type OtpLengthEnv = {
  AUTH_EMAIL_OTP_LENGTH?: string;
  VERCEL_ENV?: string;
};

/** Server-owned configuration, aligned with the Auth provider. */
export function configuredEmailOtpLength(
  value = process.env.AUTH_EMAIL_OTP_LENGTH,
  env: OtpLengthEnv = {
    AUTH_EMAIL_OTP_LENGTH: process.env.AUTH_EMAIL_OTP_LENGTH,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
): EmailOtpLength {
  const raw = value ?? env.AUTH_EMAIL_OTP_LENGTH;
  if (raw === undefined || raw.trim() === "") {
    if (env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview") {
      throw new Error("MISSING_AUTH_EMAIL_OTP_LENGTH");
    }
    return 6;
  }
  if (!/^[6-8]$/u.test(raw)) throw new Error("INVALID_AUTH_EMAIL_OTP_LENGTH");
  return Number(raw) as EmailOtpLength;
}
