"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
export type ReuseState = { status: "idle" | "success" | "error"; mfa?: boolean };
export async function respondDocumentReuse(_: ReuseState, form: FormData): Promise<ReuseState> {
  const parsed = z.object({ locale: z.enum(["fr", "ar"]), requestId: z.string().uuid(), accept: z.enum(["true", "false"]), key: z.string().uuid() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error" };
  const value = parsed.data;
  const { error } = await (await getSupabaseServerClient()).rpc("respond_admin_document_reuse_v1", { p_request_id: value.requestId, p_accept: value.accept === "true", p_idempotency_key: value.key });
  if (error) return { status: "error", mfa: error.code === "42501" };
  revalidatePath(`/${value.locale}/client/documents`);
  return { status: "success" };
}
