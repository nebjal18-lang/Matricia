import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { supervisionMetrics,type FranchiseSupervisionMetrics } from "../spaces/metrics";
import { providerDossiers,type ProviderDossier } from "../network/provider-dossier";
import { z } from "zod";
import { collectOperationPages, collectOperationIds } from "./paging";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const id = z.string().uuid();

export type FranchiseOperationsSnapshot = {
  permissions?:{canDecideQualifications:boolean;canMaintainDefinitions:boolean;canInstructDisputes:boolean;canProposeVolume:boolean};
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

function rows<T>(schema: z.ZodType<T>, value: unknown): T[] {
  const parsed = z.array(schema).safeParse(value);
  if(!parsed.success)throw new Error("FRANCHISE_OPERATIONS_INVALID_RESPONSE");
  return parsed.data;
}

export async function loadFranchiseOperations(input: { libraryId: string; operatorOrganizationId?: string | null;franchiseId?:string|null }): Promise<FranchiseOperationsSnapshot> {
  if (!id.safeParse(input.libraryId).success || !id.safeParse(input.franchiseId).success) throw new Error("FRANCHISE_OPERATIONS_SCOPE_REQUIRED");
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw new Error(classifyAuthReadFailure(authError)==="UNAUTHENTICATED"?"FRANCHISE_OPERATIONS_UNAUTHENTICATED":"FRANCHISE_OPERATIONS_AUTH_UNAVAILABLE");
  if (!auth.user) throw new Error("FRANCHISE_OPERATIONS_UNAUTHENTICATED");
  const[dossiersResult,metricsResult,missionResult,permissionsResult]=await Promise.all([client.rpc("franchise_provider_dossiers",{p_franchise_id:input.franchiseId}),client.rpc("franchise_supervision_metrics",{p_franchise_id:input.franchiseId}),client.rpc("franchise_operational_missions_v1",{p_franchise_id:input.franchiseId}),client.rpc("franchise_operation_permissions_v1",{p_franchise_id:input.franchiseId})]);
  const metrics=metricsResult.data?supervisionMetrics.safeParse(metricsResult.data):null;
  if(metricsResult.error||!metrics?.success||metrics.data.libraryId!==input.libraryId||metrics.data.franchiseId!==input.franchiseId)throw new Error("FRANCHISE_METRICS_UNAVAILABLE");
  const permissions=z.object({franchiseId:id,libraryId:id,canDecideQualifications:z.boolean(),canMaintainDefinitions:z.boolean(),canInstructDisputes:z.boolean(),canProposeVolume:z.boolean()}).safeParse(permissionsResult.data);
  if(permissionsResult.error||!permissions.success||permissions.data.libraryId!==input.libraryId||permissions.data.franchiseId!==input.franchiseId)throw new Error("FRANCHISE_PERMISSIONS_UNAVAILABLE");
  const missionSnapshot=z.object({complete:z.literal(true),libraryId:id,franchiseId:id,missions:z.array(z.object({id,status:z.string(),started_at:z.string().nullable()}))}).safeParse(missionResult.data);
  if(missionResult.error||!missionSnapshot.success||missionSnapshot.data.libraryId!==input.libraryId||missionSnapshot.data.franchiseId!==input.franchiseId)throw new Error("FRANCHISE_MISSIONS_UNAVAILABLE");
  const dossiers=providerDossiers.safeParse(dossiersResult.data);
  if(dossiersResult.error||!dossiers.success)throw new Error("FRANCHISE_PROVIDER_DOSSIERS_UNAVAILABLE");
  const [requestsResult, anomaliesResult, recommendationsResult, opportunitiesResult, threadsResult, membersResult, skusResult] = await Promise.all([
    collectOperationPages((from,to)=>client.from("service_requests").select("id,status,service_id,library_id,current_version_id").eq("library_id", input.libraryId).order("updated_at", { ascending: false }).order("id").range(from,to)),
    collectOperationPages((from,to)=>client.from("diagnostic_anomalies").select("id,title_fr,title_ar,severity,status,anomaly_code,blocking,diagnostic_runs!inner(library_id)").eq("diagnostic_runs.library_id", input.libraryId).order("created_at", { ascending: false }).order("id").range(from,to)),
    collectOperationPages((from,to)=>client.from("diagnostic_recommendations").select("id,title_fr,title_ar,priority,service_id,solution_level,diagnostic_runs!inner(library_id)").eq("diagnostic_runs.library_id", input.libraryId).order("priority").order("id").range(from,to)),
    collectOperationPages((from,to)=>client.from("diagnostic_opportunities").select("id,status,priority,service_id,solution_level,diagnostic_runs!inner(library_id)").eq("diagnostic_runs.library_id", input.libraryId).order("created_at", { ascending: false }).order("id").range(from,to)),
    collectOperationPages((from,to)=>client.from("internal_message_threads").select("id,subject,status,service_requests!inner(library_id)").eq("service_requests.library_id", input.libraryId).order("created_at", { ascending: false }).order("id").range(from,to)),
    input.operatorOrganizationId
      ? collectOperationPages((from,to)=>client.from("organization_memberships").select("id,status,organization_member_roles(role_code,revoked_at)").eq("organization_id", input.operatorOrganizationId).eq("status", "ACTIVE").order("id").range(from,to))
      : Promise.resolve({ data: [], error: null }),
    collectOperationPages((from,to)=>client.from("service_skus").select("id,code,status,service_id,catalog_services!inner(library_id)").eq("catalog_services.library_id", input.libraryId).eq("status", "ACTIVE").order("id").range(from,to)),
  ]);
  if([requestsResult,anomaliesResult,recommendationsResult,opportunitiesResult,threadsResult,membersResult,skusResult].some((r)=>r.error))throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const requestRows = rows(z.object({ id, status: z.string(), service_id: id, current_version_id:id.nullable() }), requestsResult.data);
  const requestIds = requestRows.map((item) => item.id);
  const missionRows = missionSnapshot.data.missions;
  const serviceIds = [...new Set([
    ...requestRows.map((item) => item.service_id),
    ...rows(z.object({ service_id: id.nullable() }), recommendationsResult.data).flatMap((item) => item.service_id ? [item.service_id] : []),
    ...dossiers.data.flatMap(provider=>provider.qualifications.map(qualification=>qualification.serviceId)),
    ...rows(z.object({ service_id: id }), skusResult.data).map((item) => item.service_id),
  ])];
  const [servicesResult, versionsResult, matchingResult, rfqsResult, disputesResult, anomalyDefResult, riskDefResult, recoDefResult, proposalResult] = await Promise.all([
    serviceIds.length
      ? collectOperationIds(serviceIds,(ids,from,to)=>client.from("catalog_services").select("id,code").in("id", ids).order("id").range(from,to))
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? collectOperationIds(requestIds,(ids,from,to)=>client.from("service_request_versions").select("id,request_id,urgency").in("request_id", ids).order("id").range(from,to))
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? collectOperationIds(requestIds,(ids,from,to)=>client.from("matching_runs").select("id,request_id").in("request_id", ids).order("started_at", { ascending: false }).order("id").range(from,to))
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? collectOperationIds(requestIds,(ids,from,to)=>client.from("rfqs").select("id,request_id").in("request_id", ids).order("id").range(from,to))
      : Promise.resolve({ data: [], error: null }),
    missionRows.length
      ? collectOperationIds(missionRows.map((item) => item.id),(ids,from,to)=>client.from("dispute_cases").select("id,status,urgency,obligation_key,mission_id").in("mission_id", ids).order("id").range(from,to))
      : Promise.resolve({ data: [], error: null }),
    collectOperationPages((from,to)=>client.from("anomaly_definition_versions").select("id,definition_id,severity,title_fr,title_ar,version").eq("library_id", input.libraryId).order("version", { ascending: false }).order("id").range(from,to)),
    collectOperationPages((from,to)=>client.from("risk_definition_versions").select("id,definition_id,criticality,title_fr,title_ar,version").eq("library_id", input.libraryId).order("version", { ascending: false }).order("id").range(from,to)),
    collectOperationPages((from,to)=>client.from("recommendation_definition_versions").select("id,definition_id,service_id,solution_level,title_fr,title_ar,version").eq("library_id", input.libraryId).order("version", { ascending: false }).order("id").range(from,to)),
    collectOperationPages((from,to)=>client.from("franchise_volume_proposals").select("id,sku_id,status,payment_model").eq("library_id", input.libraryId).order("created_at", { ascending: false }).order("id").range(from,to)),
  ]);
  if([servicesResult,versionsResult,matchingResult,rfqsResult,disputesResult,anomalyDefResult,riskDefResult,recoDefResult,proposalResult].some((r)=>r.error))throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const serviceCodes = new Map(rows(z.object({ id, code: z.string() }), servicesResult.data).map((item) => [item.id, item.code]));
  function latestBy<T extends { definition_id: string; version: number }>(value: unknown, schema: z.ZodType<T>): T[] {
    const latest = new Map<string, T>();
    for (const item of rows(schema, value)) {
      const current = latest.get(item.definition_id);
      if (!current || item.version > current.version) latest.set(item.definition_id, item);
    }
    return [...latest.values()];
  }
  const urgencies = new Map(rows(z.object({ id, request_id: id, urgency: z.string() }), versionsResult.data).map((item) => [item.id, item.urgency]));
  const matchingRuns = rows(z.object({ id, request_id: id }), matchingResult.data);
  const candidatesResult = matchingRuns.length
    ? await collectOperationIds(matchingRuns.map((item) => item.id),(ids,from,to)=>client.from("matching_candidates").select("id,matching_run_id,eligible,score_basis_points").in("matching_run_id", ids).order("id").range(from,to))
    : { data: [], error: null };
  if(candidatesResult.error)throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const runRequest = new Map(matchingRuns.map((item) => [item.id, item.request_id]));
  const rfqs = rows(z.object({ id, request_id: id }), rfqsResult.data);
  const quotesResult = rfqs.length
    ? await collectOperationIds(rfqs.map((item) => item.id),(ids,from,to)=>client.from("quotes").select("id,status,rfq_id").in("rfq_id", ids).order("id").range(from,to))
    : { data: [], error: null };
  if(quotesResult.error)throw new Error("FRANCHISE_OPERATIONS_QUERY_FAILED");
  const quoteRows = rows(z.object({ id, status: z.string(), rfq_id: id }), quotesResult.data);
  const versionsQuoteResult = quoteRows.length
    ? await collectOperationIds(quoteRows.map((item) => item.id),(ids,from,to)=>client.from("quote_versions").select("quote_id,total_minor,currency,version_number").in("quote_id", ids).order("id").range(from,to))
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
    permissions:permissions.data,
    providerDossiers:dossiers.data,
    metrics:metrics?.success?metrics.data:null,
    requests: requestRows.map((item) => ({
      id: item.id,
      status: item.status,
      title: serviceCodes.get(item.service_id) ?? item.status,
      urgency: item.current_version_id ? urgencies.get(item.current_version_id) ?? null : null,
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
    qualifications: dossiers.data.flatMap(provider=>provider.qualifications.map(item=>({id:item.id,serviceId:item.serviceId,serviceCode:item.serviceCode,status:item.status,rowVersion:item.rowVersion}))),
    capacities: dossiers.data.flatMap(provider=>provider.capacities.map(item=>({id:item.id,serviceId:item.serviceId,status:item.status,availableUnits:item.availableUnits}))),
    documents: dossiers.data.flatMap(provider=>provider.documents.map(document=>({id:document.id,kind:document.kind,code:document.code,status:document.status}))),
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
