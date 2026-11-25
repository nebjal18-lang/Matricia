import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { readAllPages, readRelatedPages } from "@/modules/shared/lib/data/read-pages";
const uuid = z.string().uuid(), money = z.union([z.string(), z.number().int().safe()]).transform(String);
export const declaration = z.object({ id: uuid, kind: z.enum(["PAYMENT", "PAYABLE"]), provider_organization_id: uuid, client_organization_id: uuid.nullable(), payload: z.record(z.string(), z.unknown()), declared_at: z.string(), declared_by: uuid, upload_id: uuid, can_client_confirm: z.boolean().optional() });
export const decision = z.object({ declaration_id: uuid, decision: z.string(), reason: z.string(), decided_at: z.string(), response: z.record(z.string(), z.unknown()) });
export const period = z.object({ id: uuid, period_end: z.string(), dispute_until: z.string(), currency: z.string(), provider_organization_id: uuid });
export const preLine = z.object({ period_id: uuid, payable_event_id: uuid, source_snapshot: z.object({ mission_id: uuid, contract_version_id: uuid, event_type: z.string(), gross_amount_minor: money, commission_basis_points: z.number(), commission_rule_snapshot: z.object({ calculation: z.string().optional(), source_type: z.string().optional() }).passthrough().optional(), commission_amount_minor: money, tax_amount_minor: money, total_due_minor: money, client_receipt_reference: z.string().nullable(), currency: z.string(), occurred_on: z.string() }).passthrough() });
export const lineDispute = z.object({ id: uuid, period_id: uuid, payable_event_id: uuid, reason: z.string() });
export type BillingWorkspace = {
    declarations: z.infer<typeof declaration>[];
    decisions: z.infer<typeof decision>[];
    periods: z.infer<typeof period>[];
    lines: z.infer<typeof preLine>[];
    disputes: z.infer<typeof lineDispute>[];
    resolutions: Array<{
        dispute_id: string;
        release_line: boolean;
        reason: string;
    }>;
    completions: Array<{
        period_id: string;
    }>;
    exceptions: Array<{
        source_id: string;
        reason_code: string;
        period_end: string;
        resolvedCreditNoteId?: string;
    }>;
};
export async function loadBillingWorkspace(org?: string): Promise<BillingWorkspace | null> {
    const c = await getSupabaseServerClient();
    const base = await Promise.all(["provider_financial_declarations_v1", "provider_billing_periods_v1", "provider_billing_exceptions_v1"].map(name => readAllPages((from, to) => {
        let q = c.from(name).select("*");
        if (org)
            q = q.eq("provider_organization_id", org);
        return q.order("id").range(from, to);
    })));
    if (base.some(r => r.error))
        return null;
    const declarations = z.array(declaration).safeParse(base[0]?.data), periods = z.array(period).safeParse(base[1]?.data);
    if (!declarations.success || !periods.success)
        return null;
    const declarationIds = declarations.data.map(row => row.id), periodIds = periods.data.map(row => row.id);
    const [decisions, lines, disputes, completions] = await Promise.all([
        readRelatedPages(declarationIds, (ids, from, to) => c.from("provider_financial_declaration_decisions_v1").select("*").in("declaration_id", ids).order("declaration_id").order("decision").range(from, to)),
        readRelatedPages(periodIds, (ids, from, to) => c.from("provider_pre_statement_lines_v1").select("*").in("period_id", ids).order("period_id").order("payable_event_id").range(from, to)),
        readRelatedPages(periodIds, (ids, from, to) => c.from("provider_billing_line_disputes_v1").select("*").in("period_id", ids).order("id").range(from, to)),
        readRelatedPages(periodIds, (ids, from, to) => c.from("provider_billing_period_completions_v1").select("*").in("period_id", ids).order("period_id").range(from, to)),
    ]);
    const parsedDisputes = z.array(lineDispute).safeParse(disputes.data);
    if (decisions.error || lines.error || disputes.error || completions.error || !parsedDisputes.success)
        return null;
    const resolutions = await readRelatedPages(parsedDisputes.data.map(row => row.id), (ids, from, to) => c.from("provider_billing_dispute_resolutions_v1").select("*").in("dispute_id", ids).order("dispute_id").range(from, to));
    if (resolutions.error)
        return null;
    const rows = [base[0], decisions, base[1], lines, disputes, resolutions, completions, base[2]];
    const parsed = z.object({ declarations: z.array(declaration), decisions: z.array(decision), periods: z.array(period), lines: z.array(preLine), disputes: z.array(lineDispute), resolutions: z.array(z.object({ dispute_id: uuid, release_line: z.boolean(), reason: z.string() })), completions: z.array(z.object({ period_id: uuid })), exceptions: z.array(z.object({ source_id: uuid, reason_code: z.string(), period_end: z.string() })) }).safeParse(Object.fromEntries(["declarations", "decisions", "periods", "lines", "disputes", "resolutions", "completions", "exceptions"].map((key, index) => [key, rows[index]?.data])));
    if (!parsed.success)
        return null;
    const v = parsed.data;
    const credits = await readRelatedPages(v.exceptions.map(e => e.source_id), (ids, from, to) => c.from("provider_dispute_reversal_credits_v1").select("reversal_id,credit_note_id").in("reversal_id", ids).order("reversal_id").range(from, to));
    if (credits.error)
        return null;
    const creditRows = z.array(z.object({ reversal_id: uuid, credit_note_id: uuid })).safeParse(credits.data);
    if (!creditRows.success)
        return null;
    const creditBySource = new Map(creditRows.data.map(row => [row.reversal_id, row.credit_note_id]));
    const declarationScope = new Set(declarationIds), periodScope = new Set(periodIds);
    return { ...v,
      decisions: v.decisions.filter(row => declarationScope.has(row.declaration_id)),
      lines: v.lines.filter(row => periodScope.has(row.period_id)),
      disputes: v.disputes.filter(row => periodScope.has(row.period_id)),
      exceptions: v.exceptions.map(e => {
        const credit = creditBySource.get(e.source_id);
        return { ...e, ...(credit ? { resolvedCreditNoteId: credit } : {}) };
    }) };
}
/** This Client projection intentionally does not load Provider period/ledger modules. */
export async function loadClientReceiptWorkspace(organizationId: string): Promise<{
    status: "success";
    value: BillingWorkspace;
} | {
    status: "error";
    reason: "FORBIDDEN" | "UNAVAILABLE";
}> {
    const c = await getSupabaseServerClient(), result = await c.rpc("get_client_provider_receipts_v1", { p_organization_id: organizationId });
    if (result.error)
        return { status: "error", reason: result.error.code === "42501" ? "FORBIDDEN" : "UNAVAILABLE" };
    const parsed = z.object({ organization_id: uuid, declarations: z.array(declaration), decisions: z.array(decision) }).safeParse(result.data);
    if (!parsed.success || parsed.data.organization_id !== organizationId)
        return { status: "error", reason: "UNAVAILABLE" };
    return { status: "success", value: { declarations: parsed.data.declarations, decisions: parsed.data.decisions, periods: [], lines: [], disputes: [], resolutions: [], completions: [], exceptions: [] } };
}
