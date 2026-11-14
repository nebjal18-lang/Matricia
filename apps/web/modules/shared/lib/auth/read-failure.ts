/** Preserve transport failures as technical errors; only a missing/invalid session asks for login. */
export function classifyAuthReadFailure(error: { name?: string; status?: number } | null | undefined): "UNAUTHENTICATED" | "UNAVAILABLE" | null {
  if (!error) return null;
  if (error.name === "AuthSessionMissingError" || error.status === 401) return "UNAUTHENTICATED";
  // 403 is an authorization denial for an established session — never treat as "please log in".
  if (error.status === 403) return "UNAVAILABLE";
  return "UNAVAILABLE";
}
