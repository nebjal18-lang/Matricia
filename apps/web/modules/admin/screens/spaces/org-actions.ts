"use server";

import { bindAdminDeployment } from "./environment";
import { createHash, randomUUID } from "node:crypto";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { requestAdminAction, type AdminActionState } from "@/modules/admin/screens/command-center/actions";

export type { AdminActionState };

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function requestOrganizationMutation(previous: AdminActionState, form: FormData): Promise<AdminActionState> {
  const intent = value(form, "intent") || "CHANGE_CONFIGURATION";
  let expectedRowVersion: number | null = null;
  let currentStatus = "";
  let expectedIce = "";
  let identityChanged = false;
  if (intent !== "CREATE_ORGANIZATION") {
    const client = await getSupabaseServerClient();
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
    const current = await client.from("organizations").select("row_version,status,legal_name,country_code").eq("id", value(form, "organizationId") || value(form, "resourceId")).maybeSingle();
    if (current.error || !current.data) return { status: "error", reason: "FORBIDDEN" };
    expectedRowVersion = Number(current.data.row_version);
    currentStatus = String(current.data.status);
    const identifier = await client.from("organization_identifiers").select("normalized_value").eq("organization_id",value(form,"organizationId")||value(form,"resourceId")).eq("identifier_type","ICE").eq("is_active",true).maybeSingle();
    if(identifier.error)return {status:"error",reason:"FAILED"};
    expectedIce=String(identifier.data?.normalized_value??"");
    const nextIce=value(form,"ice").replace(/[^0-9A-Za-z]/g,"").toUpperCase();
    identityChanged=Boolean((nextIce&&nextIce!==expectedIce)||(value(form,"legalName")&&value(form,"legalName")!==current.data.legal_name)||(value(form,"country")&&value(form,"country").toUpperCase()!==current.data.country_code));
    const submittedVersion = value(form, "expectedRowVersion");
    if (submittedVersion && Number(submittedVersion) !== expectedRowVersion) return { status: "error", reason: "CONFLICT" };
  }
  if (value(form, "status") && !["PENDING", "ACTIVE", "SUSPENDED", "ARCHIVED"].includes(value(form, "status"))) return { status: "error", reason: "VALIDATION" };
  const summary = {
    expectedRowVersion,
    expectedIce,
    intent,
    displayName: value(form, "displayName"),
    legalName: value(form, "legalName"),
    acronym: value(form, "acronym"),
    description: value(form, "description"),
    address: value(form, "address"),
    city: value(form, "city"),
    postalCode: value(form, "postalCode"),
    country: value(form, "country"),
    phone: value(form, "phone"),
    email: value(form, "email"),
    website: value(form, "website"),
    legalForm: value(form, "legalForm"),
    ice: value(form, "ice"),
    status: value(form, "status"),
    note: value(form, "note"),
    kind: value(form, "kind"),
    adminLevel: value(form, "adminLevel"),
    parent: value(form, "parent"),
    draft: value(form, "draft") === "1",
  };
  if ((intent === "CREATE_ORGANIZATION" || identityChanged) && !/^\d{15}$/.test(summary.ice.replace(/[^0-9A-Za-z]/g,""))) return {status:"error",reason:"VALIDATION"};
  const canonical = JSON.stringify(summary);
  form.set("redactedSummary", canonical);
  form.set("requestPayloadHash", createHash("sha256").update(canonical).digest("hex"));
  form.set("actionType", intent === "SUSPEND_ENTITY" || intent === "RESTRICT_ENTITY" ? intent : value(form, "status") && value(form, "status") !== currentStatus ? value(form, "status") === "ARCHIVED" ? "RESTRICT_ENTITY" : value(form, "status") === "SUSPENDED" ? "SUSPEND_ENTITY" : "MANUAL_EXCEPTION" : identityChanged ? "MANUAL_EXCEPTION" : "CHANGE_CONFIGURATION");
  form.set("resourceType", "ORGANIZATION");
  if (!value(form, "resourceId")) form.set("resourceId", value(form, "organizationId") || randomUUID());
  if (!value(form, "idempotencyKey")) form.set("idempotencyKey", randomUUID());
  if (!value(form, "targetEnvironment")) form.set("targetEnvironment", process.env.APP_ENV === "production" ? "PRODUCTION" : process.env.APP_ENV === "staging" ? "STAGING" : "DEVELOPMENT");
  if (!await bindAdminDeployment(form)) return { status: "error", reason: "FORBIDDEN" };
  return requestAdminAction(previous, form);
}
