import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { z } from "zod";
import { commandCenterReadSchemas } from "./read-schemas";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { AdminCommandCenter } from "./model";

const security = z.object({
  requirement_satisfied: z.boolean(),
  matched_role_codes: z.array(z.string()),
}).passthrough();
const commandRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "FINANCE_MANAGER", "DISPUTE_MANAGER", "LIBRARY_MANAGER", "SUPPORT_AGENT", "READ_ONLY_AUDITOR"] as const;
export type AdminLoadResult = { status: "success"; dashboard: AdminCommandCenter } | { status: "error"; reason: "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "QUERY_FAILED" | "INVALID_RESPONSE" };

export async function loadAdminCommandCenter(page=1,status="ALL"): Promise<AdminLoadResult> {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure) return { status: "error", reason: authFailure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "QUERY_FAILED" };
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const securityResult = await client.rpc("get_my_account_security_requirement");
  if (securityResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const requirements = z.array(security).safeParse(securityResult.data);
  if (!requirements.success || requirements.data.length !== 1) return { status: "error", reason: "INVALID_RESPONSE" };
  const roles = new Set(requirements.data[0]!.matched_role_codes.filter((role) => commandRoles.includes(role as (typeof commandRoles)[number])));
  if (roles.size === 0) return { status: "error", reason: "FORBIDDEN" };
  if (!requirements.data[0]!.requirement_satisfied) return { status: "error", reason: "MFA_REQUIRED" };
  const readOnly = roles.has("READ_ONLY_AUDITOR") && ![...roles].some((item) => item !== "READ_ONLY_AUDITOR");
  const central = roles.has("SUPER_ADMIN") || roles.has("MATRICIA_ADMIN");
  const canRequest = !readOnly && [...roles].some((item) => ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "FINANCE_MANAGER", "DISPUTE_MANAGER", "LIBRARY_MANAGER", "SUPPORT_AGENT"].includes(item));
  const decisionRole = !readOnly && [...roles].some((item) => ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "FINANCE_MANAGER", "DISPUTE_MANAGER", "LIBRARY_MANAGER"].includes(item));
  let actionPage=Number.isFinite(page)?Math.min(100000,Math.max(1,Math.floor(page))):1;
  const actionStatus=["PENDING_APPROVAL","AUTHORIZED","REQUEST_TRACKED","EXECUTED","FAILED","REJECTED","CANCELLED"].includes(status)?status:"ALL";
  const readActions = (pageNumber: number) => {
    let actionsQuery = client.from("admin_operational_action_requests").select("id,work_item_id,organization_id,action_type,target_environment,resource_type,resource_id,reason,approvals_required,status,requested_by,requested_at,row_version,executed_at,execution_result_hash", { count: "exact" });
    if (actionStatus !== "ALL") actionsQuery = actionsQuery.eq("status", actionStatus);
    return actionsQuery.order("requested_at", { ascending: false }).order("id").range((pageNumber - 1) * 100, pageNumber * 100 - 1);
  };
  const [workQuery, requestedActions] = await Promise.all([
    client.from("admin_work_items").select("id,queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,status,due_at,assigned_to,row_version").in("status", ["OPEN", "CLAIMED", "WAITING_INFORMATION"]).order("severity_rank", { ascending: false }).order("due_at").limit(100),
    readActions(actionPage),
  ]);
  let actionQuery = requestedActions;
  // PostgREST returns 416/PGRST103 when deletions, decisions or a shared URL
  // leave a page beyond the current filtered result. Recover the first page
  // under the same RLS and filter; never hide other read failures as empty data.
  if (actionPage > 1 && actionQuery.error?.code === "PGRST103") {
    actionPage = 1;
    actionQuery = await readActions(actionPage);
  }
  if (workQuery.error || actionQuery.error) return { status: "error", reason: "QUERY_FAILED" };
  const workRows = commandCenterReadSchemas.workItems.safeParse(workQuery.data);
  const actionRows = commandCenterReadSchemas.actions.safeParse(actionQuery.data);
  if (!workRows.success || !actionRows.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const queueIds = [...new Set(workRows.data.map((item) => item.queue_version_id))];
  const queueQuery = queueIds.length
    ? await client.from("admin_queue_versions").select("id,queue_key,label_fr,label_ar").in("id", queueIds).limit(100)
    : { data: [], error: null };
  if (queueQuery.error) return { status: "error", reason: "QUERY_FAILED" };
  const queueRows = commandCenterReadSchemas.queues.safeParse(queueQuery.data);
  if (!queueRows.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const queues = new Map(queueRows.data.map((item) => [item.id, item]));
  return {
    status: "success",
    dashboard: {
      actionPage,actionStatus,hasMoreActions:typeof actionQuery.count==="number"?actionQuery.count>actionPage*100:actionRows.data.length===100,
      capabilities: { requestAction: canRequest },
      workItems: workRows.data.flatMap((item) => {
        const version = queues.get(item.queue_version_id);
        if (!version) return [];
        return [{
          id: item.id,
          queueKey: version.queue_key,
          queueLabelFr: version.label_fr,
          queueLabelAr: version.label_ar,
          organizationId: item.organization_id,
          sourceKind: item.source_kind,
          resourceType: item.resource_type,
          resourceId: item.resource_id,
          titleFr: item.title_fr,
          titleAr: item.title_ar,
          priority: item.priority,
          status: item.status,
          dueAt: item.due_at,
          assignedTo: item.assigned_to,
          rowVersion: item.row_version,
          canClaim: !readOnly && item.status === "OPEN",
          canResolve: !readOnly && ["CLAIMED", "WAITING_INFORMATION"].includes(item.status) && (item.assigned_to === auth.user.id || central),
        }];
      }),
      actions: actionRows.data.map((item) => ({
        id: item.id,
        workItemId: item.work_item_id,
        organizationId: item.organization_id,
        actionType: item.action_type,
        targetEnvironment: item.target_environment,
        resourceType: item.resource_type,
        resourceId: item.resource_id,
        reason: item.reason,
        approvalsRequired: item.approvals_required,
        status: item.status,
        requestedBy: item.requested_by,
        requestedAt: item.requested_at,
        rowVersion: item.row_version,
        canDecide: item.status==="PENDING_APPROVAL" && decisionRole && item.requested_by !== auth.user.id,
        resultHash:item.execution_result_hash??null,executedAt:item.executed_at??null,
      })),
    },
  };
}
