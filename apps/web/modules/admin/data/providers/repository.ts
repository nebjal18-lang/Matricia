import { z } from "zod";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { sumMoneyByCurrency, type AdminProviderDashboard } from "./model";

const id = z.string().uuid();
const money = z.union([z.string().regex(/^\d+$/u), z.number().int().nonnegative()]).transform((value): string => String(value));
const profile = z.object({ provider_organization_id: id, company_status: z.string(), overall_status: z.string(), partner_contract_status: z.string(), row_version: z.number().int().positive() });
const service = z.object({ id, provider_organization_id: id, service_id: id, request_status: z.string() });
const qualification = z.object({ id, provider_service_id: id, row_version: z.number().int().positive(), current_decision_id: id.nullable() });
const decision = z.object({ id, status: z.string() });
const catalogService = z.object({ id, code: z.string() });
const document = z.object({ id, provider_organization_id: id, family_id: id, version_number: z.number().int().positive(), status: z.string(), expires_on: z.string().nullable(), storage_object_path: z.string().optional() });
const family = z.object({ id, document_kind: z.string(), code: z.string() });
const statement = z.object({ id, provider_organization_id: id, statement_number: z.string(), period_start: z.string(), period_end: z.string(), currency: z.string(), total_minor: money });
const invoice = z.object({ id, provider_organization_id: id, statement_id: id, invoice_number: z.string(), currency: z.string(), total_minor: money, paid_minor: money, outstanding_minor: money, credited_minor: money.optional(), payment_status: z.string(), due_on: z.string() });
const payment = z.object({ id, provider_organization_id: id, payment_reference: z.string(), currency: z.string(), amount_minor: money, paid_on: z.string() });
const allocation = z.object({ payment_id: id, amount_minor: money });
const account = z.object({ id, organization_id: id, code: z.string(), currency: z.string() });
const creditNote = z.object({ id, provider_organization_id: id, invoice_id: id, credit_number: z.string(), currency: z.string(), total_minor: money, issued_on: z.string() });
const paymentPlan = z.object({ id, provider_organization_id: id, invoice_id: id, reason: z.string() });
const paymentPlanDecision = z.object({ plan_id: id, decision_version: z.number().int().positive(), status: z.string() });
const collectionCase = z.object({ id, provider_organization_id: id, invoice_id: id, reason: z.string() });
const collectionDecision = z.object({ case_id: id, decision_version: z.number().int().positive(), status: z.string() });
const eligibility = z.object({
  eligible: z.boolean(),
  reasons: z.array(z.string()),
  qualification_status: z.string(),
  decision_version: z.number().int().positive().nullable().optional(),
  rule_version: z.string().nullable().optional(),
  checked_at: z.string().nullable().optional(),
});
const supervisionNames = z.object({
  organizations: z.array(z.object({ id, display_name: z.string().min(1) })).optional(),
}).passthrough();

type Result = { status: "success"; dashboard: AdminProviderDashboard } | { status: "error"; reason: "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN" | "QUERY_FAILED" | "INVALID_RESPONSE" };
type QueryResult<T> = { status: "ok"; data: T } | { status: "error"; reason: "QUERY_FAILED" | "INVALID_RESPONSE" };

async function inBatches<T,R>(rows:readonly T[],mapper:(row:T)=>Promise<R>):Promise<R[]>{const results:R[]=[];for(let offset=0;offset<rows.length;offset+=50)results.push(...await Promise.all(rows.slice(offset,offset+50).map(mapper)));return results;}

function uniqueIds(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function fallbackName(organizationId: string): string {
  return organizationId.slice(0, 8);
}

function toMinor(value: string | number): string {
  return String(value);
}

async function readRows<T>(schema: z.ZodType<T>, result: { data: unknown; error: unknown }): Promise<QueryResult<T>> {
  if (result.error) return { status: "error", reason: "QUERY_FAILED" };
  const parsed = schema.safeParse(result.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "error", reason: "INVALID_RESPONSE" };
}

function eligibilityFrom(data: unknown, qualificationStatus: string) {
  const payload = typeof data === "string" ? (() => { try { return JSON.parse(data) as unknown; } catch { return null; } })() : data;
  const parsed = eligibility.safeParse(payload);
  return parsed.success
    ? parsed.data
    : { eligible: false, reasons: ["ELIGIBILITY_UNAVAILABLE"], qualification_status: qualificationStatus, decision_version: null, rule_version: null, checked_at: null };
}

const providerRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "FINANCE_MANAGER", "READ_ONLY_AUDITOR"] as const;

