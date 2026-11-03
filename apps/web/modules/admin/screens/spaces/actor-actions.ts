"use server";

import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { requestedCapabilityCodes } from "@/modules/admin/data/spaces/role-preview";
import { bindAdminDeployment } from "./environment";
import { createHash, randomUUID } from "node:crypto";
import { type InvitationActionState } from "@/app/[locale]/invitations/actions";
import { requestAdminAction, type AdminActionState } from "@/modules/admin/screens/command-center/actions";
import { revalidatePath } from "next/cache";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {z} from "zod";

export type { AdminActionState };
export type ActorInviteState = InvitationActionState | AdminActionState;

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function prepareFourEyes(form: FormData, resourceType: string) {
  const intent = value(form, "intent") || "CHANGE_CONFIGURATION";
  const summary = {
    intent,
    draft:intent==="SAVE_DRAFT",
    invitedEmail: value(form, "invitedEmail"),
    organizationId: value(form, "organizationId"),
    roleCode: value(form, "roleCode") || value(form, "roleCodes"),
    perimeter: value(form, "perimeter"),
    inviteLocale: value(form, "inviteLocale"),
    message: value(form, "message"),
    userId: value(form, "userId"),
    currentRole: value(form, "currentRole"),
    currentFranchiseId: value(form, "currentFranchiseId"),
    franchiseId: value(form, "franchiseId"),
    newRole: value(form, "newRole"),
    capabilities: form.getAll("capabilities").map(String),
    scope: value(form, "scope"),
    entities: value(form, "entities"),
    note: value(form, "note"),
  };
  const canonical = JSON.stringify(summary);
  form.set("redactedSummary", canonical);
  form.set("requestPayloadHash", createHash("sha256").update(canonical).digest("hex"));
  form.set("actionType", intent === "SUSPEND_ENTITY" || intent === "RESTRICT_ENTITY" ? intent : "CHANGE_CONFIGURATION");
  form.set("resourceType", resourceType);
  if (!value(form, "resourceId")) form.set("resourceId", value(form, "userId") || value(form, "invitationId") || value(form, "organizationId") || randomUUID());
  if (!value(form, "idempotencyKey")) form.set("idempotencyKey", randomUUID());
  if (!value(form, "targetEnvironment")) form.set("targetEnvironment", process.env.APP_ENV === "production" ? "PRODUCTION" : process.env.APP_ENV === "staging" ? "STAGING" : "DEVELOPMENT");
  if (!value(form, "reason")) form.set("reason", value(form, "note") || "Demande d’accès administrateur soumise au contrôle à quatre yeux.");
}

export async function requestActorMutation(previous: AdminActionState, form: FormData): Promise<AdminActionState> {
  if (form.getAll("capabilities").some((cap) => !(requestedCapabilityCodes as readonly string[]).includes(String(cap)))) return { status: "error", reason: "VALIDATION" };
  prepareFourEyes(form, value(form, "resourceType") || "MEMBERSHIP");
  if (!await bindAdminDeployment(form)) return { status: "error", reason: "FORBIDDEN" };
  const result = await requestAdminAction(previous, form);
  const locale = value(form, "locale") || "fr";
  revalidatePath(`/${locale}/administration/utilisateurs`);
  revalidatePath(`/${locale}/administration/clients`);
  return result;
}

export async function submitActorInvitation(previous: ActorInviteState, form: FormData): Promise<ActorInviteState> {
  const canInviteDirectly = value(form, "canInvite") === "yes";
  if (canInviteDirectly && !value(form, "roleCode").startsWith("FRANCHISE_") && value(form, "intent") !== "INVITE_DRAFT") {
    if (!form.get("roleCodes") && value(form, "roleCode")) form.set("roleCodes", value(form, "roleCode"));
    if (!value(form, "expiryDays")) form.set("expiryDays", "7");
    const input=z.object({organizationId:z.string().uuid(),invitedEmail:z.string().trim().toLowerCase().email(),role:z.string().regex(/^(CLIENT_(OWNER|ADMIN|BUYER|ACCOUNTING|MEMBER|VIEWER)|PROVIDER_(OWNER|MANAGER|SALES|TECHNICIAN|ACCOUNTING|VIEWER))$/),key:z.string().min(8).max(200),expiresAt:z.string().datetime()}).safeParse({organizationId:value(form,"organizationId"),invitedEmail:value(form,"invitedEmail"),role:value(form,"roleCode"),key:value(form,"idempotencyKey"),expiresAt:value(form,"invitationExpiresAt")});
    if(!input.success)return{status:"error",reason:"VALIDATION"};
    const client=await getSupabaseServerClient();
    const {data:auth,error:authError}=await client.auth.getUser();
    const authFailure=classifyAuthReadFailure(authError);
    if(authFailure)return{status:"error",reason:authFailure};
    if(!auth.user)return{status:"error",reason:"UNAUTHENTICATED"};
    if(input.data.invitedEmail===auth.user.email?.toLowerCase())return{status:"error",reason:"VALIDATION"};
    const {error}=await client.rpc("invite_organization_member_by_email",{p_organization_id:input.data.organizationId,p_invited_email:input.data.invitedEmail,p_role_codes:[input.data.role],p_expires_at:input.data.expiresAt,p_idempotency_key:input.data.key,p_correlation_id:randomUUID()});
    if(error)return{status:"error",reason:"UNAVAILABLE"};
    revalidatePath(`/${value(form,"locale")||"fr"}/administration/utilisateurs`);
    return{status:"success"};
  }
  prepareFourEyes(form, "INVITATION");
  if (!await bindAdminDeployment(form)) return { status: "error", reason: "FORBIDDEN" };
  return requestAdminAction({ status: "idle" }, form);
}
