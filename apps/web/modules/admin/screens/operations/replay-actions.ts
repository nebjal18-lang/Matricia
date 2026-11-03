"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
export type ReplayState = { status: "idle" | "success" | "error" };
const localeSchema = z.enum(["fr", "ar"]);
async function act(form: FormData, approve: boolean): Promise<ReplayState> {
  const access = await loadMyPlatformAccess();
  if (access.status !== "ok" || !access.requirementSatisfied || !hasPlatformRole(access.roles, ["SUPER_ADMIN", "MATRICIA_ADMIN"])) return { status: "error" };
  const locale = localeSchema.safeParse(form.get("locale"));
  if (!locale.success) return { status: "error" };
  const input = approve ? z.object({ requestId: z.string().uuid() }).safeParse({ requestId: form.get("requestId") })
    : z.object({ eventId: z.string().regex(/^[1-9]\d*$/), reason: z.string().trim().min(10).max(1000), idempotencyKey: z.string().uuid() }).safeParse(Object.fromEntries(form));
  if (!input.success) return { status: "error" };
  const data = input.data;
  const result = "requestId" in data
    ? await access.client.rpc("approve_operational_replay_v1", { p_request_id: data.requestId })
    : await access.client.rpc("request_operational_replay_v1", { p_event_id: data.eventId, p_reason: data.reason, p_idempotency_key: data.idempotencyKey });
  if (result.error || ("requestId" in data ? !z.object({ outcome: z.literal("REPLAY_SCHEDULED"), event_id: z.string() }).safeParse(result.data).success : !z.string().uuid().safeParse(result.data).success)) return { status: "error" };
  revalidatePath(`/${locale.data}/administration/operations`);
  return { status: "success" };
}
export async function requestReplay(_state: ReplayState, form: FormData) { return act(form, false); }
export async function approveReplay(_state: ReplayState, form: FormData) { return act(form, true); }
