import { z } from "zod";

const namespaces = {
  "service-impact": 1, "service-submit": 2, "questionnaire-publish": 3,
  "service-duplicate": 4, "service-archive": 5, "questionnaire-clone": 6,
  "subcategory-create": 7, "category-submit": 8, "subcategory-submit": 9,
} as const;
export type CommandUuidNamespace = keyof typeof namespaces;

/** Derive independent command identities from the server's random UUID seed.
 * A fixed namespace mask changes only payload bits, never UUID version/variant.
 * No browser randomness, clock or hydration state affects a retry's identity.
 */
export function namespacedCommandUuid(seed: string, namespace: CommandUuidNamespace): string {
  const parsed = z.string().uuid().parse(seed).toLowerCase();
  const mask = namespaces[namespace];
  if (typeof mask !== "number") throw new Error("INVALID_COMMAND_UUID_NAMESPACE");
  const suffix = ((Number.parseInt(parsed.slice(28), 16) ^ mask) >>> 0).toString(16).padStart(8, "0");
  return z.string().uuid().parse(parsed.slice(0, 28) + suffix);
}