export async function loadAdminProviders(): Promise<Result> {
  const access = await loadMyPlatformAccess();
  if (access.status === "error") return { status: "error", reason: access.reason };
  if (!hasPlatformRole(access.roles, providerRoles)) return { status: "error", reason: "FORBIDDEN" };
  if (!access.requirementSatisfied) return { status: "error", reason: "MFA_REQUIRED" };
  const client = access.client;
  const roleSet = new Set([...access.roles].filter((role) => providerRoles.includes(role as (typeof providerRoles)[number])));
  const central = roleSet.has("SUPER_ADMIN") || roleSet.has("MATRICIA_ADMIN");
  const readOnly = roleSet.has("READ_ONLY_AUDITOR") && [...roleSet].every((role) => role === "READ_ONLY_AUDITOR");
  const canQualification = !readOnly && (central || roleSet.has("COMPLIANCE_MANAGER"));
  const canFinance = !readOnly && (central || roleSet.has("FINANCE_MANAGER"));

  async function allRows(table:string,columns:string,order:string,ascending=false,filter?:{column:string;ids:string[]}){
    const rows:unknown[]=[];
    for(let offset=0;offset<20000;offset+=500){
      let query=client.from(table).select(columns).order(order,{ascending});
      const tie=table==="provider_profiles"?"provider_organization_id":table==="provider_document_scan_jobs"?"storage_object_path":"id";if(order!==tie)query=query.order(tie);
      if(filter)query=query.in(filter.column,filter.ids);
      const result=await query.range(offset,offset+499);
      if(result.error||!Array.isArray(result.data))return{data:null,error:result.error??{code:"INVALID_RESPONSE"}};
      rows.push(...result.data);if(result.data.length<500)return{data:rows,error:null};
    }
    return{data:null,error:{code:"ADMIN_BOUNDED_EXPORT_JOB_REQUIRED"}};
  }
  async function byIds(table:string,columns:string,column:string,values:string[]){const rows:unknown[]=[];for(let i=0;i<values.length;i+=250){const result=await allRows(table,columns,table==="provider_document_scan_jobs"?"storage_object_path":"id",true,{column,ids:values.slice(i,i+250)});if(result.error)return result;rows.push(...(result.data??[]));}return{data:rows,error:null};}
  const [profilesResult, servicesResult, documentsResult, statementsResult, invoicesResult, paymentsResult, allocationsResult, accountsResult, creditNotesResult, plansResult, planDecisionsResult, casesResult, caseDecisionsResult] = await Promise.all([
    allRows("provider_profiles","provider_organization_id,company_status,overall_status,partner_contract_status,row_version","updated_at",false),
    allRows("provider_services","id,provider_organization_id,service_id,request_status","updated_at",false),
    allRows("provider_document_versions","id,provider_organization_id,family_id,version_number,status,expires_on,storage_object_path","created_at",false),
    allRows("provider_statements","id,provider_organization_id,statement_number,period_start,period_end,currency,total_minor","issued_at",false),
    allRows("provider_invoice_balances","id,provider_organization_id,statement_id,invoice_number,currency,total_minor,paid_minor,outstanding_minor,credited_minor,payment_status,due_on","due_on",false),
    allRows("provider_payments","id,provider_organization_id,payment_reference,currency,amount_minor,paid_on","paid_on",false),
    allRows("provider_payment_allocations","payment_id,amount_minor","created_at",false),
    allRows("financial_accounts","id,organization_id,code,currency","code",true),
    allRows("provider_credit_notes","id,provider_organization_id,invoice_id,credit_number,currency,total_minor,issued_on","issued_on",false),
    allRows("provider_payment_plans","id,provider_organization_id,invoice_id,reason","created_at",false),
    allRows("provider_payment_plan_decisions","plan_id,decision_version,status","decision_version",false),
    allRows("provider_collection_cases","id,provider_organization_id,invoice_id,reason","opened_at",false),
    allRows("provider_collection_case_decisions","case_id,decision_version,status","decision_version",false),
  ]);

  const profiles = await readRows(z.array(profile), profilesResult);
  const services = await readRows(z.array(service), servicesResult);
  const documents = await readRows(z.array(document), documentsResult);
  const statements = await readRows(z.array(statement), statementsResult);
  const invoices = await readRows(z.array(invoice), invoicesResult);
  const payments = await readRows(z.array(payment), paymentsResult);
  const allocations = await readRows(z.array(allocation), allocationsResult);
  const accounts = await readRows(z.array(account), accountsResult);
  const creditNotes = await readRows(z.array(creditNote), creditNotesResult);
  const plans = await readRows(z.array(paymentPlan), plansResult);
  const planDecisions = await readRows(z.array(paymentPlanDecision), planDecisionsResult);
  const cases = await readRows(z.array(collectionCase), casesResult);
  const caseDecisions = await readRows(z.array(collectionDecision), caseDecisionsResult);
  const parsed = [profiles, services, documents, statements, invoices, payments, allocations, accounts, creditNotes, plans, planDecisions, cases, caseDecisions];
  const failed = parsed.find((item) => item.status === "error");
  if (failed && failed.status === "error") return failed;
  if (profiles.status !== "ok" || services.status !== "ok" || documents.status !== "ok" || statements.status !== "ok" || invoices.status !== "ok" || payments.status !== "ok" || allocations.status !== "ok" || accounts.status !== "ok" || creditNotes.status !== "ok" || plans.status !== "ok" || planDecisions.status !== "ok" || cases.status !== "ok" || caseDecisions.status !== "ok") return { status: "error", reason: "INVALID_RESPONSE" };

  const serviceIds = uniqueIds(services.data.map((item) => item.service_id));
  const serviceRowIds = uniqueIds(services.data.map((item) => item.id));
  const familyIds = uniqueIds(documents.data.map((item) => item.family_id));
  const scans = documents.data.length ? await byIds("provider_document_scan_jobs","storage_object_path,scan_status","storage_object_path",documents.data.flatMap((item)=>item.storage_object_path?[item.storage_object_path]:[])) : {data:[],error:null};
  const scanRows = z.array(z.object({storage_object_path:z.string(),scan_status:z.string()})).safeParse(scans.data);
  const scanByDocument = new Map(!scans.error && scanRows.success ? scanRows.data.map((row) => [row.storage_object_path,row.scan_status] as const) : []);

  const [catalogResult, qualificationResult, familyResult, supervisionResult] = await Promise.all([
    serviceIds.length ? byIds("catalog_services","id,code","id",serviceIds) : Promise.resolve({ data: [], error: null }),
    serviceRowIds.length ? byIds("provider_qualifications","id,provider_service_id,row_version,current_decision_id","provider_service_id",serviceRowIds) : Promise.resolve({ data: [], error: null }),
    familyIds.length ? byIds("provider_document_families","id,document_kind,code","id",familyIds) : Promise.resolve({ data: [], error: null }),
    client.rpc("list_admin_provider_organization_names_v1", {p_organization_ids:profiles.data.map((item)=>item.provider_organization_id)}),
  ]);

  const catalog = catalogResult.error ? { status: "ok" as const, data: [] as z.infer<typeof catalogService>[] } : await readRows(z.array(catalogService), catalogResult);
  const qualifications = await readRows(z.array(qualification), qualificationResult);
  const families = await readRows(z.array(family), familyResult);
  if (catalog.status === "error") return catalog;
  if (qualifications.status === "error") return qualifications;
  if (families.status === "error") return families;

  const decisionIds = uniqueIds(qualifications.data.map((item) => item.current_decision_id).filter((value): value is string => value !== null));
  const decisionsResult = decisionIds.length
    ? await byIds("provider_qualification_decisions","id,status","id",decisionIds)
    : { data: [], error: null };
  const decisions = await readRows(z.array(decision), decisionsResult);
  if (decisions.status === "error") return decisions;

  const names = new Map<string, string>();
  if (!supervisionResult.error) {
    const projection = supervisionNames.safeParse(supervisionResult.data);
    if (projection.success) {
      for (const organization of projection.data.organizations ?? []) names.set(organization.id, organization.display_name);
    }
  }
  const name = (organizationId: string) => names.get(organizationId) ?? fallbackName(organizationId);
  const catalogById = new Map(catalog.data.map((item) => [item.id, item.code]));
  const qualificationByService = new Map(qualifications.data.map((item) => [item.provider_service_id, item]));
  const decisionById = new Map(decisions.data.map((item) => [item.id, item.status]));
  const familyById = new Map(families.data.map((item) => [item.id, item]));

  const eligibilityResults = await inBatches(services.data,async(item)=>await client.rpc("explain_provider_service_eligibility", { p_provider_organization_id: item.provider_organization_id, p_service_id: item.service_id }));
  const allocatedByPayment = new Map<string, bigint>();
  for (const item of allocations.data) allocatedByPayment.set(item.payment_id, (allocatedByPayment.get(item.payment_id) ?? BigInt(0)) + BigInt(toMinor(item.amount_minor)));
  if (payments.data.some((item) => (allocatedByPayment.get(item.id) ?? BigInt(0)) > BigInt(toMinor(item.amount_minor)))) return { status: "error", reason: "INVALID_RESPONSE" };

  const pendingIntentSchema=z.array(z.object({id,reference:z.string(),amount_minor:money,currency:z.string(),scan_status:z.string(),expired:z.boolean(),status:z.string()}));
  const pendingResults=canFinance?await inBatches(profiles.data,async(profile)=>{const response=await client.rpc("list_my_provider_billing_intents",{p_provider_organization_id:profile.provider_organization_id});const parsed=pendingIntentSchema.safeParse(response.data);return response.error||!parsed.success?null:parsed.data.map((item)=>({id:item.id,providerName:name(profile.provider_organization_id),reference:item.reference,amountMinor:item.amount_minor,currency:item.currency,scanStatus:item.scan_status,expired:item.expired,status:item.status}));}):[];
  const pendingBillingIntents=pendingResults.flatMap((rows)=>rows??[]);
  const billingIntentsUnavailable=pendingResults.some((rows)=>rows===null);
  const mappedInvoices = invoices.data.map((item) => ({ id: item.id, providerOrganizationId: item.provider_organization_id, providerName: name(item.provider_organization_id), statementId: item.statement_id, number: item.invoice_number, currency: item.currency, totalMinor: toMinor(item.total_minor), paidMinor: toMinor(item.paid_minor), outstandingMinor: toMinor(item.outstanding_minor), creditedMinor: toMinor(item.credited_minor ?? "0"), paymentStatus: item.payment_status, dueOn: item.due_on }));
  const mappedPayments = payments.data.map((item) => {
    const allocated = allocatedByPayment.get(item.id) ?? BigInt(0);
    const amount = BigInt(toMinor(item.amount_minor));
    return { id: item.id, providerOrganizationId: item.provider_organization_id, providerName: name(item.provider_organization_id), reference: item.payment_reference, currency: item.currency, amountMinor: toMinor(item.amount_minor), allocatedMinor: allocated.toString(), unallocatedMinor: (amount - allocated).toString(), paidOn: item.paid_on };
  });
  const limitsReached:string[]=[];

  const invoiceNumber = (invoiceId: string) => mappedInvoices.find((item) => item.id === invoiceId)?.number ?? invoiceId.slice(0, 8);
  const latestStatus = <T extends { status: string }>(rows: T[], key: (row: T) => string) => {
    const chosen = new Map<string, { version: number; status: string }>();
    for (const row of rows) {
      const id = key(row);
      const version = "decision_version" in row && typeof (row as { decision_version?: unknown }).decision_version === "number" ? (row as { decision_version: number }).decision_version : 0;
      const current = chosen.get(id);
      if (!current || version > current.version) chosen.set(id, { version, status: row.status });
    }
    return chosen;
  };
  const planStatus = latestStatus(planDecisions.data, (row) => row.plan_id);
  const caseStatus = latestStatus(caseDecisions.data, (row) => row.case_id);

  return {
    status: "success",
    dashboard: {
      capabilities: { qualificationDecision: canQualification, financeAction: canFinance, readOnly },
      providers: profiles.data.map((item) => ({ organizationId: item.provider_organization_id, organizationName: name(item.provider_organization_id), companyStatus: item.company_status, overallStatus: item.overall_status, partnerContractStatus: item.partner_contract_status, rowVersion: item.row_version })),
      services: services.data.map((item, index) => {
        const qualificationRow = qualificationByService.get(item.id) ?? null;
        const localStatus = qualificationRow?.current_decision_id ? decisionById.get(qualificationRow.current_decision_id) ?? "NOT_REQUESTED" : "NOT_REQUESTED";
        const eligibilityRow = eligibilityResults[index]?.error ? eligibilityFrom(null, localStatus) : eligibilityFrom(eligibilityResults[index]?.data, localStatus);
        return {
          id: item.id,
          providerOrganizationId: item.provider_organization_id,
          providerName: name(item.provider_organization_id),
          serviceId: item.service_id,
          serviceCode: catalogById.get(item.service_id) ?? fallbackName(item.service_id),
          requestStatus: item.request_status,
          qualificationId: qualificationRow?.id ?? null,
          qualificationRowVersion: qualificationRow?.row_version ?? null,
          qualificationStatus: eligibilityRow.qualification_status,
          eligible: eligibilityRow.eligible,
          eligibilityReasons: eligibilityRow.reasons,
          decisionVersion: eligibilityRow.decision_version ?? null,
          ruleVersion: eligibilityRow.rule_version ?? null,
          checkedAt: eligibilityRow.checked_at ?? null,
        };
      }),
      pendingBillingIntents,
      billingIntentsUnavailable,
      documents: documents.data.flatMap((item) => {
        const familyRow = familyById.get(item.family_id);
        return familyRow ? [{ id: item.id, providerOrganizationId: item.provider_organization_id, providerName: name(item.provider_organization_id), kind: familyRow.document_kind, code: familyRow.code, version: item.version_number, status: item.status, expiresOn: item.expires_on, scanStatus: scanByDocument.get(item.storage_object_path ?? "") ?? "UNKNOWN" }] : [];
      }),
      statements: statements.data.map((item) => ({ id: item.id, providerOrganizationId: item.provider_organization_id, providerName: name(item.provider_organization_id), number: item.statement_number, periodStart: item.period_start, periodEnd: item.period_end, currency: item.currency, totalMinor: toMinor(item.total_minor) })),
      invoices: mappedInvoices,
      payments: mappedPayments,
      accounts: accounts.data.map((item) => ({ id: item.id, providerOrganizationId: item.organization_id, code: item.code, currency: item.currency })),
      creditNotes: creditNotes.data.map((item) => ({ id: item.id, providerOrganizationId: item.provider_organization_id, providerName: name(item.provider_organization_id), invoiceId: item.invoice_id, invoiceNumber: invoiceNumber(item.invoice_id), number: item.credit_number, currency: item.currency, totalMinor: toMinor(item.total_minor), issuedOn: item.issued_on })),
      paymentPlans: plans.data.map((item) => ({ id: item.id, providerOrganizationId: item.provider_organization_id, providerName: name(item.provider_organization_id), invoiceId: item.invoice_id, invoiceNumber: invoiceNumber(item.invoice_id), status: planStatus.get(item.id)?.status ?? "REQUESTED", reason: item.reason })),
      collectionCases: cases.data.map((item) => ({ id: item.id, providerOrganizationId: item.provider_organization_id, providerName: name(item.provider_organization_id), invoiceId: item.invoice_id, invoiceNumber: invoiceNumber(item.invoice_id), status: caseStatus.get(item.id)?.status ?? "OPEN", reason: item.reason })),
      totalsByCurrency: sumMoneyByCurrency(mappedInvoices, mappedPayments),
      limitsReached,
    },
  };
}
