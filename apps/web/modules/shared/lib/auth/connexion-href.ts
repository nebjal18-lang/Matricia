import { safeReturnPath } from "./return-path";

/** Build /connexion URLs while preserving return path and registration intent. */

export function connexionHref(
  locale: string,
  options?: {
    next?: string | null;
    mode?: "inscription" | null;
    role?: "client" | "fournisseur" | null;
    plan?: string | null;
  },
): string {
  const params = new URLSearchParams();
  const next = safeReturnPath(options?.next, locale);
  if (next) {
    params.set("next", next);
  }
  if (options?.mode === "inscription") params.set("mode", "inscription");
  if (options?.role === "client" || options?.role === "fournisseur") params.set("role", options.role);
  if (options?.plan) params.set("plan", options.plan);
  const query = params.toString();
  return query ? `/${locale}/connexion?${query}` : `/${locale}/connexion`;
}
