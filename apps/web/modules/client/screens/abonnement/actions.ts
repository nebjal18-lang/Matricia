"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { planChangeSchema, subscriptionCommandSchema } from "@/modules/shared/lib/subscriptions/model";

export type SubscriptionActionState = { status: "idle" } | { status: "success" } | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "CHECKOUT_REQUIRED" | "FUNDING_REQUIRED" | "FAILED" };
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function failure(error: { code?: string; message?: string } | null): SubscriptionActionState { if (error?.message?.includes("SUBSCRIPTION_CURRENT_FUNDING_REQUIRED")) return { status:"error", reason:"FUNDING_REQUIRED" }; if (error?.message?.includes("SUBSCRIPTION_UPGRADE_CHECKOUT_REQUIRED")) return { status:"error", reason:"CHECKOUT_REQUIRED" }; if (error?.code === "42501") return { status:"error", reason:"FORBIDDEN" }; if (["23505","23514","40001","55000"].includes(error?.code??"")||error?.message?.includes("IDEMPOTENCY")) return { status:"error", reason:"CONFLICT" }; return { status:"error", reason:"FAILED" }; }

export async function ensureTrialAction(_: SubscriptionActionState, form: FormData): Promise<SubscriptionActionState> {
  const parsed = subscriptionCommandSchema.safeParse({
    locale: value(form, "locale"),
    organizationId: value(form, "organizationId"),
    idempotencyKey: value(form, "idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason:"VALIDATION" };
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status:"error", reason:"UNAUTHENTICATED" };
  const { error } = await client.rpc("ensure_trial_subscription", {
    p_organization_id: parsed.data.organizationId,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failure(error);
  revalidatePath(`/${parsed.data.locale}/client/abonnement`);
  return { status: "success" };
}

export async function changePlanAction(_: SubscriptionActionState, form: FormData): Promise<SubscriptionActionState> {
  const parsed = planChangeSchema.safeParse({
    locale: value(form, "locale"),
    organizationId: value(form, "organizationId"),
    subscriptionId: value(form, "subscriptionId"),
    targetPlanVersionId: value(form, "targetPlanVersionId"),
    changeMode: value(form, "changeMode"),
    idempotencyKey: value(form, "idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", reason:"VALIDATION" };
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status:"error", reason:"UNAUTHENTICATED" };
  const { error } = await client.rpc("change_subscription_plan", {
    p_subscription_id: parsed.data.subscriptionId,
    p_target_plan_version_id: parsed.data.targetPlanVersionId,
    p_change_mode: parsed.data.changeMode,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return failure(error);
  revalidatePath(`/${parsed.data.locale}/client/abonnement`);
  return { status: "success" };
}
