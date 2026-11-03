import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { uuidSchema } from "@/modules/client/data/rfq/model";

const opportunitySchema = z.object({
  id: uuidSchema, organization_id: uuidSchema, diagnostic_run_id: uuidSchema,
  recommendation_id: uuidSchema.nullable(),known_data:z.record(z.string(),z.unknown()).optional(), service_id: uuidSchema.nullable(), status: z.string(),
  missing_fields: z.array(z.unknown()), service_request_id: uuidSchema.nullable(),
}).strict();
const runSchema = z.object({ id: uuidSchema, organization_id: uuidSchema, questionnaire_session_id: uuidSchema, library_id: uuidSchema, site_id: uuidSchema.nullable() }).strict();
const serviceSchema = z.object({ id: uuidSchema, library_id: uuidSchema, current_published_version_id: uuidSchema, status: z.literal("PUBLISHED") }).strict();
const serviceVersionSchema = z.object({ id: uuidSchema, service_id: uuidSchema, library_id: uuidSchema, status: z.literal("PUBLISHED"), name_fr: z.string(), name_ar: z.string(), content_hash: z.string().regex(/^[0-9a-f]{64}$/u) }).strict();
const snapshotSchema = z.object({ questionnaire_version_id: uuidSchema, questionnaire_snapshot_hash: z.string().regex(/^[0-9a-f]{64}$/u) }).strict();
const recommendationSchema = z.object({ title_fr: z.string(), title_ar: z.string(), client_text_fr: z.string(), client_text_ar: z.string() }).strict();

export type OpportunityRequestContext = {
  opportunityId: string; organizationId: string; serviceId: string; libraryId: string;
  questionnaireVersionId: string; catalogSnapshotHash: string; questionnaireSnapshotHash: string;
  serviceNameFr: string; serviceNameAr: string; titleFr: string; titleAr: string;
  descriptionFr: string; descriptionAr: string; existingRequestId: string | null; siteId: string | null;
};

const createdSchema = z.object({ request_id:uuidSchema, status:z.string() });

export async function createRequestFromOpportunity(input:{ opportunityId:string; description:string; urgency:"LOW"|"NORMAL"|"HIGH"|"CRITICAL"; desiredDate:string|null; budgetMinor:string|null; currency:"MAD"; regionCode:string; siteId:string|null; changeReason:string; correlationId:string }):Promise<{requestId:string;status:string}|{forbidden:true}|null>{
  const client=await getSupabaseServerClient();
  const result=await client.rpc("create_service_request_from_opportunity",{p_opportunity_id:input.opportunityId,p_payload:{description:input.description,urgency:input.urgency,desired_date:input.desiredDate,budget_minor:input.budgetMinor,currency_code:input.currency,region_code:input.regionCode,site_id:input.siteId},p_change_reason:input.changeReason,p_correlation_id:input.correlationId});
  const parsed=createdSchema.safeParse(result.data);
  return result.error||!parsed.success?(result.error?.code==="42501"?{forbidden:true}:null):{requestId:parsed.data.request_id,status:parsed.data.status};
}

export async function loadOpportunityRequestContext(opportunityId: string, organizationId?: string): Promise<OpportunityRequestContext | null> {
  if (!uuidSchema.safeParse(opportunityId).success || (organizationId && !uuidSchema.safeParse(organizationId).success)) return null;
  const client = await getSupabaseServerClient();
  let opportunityQuery = client.from("diagnostic_opportunities").select("id,organization_id,diagnostic_run_id,recommendation_id,known_data,service_id,status,missing_fields,service_request_id").eq("id", opportunityId);
  if (organizationId) opportunityQuery = opportunityQuery.eq("organization_id", organizationId);
  const opportunityResult = await opportunityQuery.maybeSingle();
  const opportunity = opportunitySchema.safeParse(opportunityResult.data);
  if (opportunityResult.error || !opportunity.success || !["RFQ_READY","CONVERTED"].includes(opportunity.data.status) || !opportunity.data.service_id || opportunity.data.missing_fields.length > 0) return null;

  const [runResult, recommendationResult] = await Promise.all([
    client.from("diagnostic_runs").select("id,organization_id,questionnaire_session_id,library_id,site_id").eq("id", opportunity.data.diagnostic_run_id).eq("organization_id", opportunity.data.organization_id).maybeSingle(),
    opportunity.data.recommendation_id?client.from("diagnostic_recommendations").select("title_fr,title_ar,client_text_fr,client_text_ar").eq("id", opportunity.data.recommendation_id).eq("organization_id", opportunity.data.organization_id).maybeSingle():Promise.resolve({data:null,error:null}),
  ]);
  const run = runSchema.safeParse(runResult.data), recommendation = recommendationSchema.safeParse(recommendationResult.data);
  if (runResult.error || recommendationResult.error || !run.success || (opportunity.data.recommendation_id!==null&&!recommendation.success)) return null;

  const serviceResult = await client.from("catalog_services").select("id,library_id,current_published_version_id,status").eq("id", opportunity.data.service_id).eq("library_id", run.data.library_id).eq("status", "PUBLISHED").maybeSingle();
  const service = serviceSchema.safeParse(serviceResult.data);
  if (serviceResult.error || !service.success) return null;

  const [versionResult, snapshotResult] = await Promise.all([
    client.from("catalog_service_versions").select("id,service_id,library_id,status,name_fr,name_ar,content_hash").eq("id", service.data.current_published_version_id).eq("service_id", service.data.id).eq("library_id", service.data.library_id).eq("status", "PUBLISHED").maybeSingle(),
    client.from("questionnaire_session_snapshots").select("questionnaire_version_id,questionnaire_snapshot_hash").eq("session_id", run.data.questionnaire_session_id).eq("organization_id", opportunity.data.organization_id).maybeSingle(),
  ]);
  const version = serviceVersionSchema.safeParse(versionResult.data), snapshot = snapshotSchema.safeParse(snapshotResult.data);
  if (versionResult.error || snapshotResult.error || !version.success || !snapshot.success) return null;

  const published=opportunity.data.known_data?.published_opportunity as Record<string,unknown>|undefined;
  const field=(name:string,fallback:string)=>typeof published?.[name]==="string"&&published[name].trim()?published[name] as string:fallback;
  return {
    opportunityId: opportunity.data.id, organizationId: opportunity.data.organization_id,
    serviceId: service.data.id, libraryId: service.data.library_id,
    questionnaireVersionId: snapshot.data.questionnaire_version_id,
    catalogSnapshotHash: version.data.content_hash, questionnaireSnapshotHash: snapshot.data.questionnaire_snapshot_hash,
    serviceNameFr: version.data.name_fr, serviceNameAr: version.data.name_ar,
    titleFr:field("title_fr",recommendation.success?recommendation.data.title_fr:"Priorité issue des règles publiées"), titleAr:field("title_ar",recommendation.success?recommendation.data.title_ar:"أولوية ناتجة عن القواعد المنشورة"),
    descriptionFr:field("client_text_fr",recommendation.success?recommendation.data.client_text_fr:""), descriptionAr:field("client_text_ar",recommendation.success?recommendation.data.client_text_ar:""),
    existingRequestId: opportunity.data.service_request_id, siteId: run.data.site_id,
  };
}
