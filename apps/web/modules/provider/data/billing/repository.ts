import { selectProviderMembership } from "@/modules/provider/data/spaces/organization-context";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { BillingDashboard, ProviderCommissionReceipt } from "./model";

const id = z.string().uuid();
const money = z.string().regex(/^\d+$/);
const membership = z.object({ organization_id: id, organizations: z.object({ display_name: z.string().min(1) }) });
const payableSchema = z.object({ id, occurred_on: z.string(), event_type: z.string(), currency: z.string(), total_due_minor: money });
const statementSchema = z.object({ id, statement_number: z.string(), period_start: z.string(), period_end: z.string(), currency: z.string(), total_minor: money });
const invoiceSchema = z.object({ id, invoice_number: z.string(), currency: z.string(), total_minor: money, paid_minor: money, outstanding_minor: money, credited_minor: money.optional(), available_credit_minor:money.optional(), payment_status: z.string(), due_on: z.string() });
const paymentSchema = z.object({ id, payment_reference: z.string(), currency: z.string(), amount_minor: money, paid_on: z.string() });
const allocationSchema = z.object({ id: money, reconciliation_batch_id: id, payment_id: id, invoice_id: id, amount_minor: money, created_at: z.string() });
const accountSchema = z.object({ id, code: z.string(), currency: z.string() });
const creditNoteSchema = z.object({ id, invoice_id: id, credit_number: z.string(), currency: z.string(), total_minor: money, issued_on: z.string() });
const planSchema = z.object({ id, invoice_id: id, reason: z.string() });
const planDecisionSchema = z.object({ plan_id: id, decision_version: z.number().int().positive(), status: z.string() });
const installmentSchema = z.object({ plan_id: id, sequence: z.number().int().positive(), due_on: z.string(), amount_minor: money });

type BillingLoadResult =
  | { status: "success"; dashboard: BillingDashboard }
  | { status: "error"; reason: "UNAUTHENTICATED" | "NO_BILLING_ORGANIZATION" | "QUERY_FAILED" | "INVALID_RESPONSE" };

