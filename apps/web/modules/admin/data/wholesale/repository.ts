import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { buildDemoWholesaleCatalog, isDemoWholesaleEnabled } from "./demo-network";
import { wholesaleCatalogSchema, type WholesaleCatalog, type WholesaleResult } from "./model";

const readRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER", "READ_ONLY_AUDITOR"] as const;

/**
 * Mode démo ON : catalogue déterministe propre (ignore le volume DB résiduel).
 * Mode démo OFF : RPC réelle des engagements volume.
 */
export async function loadAdminWholesaleCatalog(input: {
  territoryCode: string;
  subject?: string | null;
}): Promise<WholesaleResult<WholesaleCatalog>> {
  const access = await loadMyPlatformAccess();
  if (access.status === "error") {
    return {
      status: "error",
      reason:
        access.reason === "UNAUTHENTICATED"
          ? "UNAUTHENTICATED"
          : access.reason === "INVALID_RESPONSE"
            ? "INVALID_RESPONSE"
            : "UNAVAILABLE",
    };
  }
  if (!hasPlatformRole(access.roles, readRoles)) return { status: "error", reason: "FORBIDDEN" };
  if (!access.requirementSatisfied) return { status: "error", reason: "MFA_REQUIRED" };

  const territory = input.territoryCode.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{0,63}$/u.test(territory)) return { status: "error", reason: "INVALID_INPUT" };

  if (isDemoWholesaleEnabled()) {
    const demo = buildDemoWholesaleCatalog({
      territoryCode: territory,
      subject: input.subject,
      generatedAt: new Date().toISOString(),
    });
    const parsed = wholesaleCatalogSchema.safeParse(demo);
    return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
  }

  const response = await access.client.rpc("list_admin_wholesale_offers_by_territory_v1", {
    p_territory_code: territory,
    p_subject: input.subject?.trim() ? input.subject.trim() : null,
  });
  if (response.error) {
    if (response.error.code === "42501") return { status: "error", reason: "FORBIDDEN" };
    if (response.error.code === "22023") return { status: "error", reason: "INVALID_INPUT" };
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const parsed = wholesaleCatalogSchema.safeParse(response.data);
  return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
}
