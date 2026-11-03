"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { captureMarketingFunnelTouch,recordMarketingFunnelEvent } from "@/modules/shared/lib/marketing-autopilot/funnel";

const ownerRoles = ["CLIENT_OWNER", "PROVIDER_OWNER", "FRANCHISE_OWNER"] as const;

const organizationRequestSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().min(2).max(200),
  ice: z.string().trim().transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")).pipe(z.string().min(8).max(32).regex(/^[A-Z0-9]+$/)),
  ownerRole: z.enum(ownerRoles),
  idempotencyKey: z.string().uuid(),
});

export type OrganizationField = "legalName" | "displayName" | "ice" | "ownerRole";
type OrganizationFailureReason = "UNAUTHENTICATED" | "ALREADY_MEMBER" | "IDEMPOTENCY_MISMATCH" | "UNAVAILABLE" | "FRANCHISE_MANDATE_REQUIRED";
export type OrganizationActionState =
  | { status: "idle" }
  | { status: "error"; reason: "VALIDATION"; fieldErrors: Partial<Record<OrganizationField, true>> }
  | { status: "error"; reason: OrganizationFailureReason }
  | { status: "success"; outcome: "ORGANIZATION_CREATED" | "ACCESS_REQUESTED" };

type RpcResponse = { outcome?: unknown;organization_id?:unknown };

function validationErrors(error: z.ZodError): Partial<Record<OrganizationField, true>> {
  const errors: Partial<Record<OrganizationField, true>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === "legalName" || field === "displayName" || field === "ice" || field === "ownerRole") errors[field] = true;
  }
  return errors;
}

function databaseErrorReason(message: string): OrganizationFailureReason {
  if (message.includes("UNAUTHENTICATED")) return "UNAUTHENTICATED";
  if(message.includes("FRANCHISE_JOIN_REQUIRES_APPROVED_MANDATE"))return "FRANCHISE_MANDATE_REQUIRED";
  if (message.includes("ALREADY_MEMBER")) return "ALREADY_MEMBER";
  if (message.includes("IDEMPOTENCY_PAYLOAD_MISMATCH")) return "IDEMPOTENCY_MISMATCH";
  return "UNAVAILABLE";
}

export async function createOrRequestOrganization(
  _previousState: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  const parsed = organizationRequestSchema.safeParse({
    legalName: formData.get("legalName"),
    displayName: formData.get("displayName"),
    ice: formData.get("ice"),
    ownerRole: formData.get("ownerRole"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) {
    const fieldErrors = validationErrors(parsed.error);
    return Object.keys(fieldErrors).length > 0
      ? { status: "error", reason: "VALIDATION", fieldErrors }
      : { status: "error", reason: "UNAVAILABLE" };
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { status: "error", reason: "UNAUTHENTICATED" };

  await captureMarketingFunnelTouch();
  const { data, error } = await supabase.rpc("create_or_request_organization", {
    p_legal_name: parsed.data.legalName,
    p_display_name: parsed.data.displayName,
    p_ice: parsed.data.ice,
    p_owner_role: parsed.data.ownerRole,
    p_idempotency_key: parsed.data.idempotencyKey,
    p_correlation_id: randomUUID(),
  });
  if (error) return { status: "error", reason: databaseErrorReason(error.message) };

  const outcome = (data as RpcResponse | null)?.outcome;
  if (outcome !== "ORGANIZATION_CREATED" && outcome !== "ACCESS_REQUESTED") {
    return { status: "error", reason: "UNAVAILABLE" };
  }
  if (outcome === "ORGANIZATION_CREATED") {
    const organizationId=z.string().uuid().safeParse((data as RpcResponse).organization_id);
    if(!organizationId.success)return{status:"error",reason:"UNAVAILABLE"};
    await recordMarketingFunnelEvent("REGISTRATION_STARTED", organizationId.data);
  }
  return { status: "success", outcome };
}
