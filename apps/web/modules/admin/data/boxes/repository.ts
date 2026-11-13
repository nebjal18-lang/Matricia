import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { adminBoxesDashboardSchema, type AdminBoxesDashboard, type AdminBoxesErrorReason, type AdminBoxesResult } from "./model";

const readRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER", "READ_ONLY_AUDITOR"] as const;
const writeRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER"] as const;

function mapError(code?: string): AdminBoxesErrorReason {
  if (code === "42501") return "FORBIDDEN";
  if (code === "22023" || code === "P0002") return "INVALID_INPUT";
  if (["22000", "23505", "23514", "40001", "55000"].includes(code ?? "")) return "CONFLICT";
  return "UNAVAILABLE";
}

async function authorizedBoxesClient(roles: readonly string[]) {
  const access = await loadMyPlatformAccess();
  if (access.status === "error") {
    return { status: "error" as const, reason: (access.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : access.reason === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : "UNAVAILABLE") as AdminBoxesErrorReason };
  }
  if (!hasPlatformRole(access.roles, roles)) return { status: "error" as const, reason: "FORBIDDEN" as const };
  if (!access.requirementSatisfied) return { status: "error" as const, reason: "MFA_REQUIRED" as const };
  return { status: "success" as const, client: access.client };
}

export async function loadAdminBoxesDashboard(): Promise<AdminBoxesResult<AdminBoxesDashboard>> {
  const access = await authorizedBoxesClient(readRoles);
  if (access.status === "error") return access;
  const response = await access.client.rpc("list_admin_boxes_dashboard", { p_limit: 100 });
  if (response.error) return { status: "error", reason: mapError(response.error.code) };
  const parsed = adminBoxesDashboardSchema.safeParse(response.data);
  return parsed.success ? { status: "success", value: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
}

export async function callBoxesCommand(name: string, args: Record<string, unknown>): Promise<AdminBoxesResult<{ outcome: string }>> {
  const access = await authorizedBoxesClient(writeRoles);
  if (access.status === "error") return access;
  const response = await access.client.rpc(name, args);
  if (response.error) return { status: "error", reason: mapError(response.error.code) };
  const outcome = response.data && typeof response.data === "object" && "outcome" in response.data ? String((response.data as { outcome: unknown }).outcome) : "";
  return outcome.length >= 3 ? { status: "success", value: { outcome } } : { status: "error", reason: "INVALID_RESPONSE" };
}
