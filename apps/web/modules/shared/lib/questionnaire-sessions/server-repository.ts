import {z}from"zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { createQuestionnaireSessionsRepository,questionnaireRoles,type QuestionnaireAudience } from "./repository";

export async function createServerQuestionnaireSessionsRepository(audience:QuestionnaireAudience="CLIENT") {
  const client = await getSupabaseServerClient();
  return createQuestionnaireSessionsRepository({
    async user() { const { data, error } = await client.auth.getUser(); return error ? null : data.user?.id ?? null; },
    async memberships(userId) { return client.from("organization_memberships").select("id,organization_id").eq("user_id", userId).eq("status", "ACTIVE").limit(100); },
    async roles(ids) { return ids.length ? client.from("organization_member_roles").select("membership_id,role_code,revoked_at").in("membership_id", ids).in("role_code", questionnaireRoles(audience)).limit(300) : { data: [], error: null }; },
    async organizations(ids) { return ids.length ? client.from("organizations").select("id,display_name").in("id", ids).order("display_name").limit(100) : { data: [], error: null }; },
    async documents(ids) { if(audience==="PROVIDER")return ids.length?client.rpc("list_provider_questionnaire_documents_v1",{p_provider_organization_id:ids[0]}):{data:[],error:null};return ids.length ? client.from("client_compliance_documents").select("id,organization_id,original_file_name,document_type,declared_mime_type,status").in("organization_id", ids).in("status", ["PENDING_REVIEW", "VERIFIED"]).order("updated_at", { ascending: false }).limit(100) : { data: [], error: null }; },
    async publishedVersions(organizationId) {
      const query=client.from("questionnaire_versions").select("id,version,status,audience,title_fr,title_ar,description_fr,description_ar").eq("status","PUBLISHED").eq("audience",audience).order("published_at",{ascending:false}).limit(50);
      if(audience==="CLIENT")return query;
      if(!organizationId)return{data:[],error:null};
      const services=await client.from("provider_services").select("catalog_services!inner(library_id)").eq("provider_organization_id",organizationId);
      const parsed=z.array(z.object({catalog_services:z.object({library_id:z.string().uuid()})})).safeParse(services.data);
      if(services.error||!parsed.success)return{data:null,error:{code:"PROVIDER_SERVICE_SCOPE_UNAVAILABLE"}};
      const libraries=[...new Set(parsed.data.map(item=>item.catalog_services.library_id))];
      return libraries.length?query.in("library_id",libraries):{data:[],error:null};
    },
    async sessions(userId, organizationId) { return client.from("questionnaire_sessions").select("id,organization_id,actor_user_id,questionnaire_version_id,status,locale,updated_at,submitted_at,row_version").eq("actor_user_id", userId).eq("organization_id", organizationId).eq("is_simulation", false).eq("audience",audience).order("updated_at", { ascending: false }).limit(100); },
    async versions(ids) { return ids.length ? client.from("questionnaire_versions").select("id,version,status,audience,title_fr,title_ar,description_fr,description_ar").in("id", ids).limit(100) : { data: [], error: null }; },
    async latestDraft(userId, organizationId) { return client.from("questionnaire_sessions").select("id,organization_id,actor_user_id,questionnaire_version_id,status,locale,updated_at,submitted_at,row_version").eq("actor_user_id", userId).eq("organization_id", organizationId).eq("is_simulation", false).eq("audience",audience).in("status", ["DRAFT", "IN_PROGRESS", "READY"]).order("updated_at", { ascending: false }).order("id").limit(1); },
    async session(id) { return client.from("questionnaire_sessions").select("id,organization_id,actor_user_id,questionnaire_version_id,status,locale,updated_at,submitted_at,row_version").eq("id", id).eq("is_simulation", false).eq("audience",audience).limit(1); },
    async sections(versionId) { return client.from("questionnaire_sections").select("id,label_fr,label_ar,help_fr,help_ar,sort_order").eq("questionnaire_version_id", versionId).order("sort_order").limit(101); },
    async questionLinks(versionId) { return client.from("questionnaire_version_questions").select("section_id,question_version_id,sort_order,required_override").eq("questionnaire_version_id", versionId).order("sort_order").limit(101); },
    async questions(ids) { return ids.length ? client.from("question_versions").select("id,label_fr,label_ar,help_fr,help_ar,why_we_ask_fr,why_we_ask_ar,answer_type,data_key,prefill_source,sensitivity,required_by_default,options,validation_schema,structured_schema,nullable").in("id", ids).limit(100) : { data: [], error: null }; },
    async answers(sessionId) { return client.from("questionnaire_answers").select("id,question_version_id,current_revision_id,row_version").eq("session_id", sessionId).limit(100); },
    async revisions(ids) { return ids.length ? client.from("questionnaire_answer_revisions").select("id,value,answered_at,expires_at").in("id", ids).limit(100) : { data: [], error: null }; },
    async presentation(sessionId) { return client.rpc("questionnaire_session_presentation", { p_session_id: sessionId }); },
    async prefills(sessionId) { return client.rpc("questionnaire_prefill_suggestions", { p_session_id: sessionId }); },
    async rpc(name, input) { return client.rpc(name, input); },
  },audience);
}
