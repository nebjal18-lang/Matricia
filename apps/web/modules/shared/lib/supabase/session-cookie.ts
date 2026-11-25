/** Cheap presence check — no Auth network round-trip. */
export function hasSupabaseAuthCookie(cookies: Array<{ name: string }>): boolean {
  return cookies.some((cookie) => {
    const name = cookie.name;
    return name.includes("-auth-token") || (name.startsWith("sb-") && name.includes("auth"));
  });
}
