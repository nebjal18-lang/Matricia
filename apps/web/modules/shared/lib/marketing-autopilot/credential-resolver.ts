const referencePattern = /^(env|vault):\/\/([A-Z][A-Z0-9_]{2,99})$/;

export type CredentialEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveSocialCredentialReference(reference: string, environment: CredentialEnvironment): string | null {
  const match = reference.match(referencePattern);
  if (!match || !match[2]) return null;
  // vault:// is an opaque alias injected by the deployment KMS/secret manager.
  // This module never queries, returns through HTTP, or logs a decrypted vault value.
  const variable = match[1] === "env" ? match[2] : `MATRICIA_VAULT_${match[2]}`;
  const value = environment[variable];
  return typeof value === "string" && value.length > 0 ? value : null;
}
