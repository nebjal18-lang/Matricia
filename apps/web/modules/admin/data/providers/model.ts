import { z } from "zod";

export const ADMIN_PROVIDER_LIMITS = Object.freeze({ providers: 100, services: 200, documents: 300, financialRows: 200, allocations: 5000, accounts: 500 });
export const uuid = z.string().uuid();
export const idempotencyKey = uuid;
export const pgMoney = z.string().regex(/^\d+$/).refine(value => BigInt(value) <= BigInt("9223372036854775807"), "AMOUNT_EXCEEDS_BIGINT");

export const companyDecisionInput = z.object({ organizationId: uuid, companyStatus: z.enum(["UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"]), partnerContractStatus: z.enum(["NOT_SIGNED", "PENDING", "SIGNED", "EXPIRED", "TERMINATED"]), partnerContractExpiresAt: z.string().datetime().nullable(), reason: z.string().trim().min(3).max(2000), ruleVersion: z.string().trim().regex(/^[A-Z0-9][A-Z0-9._-]{2,79}$/), expectedRowVersion: z.coerce.number().int().positive(), idempotencyKey });
export const documentDecisionInput = z.object({ documentVersionId: uuid, status: z.enum(["VERIFIED", "REJECTED"]), rationale: z.string().trim().min(3).max(2000), ruleVersion: z.string().trim().regex(/^[A-Z0-9][A-Z0-9._-]{2,79}$/), idempotencyKey });
export const qualificationDecisionInput = z.object({ qualificationId: uuid, status: z.enum(["PENDING", "INFORMATION_REQUIRED", "APPROVED", "CONDITIONAL", "SUSPENDED", "EXPIRED", "REJECTED"]), questionnaireSessionId: uuid.nullable(), scoreBasisPoints: z.coerce.number().int().min(0).max(10000).nullable(), mandatoryChecks: z.array(z.unknown()).max(100), blockingConditions: z.array(z.unknown()).max(100), rationale: z.string().trim().min(3).max(2000), ruleVersion: z.string().trim().regex(/^[A-Z0-9][A-Z0-9._-]{2,79}$/), expiresAt: z.string().datetime().nullable(), expectedRowVersion: z.coerce.number().int().positive(), idempotencyKey }).superRefine((value, context) => {
  if (["APPROVED", "CONDITIONAL"].includes(value.status) && (!value.questionnaireSessionId || value.scoreBasisPoints === null || value.mandatoryChecks.length === 0)) context.addIssue({ code: "custom", path: ["questionnaireSessionId"], message: "DECISION_EVIDENCE_REQUIRED" });
  if (value.status === "CONDITIONAL" && value.blockingConditions.length === 0) context.addIssue({ code: "custom", path: ["blockingConditions"], message: "BLOCKING_CONDITION_REQUIRED" });
});

export type AdminProvider = { organizationId: string; organizationName: string; companyStatus: string; overallStatus: string; partnerContractStatus: string; rowVersion: number };
export type AdminProviderService = { id: string; providerOrganizationId: string; providerName: string; serviceId: string; serviceCode: string; requestStatus: string; qualificationId: string | null; qualificationRowVersion: number | null; qualificationStatus: string; eligible: boolean; eligibilityReasons: string[]; decisionVersion: number | null; ruleVersion: string | null; checkedAt: string | null };
export type AdminProviderDocument = { id: string; providerOrganizationId: string; providerName: string; kind: string; code: string; version: number; status: string; expiresOn: string | null; scanStatus?: string };
export type AdminProviderInvoice = { id: string; providerOrganizationId: string; providerName: string; statementId: string; number: string; currency: string; totalMinor: string; paidMinor: string; outstandingMinor: string; creditedMinor: string; paymentStatus: string; dueOn: string };
export type AdminProviderPayment = { id: string; providerOrganizationId: string; providerName: string; reference: string; currency: string; amountMinor: string; allocatedMinor: string; unallocatedMinor: string; paidOn: string };
export type AdminProviderStatement = { id: string; providerOrganizationId: string; providerName: string; number: string; periodStart: string; periodEnd: string; currency: string; totalMinor: string };
export type AdminProviderAccount = { id: string; providerOrganizationId: string; code: string; currency: string };
export type AdminProviderCreditNote = { id: string; providerOrganizationId: string; providerName: string; invoiceId: string; invoiceNumber: string; number: string; currency: string; totalMinor: string; issuedOn: string };
export type AdminProviderPaymentPlan = { id: string; providerOrganizationId: string; providerName: string; invoiceId: string; invoiceNumber: string; status: string; reason: string };
export type AdminProviderCollectionCase = { id: string; providerOrganizationId: string; providerName: string; invoiceId: string; invoiceNumber: string; status: string; reason: string };
export type AdminPendingBillingIntent={id:string;providerName:string;reference:string;amountMinor:string;currency:string;scanStatus:string;expired:boolean;status:string};
export type AdminProviderDashboard = { pendingBillingIntents?:AdminPendingBillingIntent[]; billingIntentsUnavailable?:boolean; capabilities: { qualificationDecision: boolean; financeAction: boolean; readOnly: boolean }; providers: AdminProvider[]; services: AdminProviderService[]; documents: AdminProviderDocument[]; statements: AdminProviderStatement[]; invoices: AdminProviderInvoice[]; payments: AdminProviderPayment[]; accounts: AdminProviderAccount[]; creditNotes: AdminProviderCreditNote[]; paymentPlans: AdminProviderPaymentPlan[]; collectionCases: AdminProviderCollectionCase[]; totalsByCurrency: Array<{ currency: string; invoicedMinor: string; outstandingMinor: string; receivedMinor: string; unallocatedMinor: string }>; limitsReached: string[] };

export function sumMoneyByCurrency(invoices: AdminProviderInvoice[], payments: AdminProviderPayment[]) {
  const totals = new Map<string, { invoiced: bigint; outstanding: bigint; received: bigint; unallocated: bigint }>();
  const at = (currency: string) => { const current = totals.get(currency) ?? { invoiced: BigInt(0), outstanding: BigInt(0), received: BigInt(0), unallocated: BigInt(0) }; totals.set(currency, current); return current; };
  for (const invoice of invoices) { const value = at(invoice.currency); value.invoiced += BigInt(invoice.totalMinor); value.outstanding += BigInt(invoice.outstandingMinor); }
  for (const payment of payments) { const value = at(payment.currency); value.received += BigInt(payment.amountMinor); value.unallocated += BigInt(payment.unallocatedMinor); }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => ({ currency, invoicedMinor: value.invoiced.toString(), outstandingMinor: value.outstanding.toString(), receivedMinor: value.received.toString(), unallocatedMinor: value.unallocated.toString() }));
}
