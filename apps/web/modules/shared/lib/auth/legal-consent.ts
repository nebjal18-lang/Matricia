export const TERMS_VERSION = "2026-10-31";
export const PRIVACY_VERSION = "2026-10-31";
export const legalConsent = { accepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION } as const;
export function isCurrentLegalConsent(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const consent = value as Record<string, unknown>;
  return consent.accepted === true && consent.termsVersion === TERMS_VERSION && consent.privacyVersion === PRIVACY_VERSION;
}
