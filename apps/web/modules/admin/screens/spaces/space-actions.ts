"use server";

import{validOperationalSpaceInput}from"./operational-input";
import { bindAdminDeployment } from "./environment";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { decideGovernance, type FranchiseActionState } from "@/modules/franchise/screens/gouvernance/actions";
import { requestAdminAction, type AdminActionState } from "@/modules/admin/screens/command-center/actions";
import { decideCompany, decideQualification, reviewDocument, type AdminProviderActionState } from "@/modules/admin/screens/providers/actions";

export type { AdminActionState, AdminProviderActionState, FranchiseActionState };

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function prepareFourEyes(form: FormData) {
  const intent = value(form, "intent") || "CHANGE_CONFIGURATION";
  const summary = {
    intent,
    draft: intent==="SAVE_DRAFT",
    space: value(form, "space"),
    view: value(form, "view"),
    note: value(form, "note"),
    decision: value(form, "decision"),
    justification: value(form, "justification") || value(form, "reason"),
    providerIds: [...new Set(form.getAll("providerIds").map(String))].sort(),
    context: value(form, "context"),
    dueAt: value(form, "dueAt"),
    channel: value(form, "channel"),
    destination: value(form, "destination"),
    documentId: value(form, "documentId"),
    targetId: value(form, "targetId"),
    purpose: value(form, "purpose"),
  };
  const canonical = JSON.stringify(summary);
  form.set("redactedSummary", canonical);
  form.set("requestPayloadHash", createHash("sha256").update(canonical).digest("hex"));
  form.set("actionType", intent === "SUSPEND_ENTITY" || intent === "RESTRICT_ENTITY" ? intent : "CHANGE_CONFIGURATION");
  if (!value(form, "resourceType")) form.set("resourceType", value(form, "space").toUpperCase() || "ADMIN_SPACE");
  if (!value(form, "resourceId")) form.set("resourceId", value(form, "itemId") || randomUUID());
  if (!value(form, "idempotencyKey")) form.set("idempotencyKey", randomUUID());
  if (!value(form, "targetEnvironment")) form.set("targetEnvironment", process.env.APP_ENV === "production" ? "PRODUCTION" : process.env.APP_ENV === "staging" ? "STAGING" : "DEVELOPMENT");
  if (!value(form, "reason")) form.set("reason", value(form, "justification") || value(form, "note") || "Action d’administration soumise au contrôle à quatre yeux.");
}

function touch(locale: string) {
  revalidatePath(`/${locale}/administration`, "layout");
}

export async function requestSpaceMutation(previous: AdminActionState, form: FormData): Promise<AdminActionState> {
  if(!validOperationalSpaceInput(form))return{status:"error",reason:"VALIDATION"};
  prepareFourEyes(form);
  if (!await bindAdminDeployment(form)) return { status: "error", reason: "FORBIDDEN" };
  const result = await requestAdminAction(previous, form);
  touch(value(form, "locale") || "fr");
  return result;
}

export async function submitProviderCompany(previous: AdminProviderActionState, form: FormData): Promise<AdminProviderActionState> {
  const result = await decideCompany(previous, form);
  touch(value(form, "locale") || "fr");
  return result;
}

export async function submitProviderQualification(previous: AdminProviderActionState, form: FormData): Promise<AdminProviderActionState> {
  const result = await decideQualification(previous, form);
  touch(value(form, "locale") || "fr");
  return result;
}

export async function submitProviderDocument(previous: AdminProviderActionState, form: FormData): Promise<AdminProviderActionState> {
  const result = await reviewDocument(previous, form);
  touch(value(form, "locale") || "fr");
  return result;
}

export async function submitFranchiseGovernance(previous: FranchiseActionState, form: FormData): Promise<FranchiseActionState> {
  const result = await decideGovernance(previous, form);
  touch(value(form, "locale") || "fr");
  return result;
}
