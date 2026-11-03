import { openAdminWorkItems } from "@/modules/shared/lib/admin-work-items/open-items";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { inboxPayload } from "../internal-messaging/model";
import { centerPayload } from "../notifications/model";
import { orderUserActions, type UserActionCenter, type UserActionItem } from "./model";

const uuid = z.string().uuid();
const memberships = z.array(z.object({ organization_id: uuid, organizations: z.object({ display_name: z.string().min(1) }) }));
const workItems = z.array(z.object({ id: uuid, source_kind: z.string(), title_fr: z.string(), title_ar: z.string(), priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]), due_at: z.string(), resource_type: z.string(), resource_id: z.string() }));
const approvals = z.array(z.object({ id: uuid, action_type: z.string(), reason: z.string(), requested_at: z.string(), target_environment: z.string() }));

export type ActionCenterLoadResult = { status: "success"; value: UserActionCenter } | { status: "error"; reason: "UNAUTHENTICATED" | "QUERY_FAILED" | "INVALID_RESPONSE" };

const ACTION_CENTER_BUDGET_MS = 2500;

function kind(source: string): UserActionItem["kind"] {
  if (source === "RISK_FLAG") return "RISK_REVIEW";
  if (source === "EXCEPTION") return "EXCEPTION";
  if (source === "APPROVAL") return "APPROVAL";
  return "WORK_ITEM";
}

async function withBudget<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ACTION_CENTER_BUDGET_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function loadUserActionCenterWithinBudget(
  locale: "fr" | "ar",
  now = new Date().toISOString(),
  organizationId?: string | null,
): Promise<ActionCenterLoadResult> {
  return withBudget(
    loadUserActionCenter(locale, now, organizationId).catch(() => ({ status: "error", reason: "QUERY_FAILED" }) satisfies ActionCenterLoadResult),
    { status: "error", reason: "QUERY_FAILED" },
  );
}

export async function loadUserActionCenter(locale: "fr" | "ar", now = new Date().toISOString(), organizationId?: string | null): Promise<ActionCenterLoadResult> {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return { status: "error", reason: "UNAUTHENTICATED" };

  let memberRows: z.infer<typeof memberships> = [];
  if (organizationId !== null) {
    let membershipQuery = client.from("organization_memberships").select("organization_id,organizations!inner(display_name)").eq("user_id", auth.user.id).eq("status", "ACTIVE");
    if (organizationId) membershipQuery = membershipQuery.eq("organization_id", organizationId);
    const membershipsResult = await membershipQuery.limit(organizationId ? 1 : 25);
    if (membershipsResult.error) return { status: "error", reason: "QUERY_FAILED" };
    const parsedMembers = memberships.safeParse(membershipsResult.data);
    if (!parsedMembers.success) return { status: "error", reason: "INVALID_RESPONSE" };
    memberRows = parsedMembers.data;
  }

  const [notificationResults, inboxResult, workResult, approvalResult] = await Promise.all([
    Promise.all(memberRows.map((member) => client.rpc("list_notification_center", { p_organization_id: member.organization_id, p_limit: 40 }))),
    client.rpc("list_internal_message_inbox", { p_limit: 40 }),
    openAdminWorkItems(client, "id,source_kind,title_fr,title_ar,priority,due_at,resource_type,resource_id", 40),
    client.from("admin_operational_action_requests").select("id,action_type,reason,requested_at,target_environment").eq("status", "PENDING_APPROVAL").order("requested_at").limit(40),
  ]);

  if (notificationResults.some((result) => result.error)) return { status: "error", reason: "QUERY_FAILED" };
  const centers = notificationResults.map((result) => centerPayload.safeParse(result.data));
  if (centers.some((result) => !result.success)) return { status: "error", reason: "INVALID_RESPONSE" };
  if (inboxResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const inbox = inboxPayload.safeParse(inboxResult.data);
  if (!inbox.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const degradedSources: UserActionCenter["degradedSources"] = [];
  const unexpectedAdminError = [workResult.error, approvalResult.error].some((error) => error && error.code !== "42501");
  if (unexpectedAdminError) degradedSources.push("ADMIN");
  const parsedWork = workResult.error ? workItems.safeParse([]) : workItems.safeParse(workResult.data);
  const parsedApprovals = approvalResult.error ? approvals.safeParse([]) : approvals.safeParse(approvalResult.data);
  if (!parsedWork.success || !parsedApprovals.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const items: UserActionItem[] = [];
  centers.forEach((parsed, index) => {
    if (!parsed.success) return;
    const member = memberRows[index]!;
    parsed.data.notifications.filter((notification) => notification.read_at === null).forEach((notification) => items.push({
      id: `notification:${notification.id}`, kind: "NOTIFICATION", title: notification.subject, detail: notification.body, organizationName: member.organizations.display_name, organizationId: member.organization_id,
      priority: notification.priority === "IMPORTANT" ? "HIGH" : notification.priority === "NORMAL" ? "MEDIUM" : notification.priority === "INFO" ? "LOW" : "CRITICAL",
      mandatory: notification.mandatory, href: notification.cta_path ?? `/${locale}/notifications`, occurredAt: notification.created_at, dueAt: null, requiresHumanReview: false,
    }));
  });
  inbox.data.filter((thread) => thread.status === "OPEN").forEach((thread) => items.push({ id: `message:${thread.id}`, kind: "MESSAGE", title: thread.subject, detail: `${thread.counterparty_alias} · ${thread.message_count}`, organizationName: null, organizationId: thread.participant_organization_id, priority: "MEDIUM", mandatory: false, href: `/${locale}/messagerie?fil=${thread.id}`, occurredAt: thread.last_message_at, dueAt: null, requiresHumanReview: false }));
  parsedWork.data.forEach((item) => items.push({ id: `work:${item.id}`, kind: kind(item.source_kind), title: locale === "ar" ? item.title_ar : item.title_fr, detail: `${item.resource_type}/${item.resource_id}`, organizationName: null, organizationId: null, priority: item.priority, mandatory: item.source_kind === "RISK_FLAG" || item.source_kind === "EXCEPTION", href: `/${locale}/administration/command-center`, occurredAt: item.due_at, dueAt: item.due_at, requiresHumanReview: item.source_kind === "RISK_FLAG" || item.source_kind === "EXCEPTION" }));
  parsedApprovals.data.forEach((item) => items.push({ id: `approval:${item.id}`, kind: "APPROVAL", title: item.action_type, detail: `${item.target_environment} · ${item.reason}`, organizationName: null, organizationId: null, priority: item.target_environment === "PRODUCTION" ? "CRITICAL" : "HIGH", mandatory: true, href: `/${locale}/administration/command-center`, occurredAt: item.requested_at, dueAt: null, requiresHumanReview: true }));
  return { status: "success", value: { items: orderUserActions(items, now), degradedSources } };
}
