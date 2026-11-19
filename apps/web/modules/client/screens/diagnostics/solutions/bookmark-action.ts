"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type BookmarkState = { status: "idle" | "success" | "error" };

export async function saveBookmark(_: BookmarkState, form: FormData): Promise<BookmarkState> {
  const p = z.object({ locale: z.enum(["fr", "ar"]), id: z.string().uuid(), saved: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { status: "error" };
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error" };
  const solution = await client.from("diagnostic_solution_sets").select("organization_id").eq("id", p.data.id).maybeSingle();
  const orgId = z.object({ organization_id: z.string().uuid() }).safeParse(solution.data);
  if (solution.error || !orgId.success) return { status: "error" };
  const membership = await client
    .from("organization_memberships")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("organization_id", orgId.data.organization_id)
    .eq("status", "ACTIVE")
    .limit(1)
    .maybeSingle();
  if (membership.error || !membership.data) return { status: "error" };
  const r = await client.rpc("set_client_solution_bookmark", { p_solution_set_id: p.data.id, p_saved: p.data.saved === "true" });
  if (r.error) return { status: "error" };
  revalidatePath(`/${p.data.locale}/client/diagnostics/solutions`);
  return { status: "success" };
}
