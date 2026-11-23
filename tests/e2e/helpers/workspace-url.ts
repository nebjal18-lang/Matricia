/** Select the generated tenant explicitly for actors with more than one mandate. */
export function workspaceUrl(locale: string, route: string, role?: "provider"): string {
  const url = new URL(`/${locale}/${route}`, process.env.E2E_BASE_URL ?? "http://localhost:5173");
  if (role === "provider" || route.startsWith("sous-traitant/") || route.startsWith("franchise/")) {
    const organizationId = process.env.E2E_ROLE_ORGANIZATION_ID;
    if (!organizationId) throw new Error("E2E_ROLE_ORGANIZATION_ID_REQUIRED");
    url.searchParams.set("organizationId", organizationId);
  }
  if (route.startsWith("franchise/")) {
    const franchiseId = process.env.E2E_FRANCHISE_ID;
    if (!franchiseId) throw new Error("E2E_FRANCHISE_ID_REQUIRED");
    url.searchParams.set("franchiseId", franchiseId);
  }
  return url.toString();
}
