export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { configuredEmailOtpLength } = await import("@/modules/shared/lib/auth/otp-config");
  configuredEmailOtpLength();
}
