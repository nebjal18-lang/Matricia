import type { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

type DatabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

const openStatuses = ["OPEN", "CLAIMED", "WAITING_INFORMATION"] as const;

export function openAdminWorkItems(client: DatabaseClient, select: string, limit: number) {
  return client.from("admin_work_items").select(select).in("status", [...openStatuses]).order("severity_rank", { ascending: false }).order("due_at").limit(limit);
}
