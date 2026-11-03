/** Public legal data supplied and approved by the contracting entity. Never infer identity from a brand name. */
export const legalPublicationFields = ["LEGAL_ENTITY_NAME", "LEGAL_ENTITY_FORM", "LEGAL_ENTITY_ADDRESS", "LEGAL_REGISTRATION_ID", "LEGAL_PUBLICATION_DIRECTOR", "LEGAL_HOST_NAME", "LEGAL_HOST_ADDRESS", "LEGAL_PRIVACY_EMAIL", "LEGAL_RETENTION_FR", "LEGAL_RETENTION_AR", "LEGAL_TERMS_APPROVAL_REFERENCE"] as const;
export function legalPublication(env: Record<string, string | undefined> = process.env) {
  const values = Object.fromEntries(legalPublicationFields.map(key => [key, env[key]?.trim() || null])) as Record<typeof legalPublicationFields[number], string | null>;
  return { values, missing: legalPublicationFields.filter(key => !values[key]), ready: legalPublicationFields.every(key => Boolean(values[key])) };
}
