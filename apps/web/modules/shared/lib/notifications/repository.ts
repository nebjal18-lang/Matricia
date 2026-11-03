import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { categoryRows, centerPayload, type NotificationDashboard } from "./model";

const member = z.object({ organization_id: z.string().uuid(), organizations: z.object({ display_name: z.string().min(1) }) });
type Result = { status: "success"; dashboard: NotificationDashboard } | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "NO_ORGANIZATION" | "QUERY_FAILED" | "INVALID_RESPONSE" };

export async function loadNotificationCenter(locale: "fr" | "ar", organizationId?: string): Promise<Result> {
  try {
    const client = await getSupabaseServerClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError) return { status: "error", reason: authError.status === 401 || authError.status === 403 || authError.name === "AuthSessionMissingError" ? "UNAUTHENTICATED" : "QUERY_FAILED" };
    if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
    if (organizationId && !z.string().uuid().safeParse(organizationId).success) return { status: "error", reason: "FORBIDDEN" };
    let membership = client.from("organization_memberships").select("organization_id,organizations!inner(display_name)").eq("user_id", auth.user.id).eq("status", "ACTIVE");
    if (organizationId) membership = membership.eq("organization_id", organizationId);
    const result = await membership.order("organization_id").limit(1).maybeSingle();
    if (result.error) return { status: "error", reason: "QUERY_FAILED" };
    const parsedMember = member.safeParse(result.data);
    if (!parsedMember.success) return { status: "error", reason: result.data ? "INVALID_RESPONSE" : organizationId ? "FORBIDDEN" : "NO_ORGANIZATION" };
    const selected = parsedMember.data;
    const [center, categories] = await Promise.all([
      client.rpc("list_notification_center", { p_organization_id: selected.organization_id, p_limit: 100 }),
      client.from("notification_preference_categories").select("code,label_fr,label_ar,mandatory").eq("status", "ACTIVE").order("code"),
    ]);
    if (center.error || categories.error) return { status: "error", reason: "QUERY_FAILED" };
    const payload = centerPayload.safeParse(center.data);
    const parsedCategories = categoryRows.safeParse(categories.data);
    if (!payload.success || !parsedCategories.success) return { status: "error", reason: "INVALID_RESPONSE" };
    return { status: "success", dashboard: {
      organizationId: selected.organization_id,
      organizationName: selected.organizations.display_name,
      canViewDeliveryOperations: false,
      categories: parsedCategories.data.map(row => ({ code: row.code, label: locale === "ar" ? row.label_ar : row.label_fr, mandatory: row.mandatory })),
      preferences: payload.data.preferences,
      notifications: payload.data.notifications.map(notification => ({ ...notification, deliveries: [] })),
      // The technical catalog belongs to the authorized Administration screens.
      templates: [],
    } };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", reason: "QUERY_FAILED" };
  }
}
