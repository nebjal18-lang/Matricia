import { z } from "zod";

/** URL scope is selected only among the current actor's authorized memberships. */
export function selectProviderMembership<T extends { organization_id: string }>(memberships: readonly T[], requestedOrganizationId?: string): T | undefined {
  const unique = [...new Map(memberships.map((item) => [item.organization_id, item])).values()];
  if (requestedOrganizationId !== undefined) {
    if (!z.string().uuid().safeParse(requestedOrganizationId).success) return undefined;
    return unique.find((item) => item.organization_id === requestedOrganizationId);
  }
  return unique.length === 1 ? unique[0] : undefined;
}

export type ProviderReadState = "unavailable" | "forbidden" | "choose-organization" | "no-organization";

/** A failed membership read is never evidence that the account has no organization. */
export function providerContextReadState(
  context: { selectedOrganizationId: string | null; organizations: readonly unknown[]; readError?: string | null },
  requestedOrganizationId?: string,
): ProviderReadState | null {
  if (context.readError) return "unavailable";
  if (context.selectedOrganizationId) return null;
  if (requestedOrganizationId !== undefined) return "forbidden";
  return context.organizations.length > 1 ? "choose-organization" : "no-organization";
}
