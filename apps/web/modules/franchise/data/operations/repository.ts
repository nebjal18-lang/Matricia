import { supervisionMetrics,type FranchiseSupervisionMetrics } from "../spaces/metrics";
import { providerDossiers,type ProviderDossier } from "../network/provider-dossier";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const id = z.string().uuid();

export type FranchiseOperationsSnapshot = {
  providerDossiers?:ProviderDossier[];
  metrics?:FranchiseSupervisionMetrics|null;
  requests: Array<{ id: string; status: string; title: string; urgency: string | null }>;
  matching: Array<{ id: string; requestId: string; eligible: boolean; scoreBps: number }>;
  quotes: Array<{ id: string; requestId: string; status: string; totalMinor: string | null; currency: string | null }>;
  missions: Array<{ id: string; status: string; startedAt: string | null }>;
  anomalies: Array<{ id: string; titleFr: string; titleAr: string; severity: string; status: string; code: string; blocking: boolean }>;
  recommendations: Array<{ id: string; titleFr: string; titleAr: string; priority: number; serviceId: string | null; serviceCode: string | null; solutionLevel: string }>;
  opportunities: Array<{ id: string; status: string; priority: number; serviceId: string | null; serviceCode: string | null; solutionLevel: string }>;
  qualifications: Array<{ id: string; serviceId: string; serviceCode: string | null; status: string; rowVersion?: number }>;
  capacities: Array<{ id: string; serviceId: string | null; status: string; availableUnits: number | null }>;
  documents: Array<{ id: string; kind: string; code: string; status: string }>;
  threads: Array<{ id: string; subject: string; status: string }>;
  members: Array<{ id: string; status: string; roles: string[] }>;
  disputes: Array<{ id: string; status: string; urgency: string; obligationKey: string }>;
  skus: Array<{ id: string; code: string; status: string; serviceId: string }>;
  anomalyDefinitions?: Array<{ id: string; titleFr: string; titleAr: string; severity: string; status: string }>;
  riskDefinitions?: Array<{ id: string; titleFr: string; titleAr: string; criticality: string; status: string }>;
  recommendationDefinitions?: Array<{ id: string; titleFr: string; titleAr: string; solutionLevel: string; serviceId: string }>;
  volumeProposals?: Array<{ id: string; skuId: string; status: string; paymentModel: string }>;
};

const empty: FranchiseOperationsSnapshot = {
  requests: [],
  matching: [],
  quotes: [],
  missions: [],
  anomalies: [],
  recommendations: [],
  opportunities: [],
  qualifications: [],
  capacities: [],
  documents: [],
  threads: [],
  members: [],
  disputes: [],
  skus: [],
  anomalyDefinitions: [],
  riskDefinitions: [],
  recommendationDefinitions: [],
  volumeProposals: [],
};

function rows<T>(schema: z.ZodType<T>, value: unknown): T[] {
  const parsed = z.array(schema).safeParse(value);
  if(!parsed.success)throw new Error("FRANCHISE_OPERATIONS_INVALID_RESPONSE");
  return parsed.data;
}