export async function loadProviderBilling(requestedOrganizationId?: string, requestedInvoiceId?: string, requestedPage=1): Promise<BillingLoadResult> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };

  const membershipResult = await client.from("organization_memberships")
    .select("organization_id,organizations!inner(display_name),organization_member_roles!inner(role_code,revoked_at)")
    .eq("user_id", auth.user.id).eq("status", "ACTIVE").is("organization_member_roles.revoked_at", null)
    .in("organization_member_roles.role_code", ["PROVIDER_OWNER", "PROVIDER_ACCOUNTING"]).limit(100);
  if (membershipResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const parsedMembership = membership.safeParse(selectProviderMembership(z.array(membership).safeParse(membershipResult.data).data ?? [], requestedOrganizationId));
  if (!parsedMembership.success) return { status: "error", reason: membershipResult.data ? "INVALID_RESPONSE" : "NO_BILLING_ORGANIZATION" };

  const organizationId = parsedMembership.data.organization_id;
  const page=Number.isSafeInteger(requestedPage)&&requestedPage>0&&requestedPage<=100000?requestedPage:1;
  let invoiceQuery = client.from("provider_invoice_balances").select("id,invoice_number,currency,total_minor::text,paid_minor::text,outstanding_minor::text,credited_minor::text,available_credit_minor::text,payment_status,due_on").eq("provider_organization_id", organizationId).order("due_on", { ascending: false });
  if (requestedInvoiceId) invoiceQuery = id.safeParse(requestedInvoiceId).success ? invoiceQuery.eq("id", requestedInvoiceId) : invoiceQuery.eq("invoice_number", requestedInvoiceId);
  else invoiceQuery = invoiceQuery.order("id",{ascending:false}).range((page-1)*50,page*50);
  const [payablesResult, statementsResult, invoicesResult, paymentsResult, accountsResult, creditsResult, plansResult, planDecisionsResult, installmentsResult] = await Promise.all([
    client.from("provider_payable_events").select("id,occurred_on,event_type,currency,total_due_minor::text").eq("provider_organization_id", organizationId).order("occurred_on", { ascending: false }).limit(50),
    client.from("provider_statements").select("id,statement_number,period_start,period_end,currency,total_minor::text").eq("provider_organization_id", organizationId).order("issued_at", { ascending: false }).limit(30),
    invoiceQuery,
    client.from("provider_payments").select("id,payment_reference,currency,amount_minor::text,paid_on").eq("provider_organization_id", organizationId).order("paid_on", { ascending: false }).limit(50),
    client.from("financial_accounts").select("id,code,currency").eq("organization_id", organizationId).order("code"),
    client.from("provider_credit_notes").select("id,invoice_id,credit_number,currency,total_minor::text,issued_on").eq("provider_organization_id", organizationId).order("issued_on", { ascending: false }).limit(50),
    client.from("provider_payment_plans").select("id,invoice_id,reason").eq("provider_organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    client.from("provider_payment_plan_decisions").select("plan_id,decision_version,status").eq("provider_organization_id", organizationId).order("decision_version", { ascending: false }).limit(200),
    client.from("provider_payment_plan_installments").select("plan_id,sequence,due_on,amount_minor::text").eq("provider_organization_id", organizationId).order("sequence").limit(200),
  ]);
  if (payablesResult.error || statementsResult.error || invoicesResult.error || paymentsResult.error || accountsResult.error || creditsResult.error || plansResult.error || planDecisionsResult.error || installmentsResult.error) return { status: "error", reason: "QUERY_FAILED" };

  const payables = z.array(payableSchema).safeParse(payablesResult.data);
  const statements = z.array(statementSchema).safeParse(statementsResult.data);
  const invoices = z.array(invoiceSchema).safeParse(invoicesResult.data);
  const payments = z.array(paymentSchema).safeParse(paymentsResult.data);
  const accounts = z.array(accountSchema).safeParse(accountsResult.data);
  const credits = z.array(creditNoteSchema).safeParse(creditsResult.data);
  const plans = z.array(planSchema).safeParse(plansResult.data);
  const planDecisions = z.array(planDecisionSchema).safeParse(planDecisionsResult.data);
  const installments = z.array(installmentSchema).safeParse(installmentsResult.data);
  if (!payables.success || !statements.success || !invoices.success || !payments.success || !accounts.success || !credits.success || !plans.success || !planDecisions.success || !installments.success) return { status: "error", reason: "INVALID_RESPONSE" };

  const allocationsResult = payments.data.length === 0 ? { data: [], error: null } : await client
    .from("provider_payment_allocations")
    .select("id::text,reconciliation_batch_id,payment_id,invoice_id,amount_minor::text,created_at")
    .eq("provider_organization_id", organizationId)
    .in("payment_id", payments.data.map((item) => item.id))
    .order("created_at", { ascending: false });
  if (allocationsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const allocations = z.array(allocationSchema).safeParse(allocationsResult.data);
  if (!allocations.success) return { status: "error", reason: "INVALID_RESPONSE" };

  const pendingResult=await client.rpc("list_my_provider_billing_intents",{p_provider_organization_id:organizationId});
  const pending=z.array(z.object({id,kind:z.enum(["PAYMENT","PAYABLE"]),status:z.enum(["PENDING","EXPIRED","REJECTED"]),reference:z.string(),amount_minor:money,currency:z.string(),scan_status:z.enum(["PENDING","CLEAN","INFECTED","ERROR"]),expired:z.boolean(),created_at:z.string()})).safeParse(pendingResult.data);
  if(pendingResult.error||!pending.success)return {status:"error",reason:"QUERY_FAILED"};
  const displayedInvoices=invoices.data.slice(0,50);
  const stateSchema=z.array(z.object({source_id:id,status:z.enum(["READY","EDITION_PENDING","LEGACY_REVIEW_REQUIRED","CORRECTION_REQUIRED","CORRECTED"])}));
  const states=await Promise.all(([['invoice',displayedInvoices.map(x=>x.id)],['statement',statements.data.map(x=>x.id)],['credit_note',credits.data.map(x=>x.id)]]as const).map(async([kind,ids])=>ids.length?client.rpc("get_provider_billing_document_states",{p_provider_organization_id:organizationId,p_kind:kind,p_source_ids:ids}):{data:[],error:null}));
  const parsedStates=states.map(x=>stateSchema.safeParse(x.data));if(states.some(x=>x.error)||parsedStates.some(x=>!x.success))return{status:"error",reason:"QUERY_FAILED"};
  const editionStates=new Map(parsedStates.flatMap(x=>x.success?x.data:[]).map(x=>[x.source_id,x.status]));
  const allocatedByPayment = new Map<string, bigint>();
  for (const item of allocations.data) allocatedByPayment.set(item.payment_id, (allocatedByPayment.get(item.payment_id) ?? BigInt(0)) + BigInt(item.amount_minor));
  if (payments.data.some((item) => (allocatedByPayment.get(item.id) ?? BigInt(0)) > BigInt(item.amount_minor))) return { status: "error", reason: "INVALID_RESPONSE" };
  const invoiceById = new Map(displayedInvoices.map((item) => [item.id, item]));
  const paymentById = new Map(payments.data.map((item) => [item.id, item]));
  const planStatus = new Map<string, { version: number; status: string }>();
  for (const row of planDecisions.data) {
    const current = planStatus.get(row.plan_id);
    if (!current || row.decision_version > current.version) planStatus.set(row.plan_id, { version: row.decision_version, status: row.status });
  }

  return { status: "success", dashboard: {
    pendingIntents:pending.data.map(x=>({id:x.id,kind:x.kind,status:x.status,reference:x.reference,amountMinor:x.amount_minor,currency:x.currency,scanStatus:x.scan_status,expired:x.expired,createdAt:x.created_at})),listPage:page,hasMoreInvoices:invoices.data.length>50,organizationId,
    organizationName: parsedMembership.data.organizations.display_name,
    payables: payables.data.map((item) => ({ id: item.id, occurredOn: item.occurred_on, eventType: item.event_type, currency: item.currency, totalDueMinor: item.total_due_minor })),
    statements: statements.data.map((item) => ({ editionStatus:editionStates.get(item.id)??"LEGACY_REVIEW_REQUIRED",id: item.id, number: item.statement_number, periodStart: item.period_start, periodEnd: item.period_end, currency: item.currency, totalMinor: item.total_minor })),
    invoices: displayedInvoices.map((item) => ({ editionStatus:editionStates.get(item.id)??"LEGACY_REVIEW_REQUIRED",id: item.id, number: item.invoice_number, currency: item.currency, totalMinor: item.total_minor, availableCreditMinor:item.available_credit_minor??"0",paidMinor: item.paid_minor, outstandingMinor: item.outstanding_minor, creditedMinor: item.credited_minor ?? "0", paymentStatus: item.payment_status, dueOn: item.due_on })),
    payments: payments.data.map((item) => {
      const allocatedMinor = allocatedByPayment.get(item.id) ?? BigInt(0);
      return { id: item.id, reference: item.payment_reference, currency: item.currency, amountMinor: item.amount_minor, allocatedMinor: allocatedMinor.toString(), unallocatedMinor: (BigInt(item.amount_minor) - allocatedMinor).toString(), paidOn: item.paid_on };
    }),
    allocations: allocations.data.map((item) => ({
      id: item.id, batchId: item.reconciliation_batch_id, paymentId: item.payment_id,
      paymentReference: paymentById.get(item.payment_id)?.payment_reference ?? item.payment_id.slice(0, 8),
      invoiceId: item.invoice_id, invoiceNumber: invoiceById.get(item.invoice_id)?.invoice_number ?? item.invoice_id.slice(0, 8),
      currency: paymentById.get(item.payment_id)?.currency ?? invoiceById.get(item.invoice_id)?.currency ?? "MAD",
      amountMinor: item.amount_minor, createdAt: item.created_at,
    })),
    accounts: accounts.data,
    creditNotes: credits.data.map((item) => ({
      editionStatus:editionStates.get(item.id)??"LEGACY_REVIEW_REQUIRED",
      id: item.id,
      number: item.credit_number,
      invoiceId: item.invoice_id,
      invoiceNumber: invoiceById.get(item.invoice_id)?.invoice_number ?? item.invoice_id.slice(0, 8),
      currency: item.currency,
      totalMinor: item.total_minor,
      issuedOn: item.issued_on,
    })),
    paymentPlans: plans.data.map((item) => ({
      id: item.id,
      invoiceId: item.invoice_id,
      invoiceNumber: invoiceById.get(item.invoice_id)?.invoice_number ?? item.invoice_id.slice(0, 8),
      status: planStatus.get(item.id)?.status ?? "REQUESTED",
      reason: item.reason,
      installments: installments.data.filter((row) => row.plan_id === item.id).map((row) => ({ sequence: row.sequence, dueOn: row.due_on, amountMinor: row.amount_minor })),
    })),
  } };
}

const commissionSchema = z.object({
  id,
  provider_invoice_id: id,
  commission_amount_minor: money,
  tax_amount_minor: money,
  currency: z.string(),
  matricia_receipt_reference: z.string().min(1),
  recorded_at: z.string(),
});

export async function loadProviderCommissions(organizationId: string): Promise<
  | { status: "success"; receipts: ProviderCommissionReceipt[] }
  | { status: "error"; reason: "QUERY_FAILED" | "INVALID_RESPONSE" }
> {
  const client = await getSupabaseServerClient();
  const result = await client
    .from("provider_commission_receipts")
    .select("id,provider_invoice_id,commission_amount_minor::text,tax_amount_minor::text,currency,matricia_receipt_reference,recorded_at")
    .eq("provider_organization_id", organizationId)
    .order("recorded_at", { ascending: false })
    .limit(80);
  if (result.error) return { status: "error", reason: "QUERY_FAILED" };
  const parsed = z.array(commissionSchema).safeParse(result.data);
  if (!parsed.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const invoices = parsed.data.length === 0
    ? { data: [] as Array<{ id: string; invoice_number: string }>, error: null }
    : await client.from("provider_invoices").select("id,invoice_number").eq("provider_organization_id", organizationId).in("id", parsed.data.map((item) => item.provider_invoice_id));
  if (invoices.error) return { status: "error", reason: "QUERY_FAILED" };
  const numbers = new Map((invoices.data ?? []).map((item) => [item.id, item.invoice_number]));
  return {
    status: "success",
    receipts: parsed.data.map((item) => ({
      id: item.id,
      invoiceId: item.provider_invoice_id,
      invoiceNumber: numbers.get(item.provider_invoice_id) ?? item.provider_invoice_id.slice(0, 8),
      reference: item.matricia_receipt_reference,
      currency: item.currency,
      commissionMinor: item.commission_amount_minor,
      taxMinor: item.tax_amount_minor,
      recordedAt: item.recorded_at,
    })),
  };
}
