/** Preserve transport failures as technical errors; only a known invalid session asks for login. */
export function classifyAuthReadFailure(error: { name?: string; status?: number } | null | undefined): "UNAUTHENTICATED" | "UNAVAILABLE" | null {
  if (!error) return null;
  return error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 ? "UNAUTHENTICATED" : "UNAVAILABLE";
}