export async function loadFranchiseOperations(input: { libraryId: string; operatorOrganizationId?: string | null;franchiseId?:string|null }): Promise<FranchiseOperationsSnapshot> {
  if (!z.string().uuid().safeParse(input.libraryId).success) return empty;
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return empty;
  const[dossiersResult,metricsResult]=await Promise.all([input.franchiseId?client.rpc("franchise_provider_dossiers",{p_franchise_id:input.franchiseId}):Promise.resolve({data:[],error:null}),input.franchiseId?client.rpc("franchise_supervision_metrics",{p_franchise_id:input.franchiseId}):Promise.resolve({data:null,error:null})]);
  const metrics=metricsResult.data?supervisionMetrics.safeParse(metricsResult.data):null;
  if(metricsResult.error||(metrics&&!metrics.success))throw new Error("FRANCHISE_METRICS_UNAVAILABLE");
  const dossiers=providerDossiers.safeParse(dossiersResult.data);
  if(dossiersResult.error||!dossiers.success)throw new Error("FRANCHISE_PROVIDER_DOSSIERS_UNAVAILABLE");
  const [requestsResult, anomaliesResult, recommendationsResult, opportunitiesResult, qualificationsResult, capacitiesResult, documentVersionsResult, threadsResult, membersResult, missionsResult, skusResult] = await Promise.all([
    client.from("service_requests").select("id,status,service_id,library_id").eq("library_id", input.libraryId).order("updated_at", { ascending: false }).limit(100),
    client.from("diagnostic_anomalies").select("id,title_fr,title_ar,severity,status,anomaly_code,blocking,diagnostic_runs!inner(library_id)").eq("diagnostic_runs.library_id", input.libraryId).order("created_at", { ascending: false }).limit(100),
    client.from("diagnostic_recommendations").select("id,title_fr,title_ar,priority,service_id,solution_level,diagnostic_runs!inner(library_id)").eq("diagnostic_runs.library_id", input.libraryId).order("priority").limit(100),
    client.from("diagnostic_opportunities").select("id,status,priority,service_id,solution_level,diagnostic_runs!inner(library_id)").eq("diagnostic_runs.library_id", input.libraryId).order("created_at", { ascending: false }).limit(100),
    client.from("provider_qualifications").select("id,service_id,row_version,current_decision_id,catalog_services!inner(library_id)").eq("catalog_services.library_id", input.libraryId).limit(100),
    client.from("provider_capacity_versions").select("id,service_id,capacity_status,available_units,catalog_services!inner(library_id)").eq("catalog_services.library_id", input.libraryId).not("service_id", "is", null).order("version_number", { ascending: false }).limit(100),
    client.from("provider_document_versions").select("id,status,provider_document_families!inner(document_kind,code)").order("version_number", { ascending: false }).limit(100),
    client.from("internal_message_threads").select("id,subject,status,service_requests!inner(library_id)").eq("service_requests.library_id", input.libraryId).order("created_at", { ascending: false }).limit(100),
    input.operatorOrganizationId
      ? client.from("organization_memberships").select("id,status,organization_member_roles(role_code,revoked_at)").eq("organization_id", input.operatorOrganizationId).eq("status", "ACTIVE").limit(50)
      : Promise.resolve({ data: [], error: null }),
    client.from("missions").select("id,status,started_at").order("created_at", { ascending: false }).limit(50),
    client.from("service_skus").select("id,code,status,service_id,catalog_services!inner(library_id)").eq("catalog_services.library_id", input.libraryId).eq("status", "ACTIVE").limit(100),
  ]);
  if([requestsResult,anomaliesResult,recommendationsResult,opportunitiesResult,qualificationsResult,capacitiesResult,documentVersionsResult,threadsResult,membersResult,missionsResult,skusResult].some((r)=>r.error))throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const requestRows = rows(z.object({ id, status: z.string(), service_id: id }), requestsResult.data);
  const requestIds = requestRows.map((item) => item.id);
  const missionRows = rows(z.object({ id, status: z.string(), started_at: z.string().nullable() }), missionsResult.data);
  const serviceIds = [...new Set([
    ...requestRows.map((item) => item.service_id),
    ...rows(z.object({ service_id: id.nullable() }), recommendationsResult.data).flatMap((item) => item.service_id ? [item.service_id] : []),
    ...rows(z.object({ service_id: id }), qualificationsResult.data).map((item) => item.service_id),
    ...rows(z.object({ service_id: id }), skusResult.data).map((item) => item.service_id),
  ])];
  const [servicesResult, versionsResult, matchingResult, rfqsResult, disputesResult, anomalyDefResult, riskDefResult, recoDefResult, proposalResult] = await Promise.all([
    serviceIds.length
      ? client.from("catalog_services").select("id,code").in("id", serviceIds).limit(200)
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? client.from("service_request_versions").select("request_id,urgency").in("request_id", requestIds).limit(200)
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? client.from("matching_runs").select("id,request_id").in("request_id", requestIds).order("started_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? client.from("rfqs").select("id,request_id").in("request_id", requestIds).limit(100)
      : Promise.resolve({ data: [], error: null }),
    missionRows.length
      ? client.from("dispute_cases").select("id,status,urgency,obligation_key,mission_id").in("mission_id", missionRows.map((item) => item.id)).limit(100)
      : Promise.resolve({ data: [], error: null }),
    client.from("anomaly_definition_versions").select("id,definition_id,severity,title_fr,title_ar,version").eq("library_id", input.libraryId).order("version", { ascending: false }).limit(200),
    client.from("risk_definition_versions").select("id,definition_id,criticality,title_fr,title_ar,version").eq("library_id", input.libraryId).order("version", { ascending: false }).limit(200),
    client.from("recommendation_definition_versions").select("id,definition_id,service_id,solution_level,title_fr,title_ar,version").eq("library_id", input.libraryId).order("version", { ascending: false }).limit(200),
    client.from("franchise_volume_proposals").select("id,sku_id,status,payment_model").eq("library_id", input.libraryId).order("created_at", { ascending: false }).limit(100),
  ]);
  if([servicesResult,versionsResult,matchingResult,rfqsResult,disputesResult,anomalyDefResult,riskDefResult,recoDefResult,proposalResult].some((r)=>r.error))throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const serviceCodes = new Map(rows(z.object({ id, code: z.string() }), servicesResult.data).map((item) => [item.id, item.code]));
  const qualificationIdentities = rows(z.object({
    id,
    service_id: id,
    row_version: z.number(),
    current_decision_id: id.nullable(),
  }), qualificationsResult.data);
  const decisionIds = qualificationIdentities.flatMap((item) => item.current_decision_id ? [item.current_decision_id] : []);
  const decisionsResult = decisionIds.length
    ? await client.from("provider_qualification_decisions").select("id,status").in("id", decisionIds).limit(200)
    : { data: [], error: null };
  if(decisionsResult.error)throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const decisionStatus = new Map(rows(z.object({ id, status: z.string() }), decisionsResult.data).map((item) => [item.id, item.status]));
  function latestBy<T extends { definition_id: string; version: number }>(value: unknown, schema: z.ZodType<T>): T[] {
    const latest = new Map<string, T>();
    for (const item of rows(schema, value)) {
      const current = latest.get(item.definition_id);
      if (!current || item.version > current.version) latest.set(item.definition_id, item);
    }
    return [...latest.values()];
  }
  const urgencies = new Map(rows(z.object({ request_id: id, urgency: z.string() }), versionsResult.data).map((item) => [item.request_id, item.urgency]));
  const matchingRuns = rows(z.object({ id, request_id: id }), matchingResult.data);
  const candidatesResult = matchingRuns.length
    ? await client.from("matching_candidates").select("id,matching_run_id,eligible,score_basis_points").in("matching_run_id", matchingRuns.map((item) => item.id)).limit(200)
    : { data: [], error: null };
  if(candidatesResult.error)throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const runRequest = new Map(matchingRuns.map((item) => [item.id, item.request_id]));
  const rfqs = rows(z.object({ id, request_id: id }), rfqsResult.data);
  const quotesResult = rfqs.length
    ? await client.from("quotes").select("id,status,rfq_id").in("rfq_id", rfqs.map((item) => item.id)).limit(100)
    : { data: [], error: null };
  if(quotesResult.error)throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const quoteRows = rows(z.object({ id, status: z.string(), rfq_id: id }), quotesResult.data);
  const versionsQuoteResult = quoteRows.length
    ? await client.from("quote_versions").select("quote_id,total_minor,currency,version_number").in("quote_id", quoteRows.map((item) => item.id)).limit(200)
    : { data: [], error: null };
  if(versionsQuoteResult.error)throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const latestQuote = new Map<string, { totalMinor: string; currency: string; version: number }>();
  for (const version of rows(z.object({
    quote_id: id,
    total_minor: z.union([z.number(), z.string()]),
    currency: z.string(),
    version_number: z.number(),
  }), versionsQuoteResult.data)) {
    const current = latestQuote.get(version.quote_id);
    if (!current || version.version_number > current.version) {
      latestQuote.set(version.quote_id, { totalMinor: String(version.total_minor), currency: version.currency, version: version.version_number });
    }
  }
  const rfqRequest = new Map(rfqs.map((item) => [item.id, item.request_id]));
  return {
    providerDossiers:dossiers.data,
    metrics:metrics?.success?metrics.data:null,
    requests: requestRows.map((item) => ({
      id: item.id,
      status: item.status,
      title: serviceCodes.get(item.service_id) ?? item.status,
      urgency: urgencies.get(item.id) ?? null,
    })),
    matching: rows(z.object({
      id,
      matching_run_id: id,
      eligible: z.boolean(),
      score_basis_points: z.number(),
    }), candidatesResult.data).flatMap((item) => {
      const requestId = runRequest.get(item.matching_run_id);
      return requestId ? [{ id: item.id, requestId, eligible: item.eligible, scoreBps: item.score_basis_points }] : [];
    }),
    quotes: quoteRows.map((item) => {
      const total = latestQuote.get(item.id);
      return {
        id: item.id,
        requestId: rfqRequest.get(item.rfq_id) ?? item.rfq_id,
        status: item.status,
        totalMinor: total?.totalMinor ?? null,
        currency: total?.currency ?? null,
      };
    }),
    missions: missionRows.map((item) => ({
      id: item.id,
      status: item.status,
      startedAt: item.started_at,
    })),
    anomalies: rows(z.object({
      id,
      title_fr: z.string(),
      title_ar: z.string(),
      severity: z.string(),
      status: z.string(),
      anomaly_code: z.string(),
      blocking: z.boolean(),
    }), anomaliesResult.data).map((item) => ({
      id: item.id,
      titleFr: item.title_fr,
      titleAr: item.title_ar,
      severity: item.severity,
      status: item.status,
      code: item.anomaly_code,
      blocking: item.blocking,
    })),
    recommendations: rows(z.object({
      id,
      title_fr: z.string(),
      title_ar: z.string(),
      priority: z.number(),
      service_id: id.nullable(),
      solution_level: z.string(),
    }), recommendationsResult.data).map((item) => ({
      id: item.id,
      titleFr: item.title_fr,
      titleAr: item.title_ar,
      priority: item.priority,
      serviceId: item.service_id,
      serviceCode: item.service_id ? serviceCodes.get(item.service_id) ?? null : null,
      solutionLevel: item.solution_level,
    })),
    opportunities: rows(z.object({
      id,
      status: z.string(),
      priority: z.number(),
      service_id: id.nullable(),
      solution_level: z.string(),
    }), opportunitiesResult.data).map((item) => ({
      id: item.id,
      status: item.status,
      priority: item.priority,
      serviceId: item.service_id,
      serviceCode: item.service_id ? serviceCodes.get(item.service_id) ?? null : null,
      solutionLevel: item.solution_level,
    })),
    qualifications: qualificationIdentities.map((item) => ({
      id: item.id,
      serviceId: item.service_id,
      serviceCode: serviceCodes.get(item.service_id) ?? null,
      status: (item.current_decision_id ? decisionStatus.get(item.current_decision_id) : null) ?? "PENDING",
      rowVersion: item.row_version,
    })),
    capacities: rows(z.object({
      id,
      service_id: id.nullable(),
      capacity_status: z.string(),
      available_units: z.number().nullable(),
    }), capacitiesResult.data).map((item) => ({
      id: item.id,
      serviceId: item.service_id,
      status: item.capacity_status,
      availableUnits: item.available_units,
    })),
    documents: rows(z.object({
      id,
      status: z.string(),
      provider_document_families: z.object({ document_kind: z.string(), code: z.string() }),
    }), documentVersionsResult.data).map((item) => ({
      id: item.id,
      kind: item.provider_document_families.document_kind,
      code: item.provider_document_families.code,
      status: item.status,
    })),
    threads: rows(z.object({ id, subject: z.string(), status: z.string() }), threadsResult.data).map((item) => ({
      id: item.id,
      subject: item.subject,
      status: item.status,
    })),
    members: rows(z.object({
      id,
      status: z.string(),
      organization_member_roles: z.array(z.object({ role_code: z.string(), revoked_at: z.string().nullable() })).optional(),
    }), membersResult.data).map((item) => ({
      id: item.id,
      status: item.status,
      roles: (item.organization_member_roles ?? []).filter((role) => role.revoked_at === null).map((role) => role.role_code),
    })),
    disputes: rows(z.object({
      id,
      status: z.string(),
      urgency: z.string(),
      obligation_key: z.string(),
    }), disputesResult.data).map((item) => ({
      id: item.id,
      status: item.status,
      urgency: item.urgency,
      obligationKey: item.obligation_key,
    })),
    skus: rows(z.object({ id, code: z.string(), status: z.string(), service_id: id }), skusResult.data).map((item) => ({
      id: item.id,
      code: item.code,
      status: item.status,
      serviceId: item.service_id,
    })),
    anomalyDefinitions: latestBy(anomalyDefResult.data, z.object({
      id, definition_id: id, severity: z.string(), title_fr: z.string(), title_ar: z.string(), version: z.number(),
    })).map((item) => ({
      id: item.definition_id,
      titleFr: item.title_fr,
      titleAr: item.title_ar,
      severity: item.severity,
      status: item.severity,
    })),
    riskDefinitions: latestBy(riskDefResult.data, z.object({
      id, definition_id: id, criticality: z.string(), title_fr: z.string(), title_ar: z.string(), version: z.number(),
    })).map((item) => ({
      id: item.definition_id,
      titleFr: item.title_fr,
      titleAr: item.title_ar,
      criticality: item.criticality,
      status: item.criticality,
    })),
    recommendationDefinitions: latestBy(recoDefResult.data, z.object({
      id, definition_id: id, service_id: id, solution_level: z.string(), title_fr: z.string(), title_ar: z.string(), version: z.number(),
    })).map((item) => ({
      id: item.definition_id,
      titleFr: item.title_fr,
      titleAr: item.title_ar,
      solutionLevel: item.solution_level,
      serviceId: item.service_id,
    })),
    volumeProposals: rows(z.object({
      id, sku_id: id, status: z.string(), payment_model: z.string(),
    }), proposalResult.data).map((item) => ({
      id: item.id,
      skuId: item.sku_id,
      status: item.status,
      paymentModel: item.payment_model,
    })),
  };
}
