import { redirect } from "next/navigation";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { PLATFORM_ADMIN_ROLES } from "@/modules/shared/lib/connected-space/workspace-landing";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export async function resolveAdminSpace(input: { locale: Locale; organizationId?: string; returnPath?: string }) {
  const access = await loadMyPlatformAccess();
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") return { status: "unauthenticated" as const };
  if (access.status === "error") throw new Error("ADMIN_ACCESS_UNAVAILABLE");
  // The administration shell is never served to a non-administrator: send them
  // back to the dashboard, which routes each account to its own space.
  if (!PLATFORM_ADMIN_ROLES.some((role) => access.roles.has(role))) {
    redirect(`/${input.locale}/tableau-de-bord`);
  }
  if (!access.requirementSatisfied) {
    const target = safeReturnPath(input.returnPath, input.locale) ?? `/${input.locale}/administration/command-center${input.organizationId ? `?organizationId=${encodeURIComponent(input.organizationId)}` : ""}`;
    const query = new URLSearchParams({ next: target, workspace: "administration" });
    // The active organization is retained for the destination, without requiring a membership merely to secure a platform administrator's own account.
    redirect(`/${input.locale}/securite/compte?${query}`);
  }
  const selectedOrganizationId = input.organizationId ?? null;
  const selectedQuery = selectedOrganizationId ? `?organizationId=${encodeURIComponent(selectedOrganizationId)}` : "";
  return {
    status: "success" as const,
    locale: input.locale,
    userEmail: access.email,
    selectedOrganizationId,
    selectedQuery,
  };
}
