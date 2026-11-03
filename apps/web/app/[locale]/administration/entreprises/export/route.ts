import{mapAdminOrgRows,filterAdminOrgRows}from"@/modules/admin/data/spaces/view-model";
import { csvCell } from "@/modules/shared/lib/csv/export";
import { loadMyPlatformAccess, hasPlatformRole } from "@/modules/shared/lib/account-security/platform-access";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

const exportRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "FINANCE_MANAGER", "DISPUTE_MANAGER", "LIBRARY_MANAGER", "READ_ONLY_AUDITOR"] as const;

export async function GET(request: Request, context: { params: Promise<{ locale: string }> }) {
  const { locale } = await context.params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  const access = await loadMyPlatformAccess();
  if (access.status === "error") return new Response(null, { status: access.reason === "UNAUTHENTICATED" ? 401 : 403 });
  if (!hasPlatformRole(access.roles, exportRoles)) return new Response(null, { status: 403 });
  const result = await loadAdminSupervisionDashboard(500,true);
  if (result.status !== "success") return new Response(null, { status: result.reason === "FORBIDDEN" ? 403 : 503 });
  const header = ["id", "display_name", "legal_name", "status", "created_at", "member_count", "open_requests", "open_disputes"];
  const params=new URL(request.url).searchParams;
  const allowed=new Set(filterAdminOrgRows(mapAdminOrgRows(result.value.organizations,locale),{type:params.get("type")??undefined,status:params.get("status")??undefined,compliance:params.get("compliance")??undefined,plan:params.get("plan")??undefined},params.get("q")??undefined,params.get("archives")==="1").map(row=>row.id));
  const lines = result.value.organizations.filter(org=>allowed.has(org.id)).map((org) => [
    org.id,
    org.display_name,
    org.legal_name,
    org.status,
    org.created_at,
    org.member_count,
    org.open_requests,
    org.open_disputes,
  ].map(csvCell).join(","));
  const body = `\uFEFF${[header.join(","), ...lines].join("\n")}\n`;
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=\"organisations.csv\"",
      "cache-control": "no-store",
    },
  });
}
