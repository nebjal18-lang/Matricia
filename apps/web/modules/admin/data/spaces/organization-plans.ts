import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const planRow = z.object({
  organization_id: z.string().uuid(),
  status: z.string(),
  subscription_plan_versions: z
    .object({
      subscription_plans: z.object({ code: z.string().min(1) }).nullable().optional(),
    })
    .nullable()
    .optional(),
});

/** Best-effort plan codes for admin directory filters — never invents PREMIUM/GOLD/etc. */
export async function loadOrganizationPlanCodes(organizationIds: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(organizationIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (!unique.length) return out;
  try {
    const client = await getSupabaseServerClient();
    const response = await client
      .from("subscriptions")
      .select("organization_id,status,subscription_plan_versions(subscription_plans(code))")
      .in("organization_id", unique)
      .in("status", ["ACTIVE", "TRIAL_ACTIVE", "PAST_DUE"]);
    if (response.error || !response.data) return out;
    for (const raw of response.data) {
      const parsed = planRow.safeParse(raw);
      if (!parsed.success) continue;
      const code = parsed.data.subscription_plan_versions?.subscription_plans?.code?.trim().toUpperCase();
      if (code) {
        out.set(parsed.data.organization_id, code);
        continue;
      }
      if (parsed.data.status === "TRIAL_ACTIVE" && !out.has(parsed.data.organization_id)) {
        out.set(parsed.data.organization_id, "TRIAL");
      }
    }
  } catch {
    return out;
  }
  return out;
}
