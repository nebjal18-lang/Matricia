"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { executeCommand } from "../../../../../../packages/application/src/execute-command";
import { commandFailure, type CommandState } from "../../../../../../packages/contracts/src/command-result";
import { formText } from "../../../../../../packages/forms/src/values";
import { casablancaLocalToIso } from "@/modules/shared/lib/geo/casablanca-time";
export type State = CommandState;
const invalid = () => ({ status: "error", code: "VALIDATION", correlationId: randomUUID() } as const);
const id = z.string().uuid(), text = z.string().trim(), base = z.object({ locale: z.enum(["fr", "ar"]), idempotencyKey: id }), read = formText, nil = (v: string) => v || null;
function date(value: string): string | null {
    const local = casablancaLocalToIso(value);
    if (local) return new Date(local).toISOString();
    const absolute = z.string().datetime({ offset: true }).safeParse(value);
    return absolute.success ? new Date(absolute.data).toISOString() : null;
}
async function rpc(locale: string, name: string, args: Record<string, unknown>): Promise<State> {
    const correlationId = randomUUID();
    const result = await executeCommand({ correlationId,
        authenticate: async () => { const c = await getSupabaseServerClient(); const auth = await c.auth.getUser(); return { authenticated: Boolean(auth.data.user), error: Boolean(auth.error) }; },
        execute: async () => { const c = await getSupabaseServerClient(); return c.rpc(name, { ...args, p_correlation_id: correlationId }); } });
    if (result.status === "success")
        revalidatePath("/" + locale + "/administration/incitations");
    return result;
}
const creditQuantity = z.string().trim().regex(/^[1-9][0-9]{0,18}$/u).pipe(z.string().refine(value => BigInt(value) <= 9223372036854775807n));
const rule = base.extend({ code: text.regex(/^[A-Z][A-Z0-9_]{2,63}$/), status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "RETIRED"]), trigger: text.regex(/^[A-Z][A-Z0-9_.]{2,79}$/), audience: z.enum(["CLIENT_ORGANIZATION", "REFERRED_CLIENT", "REFERRED_PROVIDER"]), bonus: creditQuantity, recipientCap: creditQuantity, globalCap: creditQuantity, window: z.coerce.number().int().min(1).max(366), cooldown: z.coerce.number().int().min(0).max(8760), validity: z.coerce.number().int().min(1).max(3660), eligibility: text, approval: z.enum(["yes", "no"]), from: z.string().datetime(), until: z.union([z.string().datetime(), z.literal("")]), reason: text.min(3).max(1000) });
export async function createRule(_: State, f: FormData) { try {
    const from = date(read(f, "from")), until = read(f, "until") ? date(read(f, "until")) : "";
    if (!from || until === null)
        return invalid();
    const p = rule.safeParse({ locale: read(f, "locale"), idempotencyKey: read(f, "idempotencyKey"), code: read(f, "code").toUpperCase(), status: read(f, "status"), trigger: read(f, "trigger").toUpperCase(), audience: read(f, "audience"), bonus: read(f, "bonus"), recipientCap: read(f, "recipientCap"), globalCap: read(f, "globalCap"), window: read(f, "window"), cooldown: read(f, "cooldown"), validity: read(f, "validity"), eligibility: read(f, "eligibility"), approval: read(f, "approval") || "no", from, until, reason: read(f, "reason") });
    if (!p.success)
        return invalid();
    let eligibility: unknown;
    try {
        eligibility = JSON.parse(p.data.eligibility);
    }
    catch {
        return invalid();
    }
    if (!eligibility || Array.isArray(eligibility) || typeof eligibility !== "object")
        return invalid();
    return rpc(p.data.locale, "create_reward_rule_version", { p_rule_code: p.data.code, p_status: p.data.status, p_trigger_event: p.data.trigger, p_audience_type: p.data.audience, p_bonus_credits: p.data.bonus, p_per_recipient_cap_credits: p.data.recipientCap, p_global_cap_credits: p.data.globalCap, p_window_days: p.data.window, p_cooldown_hours: p.data.cooldown, p_credit_validity_days: p.data.validity, p_eligibility_rule: eligibility, p_requires_approval: p.data.approval === "yes", p_effective_from: p.data.from, p_effective_until: nil(p.data.until), p_change_reason: p.data.reason, p_idempotency_key: p.data.idempotencyKey });
}
catch {
    return commandFailure(null, randomUUID());
} }
const policy = base.extend({ organizationId: id, code: text.regex(/^[A-Z][A-Z0-9_]{2,63}$/), labelFr: text.min(3).max(160), labelAr: text.min(3).max(160), dimension: z.enum(["OVERALL", "QUALITY", "DELIVERY", "COMPLIANCE", "RESPONSIVENESS", "SATISFACTION", "FINANCE"]), minimum: z.coerce.number().int().min(0).max(10000), evidence: z.coerce.number().int().positive(), from: z.string().datetime(), until: z.union([z.string().datetime(), z.literal("")]), reason: text.min(3).max(1000) });
export async function createPolicy(_: State, f: FormData) { try {
    const from = date(read(f, "from")), until = read(f, "until") ? date(read(f, "until")) : "";
    if (!from || until === null)
        return invalid();
    const p = policy.safeParse({ locale: read(f, "locale"), idempotencyKey: read(f, "idempotencyKey"), organizationId: read(f, "organizationId"), code: read(f, "code").toUpperCase(), labelFr: read(f, "labelFr"), labelAr: read(f, "labelAr"), dimension: read(f, "dimension"), minimum: read(f, "minimum"), evidence: read(f, "evidence"), from, until, reason: read(f, "reason") });
    if (!p.success)
        return invalid();
    return rpc(p.data.locale, "create_provider_badge_policy_version", { p_audit_organization_id: p.data.organizationId, p_badge_code: p.data.code, p_label_fr: p.data.labelFr, p_label_ar: p.data.labelAr, p_dimension: p.data.dimension, p_minimum_basis_points: p.data.minimum, p_minimum_evidence_count: p.data.evidence, p_effective_from: p.data.from, p_effective_until: nil(p.data.until), p_change_reason: p.data.reason, p_idempotency_key: p.data.idempotencyKey });
}
catch {
    return commandFailure(null, randomUUID());
} }
const evaluate = base.extend({ policyId: id, reputationId: id });
export async function evaluateBadge(_: State, f: FormData) { try {
    const p = evaluate.safeParse({ locale: read(f, "locale"), idempotencyKey: read(f, "idempotencyKey"), policyId: read(f, "policyId"), reputationId: read(f, "reputationId") });
    if (!p.success)
        return invalid();
    const c = await getSupabaseServerClient(), snapshot = await c.from("provider_reputation_snapshots").select("provider_organization_id,service_id").eq("id", p.data.reputationId).maybeSingle();
    if (snapshot.error)
        return commandFailure(snapshot.error, randomUUID());
    if (!snapshot.data)
        return { status: "error", code: "NOT_FOUND", correlationId: randomUUID() } as const;
    return rpc(p.data.locale, "evaluate_provider_badge", { p_provider_organization_id: snapshot.data.provider_organization_id, p_service_id: snapshot.data.service_id, p_badge_policy_id: p.data.policyId, p_reputation_snapshot_id: p.data.reputationId, p_idempotency_key: p.data.idempotencyKey });
}
catch {
    return commandFailure(null, randomUUID());
} }
const decide = base.extend({ evaluationId: id, action: z.enum(["PUBLISHED", "REVOKED"]), rationale: text.min(10).max(1000) });
export async function decideBadge(_: State, f: FormData) { try {
    const p = decide.safeParse({ locale: read(f, "locale"), idempotencyKey: read(f, "idempotencyKey"), evaluationId: read(f, "evaluationId"), action: read(f, "action"), rationale: read(f, "rationale") });
    if (!p.success)
        return invalid();
    return rpc(p.data.locale, "decide_provider_badge", { p_evaluation_id: p.data.evaluationId, p_action: p.data.action, p_rationale: p.data.rationale, p_idempotency_key: p.data.idempotencyKey });
}
catch {
    return commandFailure(null, randomUUID());
} }
const refresh = base.extend({ providerId: id, serviceId: z.union([id, z.literal("")]), policyVersion: text.min(3).max(80) });
export async function refreshReputation(_: State, f: FormData) { try {
    const p = refresh.safeParse({ locale: read(f, "locale"), idempotencyKey: read(f, "idempotencyKey"), providerId: read(f, "providerId"), serviceId: read(f, "serviceId"), policyVersion: read(f, "policyVersion") });
    if (!p.success)
        return invalid();
    return rpc(p.data.locale, "refresh_provider_reputation_from_events", { p_provider_organization_id: p.data.providerId, p_service_id: nil(p.data.serviceId), p_policy_version: p.data.policyVersion, p_idempotency_key: p.data.idempotencyKey });
}
catch {
    return commandFailure(null, randomUUID());
} }
const checklist = base.extend({ serviceVersionId: id, items: text.min(2).max(30000), reason: text.min(3).max(500) });
export async function publishChecklist(_: State, f: FormData) { try {
    const p = checklist.safeParse({ locale: read(f, "locale"), idempotencyKey: read(f, "idempotencyKey"), serviceVersionId: read(f, "serviceVersionId"), items: read(f, "items"), reason: read(f, "reason") });
    if (!p.success)
        return invalid();
    let items: unknown;
    try {
        items = JSON.parse(p.data.items);
    }
    catch {
        return invalid();
    }
    if (!Array.isArray(items))
        return invalid();
    const c = await getSupabaseServerClient(), scope = await c.from("catalog_service_versions").select("catalog_services!catalog_service_versions_service_id_library_id_fkey!inner(catalog_libraries!inner(steward_organization_id))").eq("id", p.data.serviceVersionId).eq("status", "PUBLISHED").maybeSingle(), service = scope.data?.catalog_services as unknown as {
        catalog_libraries?: {
            steward_organization_id?: unknown;
        };
    } | null, organizationId = service?.catalog_libraries?.steward_organization_id;
    if (scope.error)
        return commandFailure(scope.error, randomUUID());
    if (typeof organizationId !== "string")
        return { status: "error", code: "NOT_FOUND", correlationId: randomUUID() } as const;
    return rpc(p.data.locale, "publish_service_checklist_template", { p_audit_organization_id: organizationId, p_service_version_id: p.data.serviceVersionId, p_items: items, p_change_reason: p.data.reason, p_idempotency_key: p.data.idempotencyKey });
}
catch {
    return commandFailure(null, randomUUID());
} }
