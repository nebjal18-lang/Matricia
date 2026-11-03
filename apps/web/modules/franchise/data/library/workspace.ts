import {catalogPageArguments,catalogPageSchema,scopedIds,referencedQuestionVersions,type CatalogPageInput} from "./server-page";
import { collectCatalogPages } from "./paged-query";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { catalogEffectiveStatus } from "./workspace-model";
import { z } from "zod";
import { mandateChoicesSchema,mandateChoiceOptions } from "./mandate-choices";
import { serviceFulfillmentRecordSchema } from "./service-deliverables";
import { overlayFranchiseLibraryDemo } from "@/modules/franchise/data/library/demo-overlay";
import {
  type FranchiseCatalogRow,
  type FranchiseCategoryNode,
  type FranchiseLibraryLoadResult,
  type FranchiseQuestionRow,
} from "@/modules/franchise/data/library/workspace-model";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type {
  FranchiseCatalogKind,
  FranchiseCatalogRow,
  FranchiseCategoryNode,
  FranchiseHierarchyNode,
  FranchiseLibraryLoadResult,
  FranchiseLibraryWorkspace,
  FranchiseQuestionRow,
  FranchiseServiceCommand,
} from "@/modules/franchise/data/library/workspace-model";
export { catalogStatusLabel, catalogStatusTone } from "@/modules/franchise/data/library/workspace-model";

const id = z.string().uuid();
const franchiseRow = z.object({
 activation_mode:z.enum(["CONTRACTUAL","NON_CONTRACTUAL_DEMO"]).nullable().optional(),
  id,
  library_id: id,
  operator_organization_id: id,
  franchise_type: z.enum(["IT", "STANDARD"]),
  operator_code: z.string(),
  status: z.string(),
});
const membershipRow = z.object({
  organization_id: id,
  organization_member_roles: z.array(z.object({ role_code: z.string(), franchise_id: id.nullable(), revoked_at: z.string().nullable(), organization_member_franchise_assignments:z.array(z.object({franchise_id:id,revoked_at:z.string().nullable()})).optional() })),
});
const libraryRow = z.object({
  id,
  code: z.string(),
  status: z.string(),
  row_version: z.number().int().positive(),
  current_draft_version_id: id.nullable(),
  current_published_version_id: id.nullable(),
  current_release_id: id.nullable(),
});
const libraryVersionRow = z.object({ id, library_id: id, name_fr: z.string(), name_ar: z.string(), version: z.number().int() });
const jsonObject = z.record(z.string(), z.unknown());
const serviceRow = z.object({
  id,
  library_id: id,
  primary_subcategory_id: id,
  code: z.string(),
  slug: z.string(),
  status: z.string(),
  row_version: z.number().int().positive(),
  current_draft_version_id: id.nullable(),
  current_published_version_id: id.nullable(),
});
const serviceVersionRow = z.object({
  id,
  service_id: id,
  version: z.number().int(),
  status: z.string(),
  row_version: z.number().int().positive(),
  name_fr: z.string(),
  name_ar: z.string(),
  short_description_fr: z.string(),
  short_description_ar: z.string(),
  long_description_fr: z.string(),
  long_description_ar: z.string(),
  service_type: z.string(),
  unit_label_fr: z.string(),
  unit_label_ar: z.string(),
  credit_eligible: z.boolean(),
  volume_eligible: z.boolean(),
  recurring_eligible: z.boolean(),
  trial_eligible: z.boolean(),
  rfq_required: z.boolean(),
  fixed_fulfillment_allowed: z.boolean(),
  base_currency: z.string(),
  sort_order: z.number().int(),
  fulfillment_config: serviceFulfillmentRecordSchema,
  visibility_rules: jsonObject,
  sensitive: z.boolean(),
  slug: z.string(),
});
const questionnaireRow = z.object({
  id,
  library_id: id,
  code: z.string(),
  status: z.string(),
  row_version: z.number().int().positive(),
  current_draft_version_id: id.nullable(),
  current_published_version_id: id.nullable(),
});
const questionnaireVersionRow = z.object({
  id,
  questionnaire_id: id,
  version: z.number().int(),
  status: z.string(),
  row_version: z.number().int().positive(),
  title_fr: z.string(),
  title_ar: z.string(),
});
const ruleRow = z.object({
  id,
  library_id: id,
  rule_key: z.string(),
  status: z.string(),
  row_version: z.number().int().positive(),
  current_draft_version_id: id.nullable(),
  current_published_version_id: id.nullable(),
});
const ruleVersionRow = z.object({
  id,
  rule_id: id,
  version: z.number().int(),
  status: z.string(),
  row_version: z.number().int().positive(),
  actions: z.array(z.object({ type: z.string(), target: z.string().optional() }).passthrough()),
  condition_ast: jsonObject, dependency_graph: jsonObject, priority: z.number().int(), sensitive: z.boolean(),
});
const questionRow = z.object({ id, library_id: id, question_key: z.string(), status: z.string(), current_draft_version_id: id.nullable(), current_published_version_id: id.nullable() });
const questionVersionRow = z.object({
  id,
  question_id: id,
  version: z.number().int(),
  status: z.string(),
  label_fr: z.string(),
  label_ar: z.string(),
  help_fr: z.string().nullable(),
  help_ar: z.string().nullable(),
  answer_type: z.string(),
  required_by_default: z.boolean(),
  source_service_id: id.nullable(),
});
const questionnaireQuestionRow = z.object({ questionnaire_version_id: id, question_version_id: id, section_id: id, required_override: z.boolean().nullable(), sort_order: z.number().int() });
const categoryRow = z.object({ id, library_id: id, code: z.string(), status: z.string(), row_version: z.number().int().positive(), current_draft_version_id: id.nullable(), current_published_version_id: id.nullable() });
const categoryVersionRow = z.object({ id, category_id: id, name_fr: z.string(), name_ar: z.string(), status: z.string().optional(), row_version: z.number().int().positive().optional() });
const subcategoryRow = z.object({ id, library_id: id, category_id: id, code: z.string(), status: z.string(), row_version: z.number().int().positive(), current_draft_version_id: id.nullable(), current_published_version_id: id.nullable() });
const subcategoryVersionRow = z.object({ id, subcategory_id: id, name_fr: z.string(), name_ar: z.string(), status: z.string().optional(), row_version: z.number().int().positive().optional() });
const releaseRow = z.object({ id, library_id: id, release_key: z.string(), status: z.string() });
const changeRow = z.object({ id,target_id:id,target_type:z.string(),target_version_id:id,status:z.string(),requested_at:z.string(),reviewed_at:z.string().nullable(),review_comment:z.string().nullable() });

const franchiseRoles = ["FRANCHISE_OWNER", "FRANCHISE_MANAGER", "FRANCHISE_EXPERT", "FRANCHISE_PROVIDER_MANAGER", "FRANCHISE_ACCOUNTING", "FRANCHISE_VIEWER"] as const;

async function loadFranchiseLibraryWorkspaceUnchecked(input: { locale: "fr" | "ar"; organizationId?: string;franchiseId?:string;libraryId?:string;catalog?:CatalogPageInput }): Promise<FranchiseLibraryLoadResult> {
  const client = await getSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure) return { status: "error", reason: authFailure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "QUERY_FAILED" };
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const [franchisesResult, membershipsResult] = await Promise.all([
    collectCatalogPages((from,to)=>client.from("franchises").select("id,library_id,operator_organization_id,franchise_type,operator_code,status,activation_mode").eq("status", "ACTIVE").order("created_at", { ascending: false }).order("id").range(from,to)),
    collectCatalogPages((from,to)=>client.from("organization_memberships").select("organization_id,organization_member_roles(role_code,franchise_id,revoked_at,organization_member_franchise_assignments(franchise_id,revoked_at))").eq("user_id", auth.user.id).eq("status", "ACTIVE").order("id").range(from,to)),
  ]);
  if (franchisesResult.error || membershipsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const franchises = z.array(franchiseRow).safeParse(franchisesResult.data);
  const memberships = z.array(membershipRow).safeParse(membershipsResult.data);
  if (!franchises.success || !memberships.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const roles = memberships.data.flatMap((member) => member.organization_member_roles
    .filter((role) => role.revoked_at === null && franchiseRoles.includes(role.role_code as (typeof franchiseRoles)[number]))
    .flatMap((role) => role.organization_member_franchise_assignments?.length?role.organization_member_franchise_assignments.filter((a)=>a.revoked_at===null).map((a)=>({organizationId:member.organization_id,franchiseId:a.franchise_id})):[{ organizationId: member.organization_id, franchiseId: role.franchise_id }]));
  const allowed = franchises.data.filter((item) => roles.some((role) => role.organizationId === item.operator_organization_id && (role.franchiseId === item.id || (role.franchiseId === null && franchises.data.filter((f)=>f.operator_organization_id===item.operator_organization_id).length===1))));
  if (!allowed.length) return { status: "error", reason: "NO_MANDATE" };
  const choicesResult=await client.rpc("franchise_mandate_choices_v1",{p_organization_id:input.organizationId??null});
  if(choicesResult.error)return{status:"error",reason:choicesResult.error.code==="42501"?"FORBIDDEN":"QUERY_FAILED"};
  const choices=mandateChoicesSchema.safeParse(choicesResult.data);
  if(!choices.success)return{status:"error",reason:"INVALID_RESPONSE"};
  const availableMandates=mandateChoiceOptions(choices.data,input.locale);
  if(availableMandates.some(option=>!allowed.some(f=>f.id===option.id&&f.library_id===option.libraryId&&f.operator_organization_id===option.organizationId)))return{status:"error",reason:"INVALID_RESPONSE"};
  const candidates = allowed.filter((item)=>availableMandates.some(option=>option.id===item.id)).filter((item)=>(!input.organizationId||item.operator_organization_id===input.organizationId)&&(!input.franchiseId||item.id===input.franchiseId)&&(!input.libraryId||item.library_id===input.libraryId));
  if (candidates.length > 1 && !input.franchiseId) return { status: "error", reason: "MANDATE_REQUIRED", availableMandates: availableMandates.filter(option=>candidates.some(item=>item.id===option.id)) };
  const selected = candidates[0];
  if (!selected) return { status: "error", reason: input.organizationId || input.franchiseId || input.libraryId ? "FORBIDDEN" : "NO_MANDATE" };
  const libraryId = selected.library_id;
  const pageResponse=await client.rpc("franchise_catalog_page",catalogPageArguments(selected.id,input.catalog));
  if(pageResponse.error)return{status:"error",reason:pageResponse.error.code==="42501"?"FORBIDDEN":"QUERY_FAILED"};
  const pageParsed=catalogPageSchema.safeParse(pageResponse.data);if(!pageParsed.success)return{status:"error",reason:"INVALID_RESPONSE"};
  const serverPage=pageParsed.data;const groups=serverPage.groups;
  const ids=(kind:keyof typeof groups)=>scopedIds(groups[kind].ids);
  const scopedQuestionnaireVersions=scopedIds(groups.QUESTIONNAIRE.versionIds);
  const loadBank=input.catalog?.kind==="QUESTIONNAIRE"||input.catalog?.kind==="RULE";
  const bankReplies=loadBank?await Promise.all([client.rpc("franchise_catalog_bank",{p_franchise_id:selected.id,p_kind:"QUESTION",p_search:"",p_page:1}),client.rpc("franchise_catalog_bank",{p_franchise_id:selected.id,p_kind:"RULE",p_search:"",p_page:1})]):[];
  const bankSchema=z.object({items:z.array(z.object({id,objectId:id}))});
  const banks=bankReplies.map(response=>{const parsed=bankSchema.safeParse(response.data);if(response.error)throw new Error("FRANCHISE_CATALOG_QUERY_FAILED");if(!parsed.success)throw new Error("FRANCHISE_CATALOG_INVALID_RESPONSE");return parsed.data.items;});
  const questionBankIds=banks[0]?.map(item=>item.id)??[];const ruleBankIds=banks[1]?.map(item=>item.id)??[];
  const sectionsResult = await collectCatalogPages((from, to) => client.from("questionnaire_sections").select("id,questionnaire_version_id,section_key,label_fr,label_ar,help_fr,help_ar,sort_order,questionnaire_versions!inner(library_id)").eq("questionnaire_versions.library_id", libraryId).in("questionnaire_version_id",scopedQuestionnaireVersions).order("sort_order").order("id").range(from, to));
  if (sectionsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const sectionsParsed = z.array(z.object({id, questionnaire_version_id:id,section_key:z.string(),label_fr:z.string(),label_ar:z.string(),help_fr:z.string().nullable(),help_ar:z.string().nullable(),sort_order:z.number()})).safeParse(sectionsResult.data);
  if (!sectionsParsed.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const compositionRulesResult = await collectCatalogPages((from,to)=>client.from("questionnaire_version_rules").select("questionnaire_version_id,rule_version_id,evaluation_order").eq("library_id",libraryId).in("questionnaire_version_id",scopedQuestionnaireVersions).order("questionnaire_version_id").order("evaluation_order").range(from,to));
  if(compositionRulesResult.error)return{status:"error",reason:"QUERY_FAILED"};
  const compositionRules=z.array(z.object({questionnaire_version_id:id,rule_version_id:id,evaluation_order:z.number().int()})).safeParse(compositionRulesResult.data);
  if(!compositionRules.success)return{status:"error",reason:"INVALID_RESPONSE"};
  const [libraryResult, libraryVersionsResult, servicesResult, serviceVersionsResult, questionnairesResult, questionnaireVersionsResult, rulesResult, ruleVersionsResult, questionsResult, questionVersionsResult, questionnaireQuestionsResult, categoriesResult, categoryVersionsResult, subcategoriesResult, subcategoryVersionsResult, releasesResult, changesResult] = await Promise.all([
    client.from("catalog_libraries").select("id,code,status,row_version,current_draft_version_id,current_published_version_id,current_release_id").eq("id", libraryId).limit(1),
    collectCatalogPages((from,to)=>client.from("catalog_library_versions").select("id,library_id,name_fr,name_ar,version").eq("library_id", libraryId).order("version", { ascending: false }).order("id").range(from,to)),
    collectCatalogPages((from,to)=>client.from("catalog_services").select("id,library_id,primary_subcategory_id,code,slug,status,row_version,current_draft_version_id,current_published_version_id").eq("library_id", libraryId).in("id",ids("SERVICE")).order("code").order("id").range(from,to)),
    collectCatalogPages((from,to)=>client.from("catalog_service_versions").select("id,service_id,version,status,row_version,name_fr,name_ar,short_description_fr,short_description_ar,long_description_fr,long_description_ar,service_type,unit_label_fr,unit_label_ar,credit_eligible,volume_eligible,recurring_eligible,trial_eligible,rfq_required,fixed_fulfillment_allowed,base_currency,sort_order,fulfillment_config,visibility_rules,sensitive,slug").eq("library_id", libraryId).in("service_id",ids("SERVICE")).order("version", { ascending: false }).order("id").range(from,to)),
    collectCatalogPages((from, to) => client.from("questionnaires").select("id,library_id,code,status,row_version,current_draft_version_id,current_published_version_id").eq("library_id", libraryId).in("id",ids("QUESTIONNAIRE")).order("code").order("id").range(from, to)),
    collectCatalogPages((from, to) => client.from("questionnaire_versions").select("id,questionnaire_id,version,status,row_version,title_fr,title_ar").eq("library_id", libraryId).in("questionnaire_id",ids("QUESTIONNAIRE")).order("version", { ascending: false }).order("id").range(from, to)),
    collectCatalogPages((from, to) => client.from("question_rules").select("id,library_id,rule_key,status,row_version,current_draft_version_id,current_published_version_id").eq("library_id", libraryId).in("id",ids("RULE")).order("rule_key").order("id").range(from, to)),
    collectCatalogPages((from, to) => client.from("question_rule_versions").select("id,rule_id,version,status,row_version,actions,condition_ast,dependency_graph,priority,sensitive").eq("library_id", libraryId).in("rule_id",ids("RULE")).order("version", { ascending: false }).order("id").range(from, to)),
    collectCatalogPages((from, to) => client.from("question_bank_questions").select("id,library_id,question_key,status,current_draft_version_id,current_published_version_id").eq("library_id", libraryId).in("id",ids("QUESTION")).order("question_key").order("id").range(from, to)),
    collectCatalogPages((from, to) => client.from("question_versions").select("id,question_id,version,status,label_fr,label_ar,help_fr,help_ar,answer_type,required_by_default,source_service_id").eq("library_id", libraryId).in("question_id",ids("QUESTION")).order("version", { ascending: false }).order("id").range(from, to)),
    collectCatalogPages((from, to) => client.from("questionnaire_version_questions").select("questionnaire_version_id,question_version_id,section_id,required_override,sort_order").eq("library_id", libraryId).in("questionnaire_version_id",scopedQuestionnaireVersions).order("questionnaire_version_id").order("sort_order").range(from, to)),
    collectCatalogPages((from,to)=>client.from("catalog_categories").select("id,library_id,code,status,row_version,current_draft_version_id,current_published_version_id").eq("library_id", libraryId).order("code").order("id").range(from,to)),
    collectCatalogPages((from,to)=>client.from("catalog_category_versions").select("id,category_id,name_fr,name_ar,status,row_version").eq("library_id", libraryId).order("id").range(from,to)),
    collectCatalogPages((from,to)=>client.from("catalog_subcategories").select("id,library_id,category_id,code,status,row_version,current_draft_version_id,current_published_version_id").eq("library_id", libraryId).order("code").order("id").range(from,to)),
    collectCatalogPages((from,to)=>client.from("catalog_subcategory_versions").select("id,subcategory_id,name_fr,name_ar,status,row_version").eq("library_id", libraryId).order("id").range(from,to)),
    collectCatalogPages((from,to)=>client.from("catalog_releases").select("id,library_id,release_key,status").eq("library_id", libraryId).order("created_at", { ascending: false }).order("id").range(from,to)),
    collectCatalogPages((from,to)=>client.from("catalog_change_requests").select("id,target_id,target_type,target_version_id,status,requested_at,reviewed_at,review_comment").eq("library_id",libraryId).in("target_id",scopedIds([...groups.SERVICE.ids,...groups.QUESTIONNAIRE.ids,...groups.RULE.ids])).order("requested_at",{ascending:false}).order("id").range(from,to)),
  ]);
  if (libraryResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const library = z.array(libraryRow).max(1).safeParse(libraryResult.data ?? []);
  if (!library.success || !library.data[0]) return { status: "error", reason: "FORBIDDEN" };
  if (library.data[0].id !== libraryId) return { status: "error", reason: "FORBIDDEN" };
  const optional = <T,>(result: { data: unknown; error: unknown }, schema: z.ZodType<T[]>) => {
    if (result.error) throw new Error("FRANCHISE_CATALOG_QUERY_FAILED");
    const parsed = schema.safeParse(result.data);
    if (!parsed.success) throw new Error("FRANCHISE_CATALOG_INVALID_RESPONSE");
    return parsed.data;
  };
  const libraryVersions = optional(libraryVersionsResult, z.array(libraryVersionRow));
  const services = optional(servicesResult, z.array(serviceRow));
  const serviceVersions = optional(serviceVersionsResult, z.array(serviceVersionRow));
  const questionnaires = optional(questionnairesResult, z.array(questionnaireRow));
  const questionnaireVersions = optional(questionnaireVersionsResult, z.array(questionnaireVersionRow));
  let rules = optional(rulesResult, z.array(ruleRow));
  let ruleVersions = optional(ruleVersionsResult, z.array(ruleVersionRow));
  const questions = optional(questionsResult, z.array(questionRow));
  let questionVersions = optional(questionVersionsResult, z.array(questionVersionRow));
  const questionnaireQuestions = optional(questionnaireQuestionsResult, z.array(questionnaireQuestionRow));
  const categoryItems = optional(categoriesResult, z.array(categoryRow));
  const categoryVersions = optional(categoryVersionsResult, z.array(categoryVersionRow));
  const subcategoryItems = optional(subcategoriesResult, z.array(subcategoryRow));
  const subcategoryVersions = optional(subcategoryVersionsResult, z.array(subcategoryVersionRow));
  const releases = optional(releasesResult, z.array(releaseRow));
  const changes = optional(changesResult, z.array(changeRow));
  const locale = input.locale;
  const namedLibrary = libraryVersions.find((item) => item.id === library.data[0]!.current_published_version_id) ?? libraryVersions.find((item) => item.id === library.data[0]!.current_draft_version_id) ?? libraryVersions[0];
  const q = `?organizationId=${selected.operator_organization_id}&franchiseId=${selected.id}`;
  const pinnedRuleIds=[...new Set([...compositionRules.data.map(r=>r.rule_version_id),...ruleBankIds])].filter(id=>!ruleVersions.some(r=>r.id===id));
  for(let offset=0;offset<pinnedRuleIds.length;offset+=100){const response=await client.from("question_rule_versions").select("id,rule_id,version,status,row_version,actions,condition_ast,dependency_graph,priority,sensitive").eq("library_id",libraryId).in("id",pinnedRuleIds.slice(offset,offset+100));ruleVersions=[...ruleVersions,...optional(response,z.array(ruleVersionRow))];}
  const missingRuleIdentities=[...new Set(ruleVersions.map(r=>r.rule_id))].filter(id=>!rules.some(r=>r.id===id));
  if(missingRuleIdentities.length){const response=await client.from("question_rules").select("id,library_id,rule_key,status,row_version,current_draft_version_id,current_published_version_id").eq("library_id",libraryId).in("id",missingRuleIdentities);rules=[...rules,...optional(response,z.array(ruleRow))];}
  const pinnedQuestionIds=[...new Set([...questionnaireQuestions.map(q=>q.question_version_id),...questionBankIds,...referencedQuestionVersions(ruleVersions)])].filter(id=>!questionVersions.some(q=>q.id===id));
  for(let offset=0;offset<pinnedQuestionIds.length;offset+=100){const response=await client.from("question_versions").select("id,question_id,version,status,label_fr,label_ar,help_fr,help_ar,answer_type,required_by_default,source_service_id").eq("library_id",libraryId).in("id",pinnedQuestionIds.slice(offset,offset+100));questionVersions=[...questionVersions,...optional(response,z.array(questionVersionRow))];}
  const pickName = (version: { name_fr: string; name_ar: string } | undefined, fallback: string) => {
    if (!version) return fallback;
    const primary = locale === "ar" ? version.name_ar : version.name_fr;
    const secondary = locale === "ar" ? version.name_fr : version.name_ar;
    const trimmed = primary?.trim();
    if (trimmed && trimmed !== fallback) return trimmed;
    return secondary?.trim() || fallback;
  };
  const namedCategory = (item: z.infer<typeof categoryRow>) => pickName(categoryVersions.find((value) => value.id === item.current_published_version_id) ?? categoryVersions.find((value) => value.id === item.current_draft_version_id), item.code);
  const namedSubcategory = (item: z.infer<typeof subcategoryRow>) => pickName(subcategoryVersions.find((value) => value.id === item.current_published_version_id) ?? subcategoryVersions.find((value) => value.id === item.current_draft_version_id), item.code);
  const categories: FranchiseCategoryNode[] = categoryItems.filter((item) => item.library_id === libraryId).map((item) => {
    const version = categoryVersions.find((value) => value.id === item.current_draft_version_id) ?? categoryVersions.find((value) => value.id === item.current_published_version_id);
    return {
      id: item.id,
      title: namedCategory(item),
      status: catalogEffectiveStatus(item.status, version?.status),
      draftVersionId: item.current_draft_version_id,
      identityRowVersion: item.row_version,
      versionRowVersion: version?.row_version,
      children: subcategoryItems.filter((child) => child.category_id === item.id && child.library_id === libraryId).map((child) => {
        const childVersion = subcategoryVersions.find((value) => value.id === child.current_draft_version_id) ?? subcategoryVersions.find((value) => value.id === child.current_published_version_id);
        return {
          id: child.id,
          title: namedSubcategory(child),
          status: catalogEffectiveStatus(child.status, childVersion?.status),
          draftVersionId: child.current_draft_version_id,
          identityRowVersion: child.row_version,
          versionRowVersion: childVersion?.row_version,
        };
      }),
    };
  });
  const serviceRows: FranchiseCatalogRow[] = services.filter((item) => item.library_id === libraryId).map((item) => {
    const version = serviceVersions.find((value) => value.id === item.current_draft_version_id) ?? serviceVersions.find((value) => value.id === item.current_published_version_id);
    const subcategory = subcategoryItems.find((value) => value.id === item.primary_subcategory_id);
    const category = subcategory ? categoryItems.find((value) => value.id === subcategory.category_id) : undefined;
    return {
      id: item.id,
      kind: "SERVICE",
      title: pickName(version, item.code),
      code: item.code,
      status: catalogEffectiveStatus(item.status, version?.status),
      versionLabel: version ? `v${version.version}` : null,
      href: `/${locale}/franchise/services/${item.id}${q}`,
      category: category ? namedCategory(category) : null,
      subcategory: subcategory ? namedSubcategory(subcategory) : null,
      subcategoryId: item.primary_subcategory_id,
      description: version ? (locale === "ar" ? version.short_description_ar : version.short_description_fr) : null,
      nameFr: version?.name_fr ?? null,
      nameAr: version?.name_ar ?? null,
      command: version ? {
        draftVersionId: version.id,
        identityRowVersion: item.row_version,
        versionRowVersion: version.row_version,
        slug: version.slug || item.slug,
        descriptionFr: version.short_description_fr,
        descriptionAr: version.short_description_ar,
        longDescriptionFr: version.long_description_fr,
        longDescriptionAr: version.long_description_ar,
        serviceType: version.service_type,
        unitLabelFr: version.unit_label_fr,
        unitLabelAr: version.unit_label_ar,
        creditEligible: version.credit_eligible,
        volumeEligible: version.volume_eligible,
        recurringEligible: version.recurring_eligible,
        trialEligible: version.trial_eligible,
        rfqRequired: version.rfq_required,
        fixedFulfillmentAllowed: version.fixed_fulfillment_allowed,
        baseCurrency: version.base_currency,
        sortOrder: version.sort_order,
        fulfillmentConfig: version.fulfillment_config,
        visibilityRules: version.visibility_rules,
        sensitive: version.sensitive,
      } : null,
    };
  });
  const questionnaireRows: FranchiseCatalogRow[] = questionnaires.filter((item) => item.library_id === libraryId).map((item) => {
    const version = questionnaireVersions.find((value) => value.id === item.current_draft_version_id) ?? questionnaireVersions.find((value) => value.id === item.current_published_version_id);
    return {
      id: item.id,
      kind: "QUESTIONNAIRE",
      title: version
        ? (() => {
            const primary = locale === "ar" ? version.title_ar : version.title_fr;
            const secondary = locale === "ar" ? version.title_fr : version.title_ar;
            const trimmed = primary?.trim();
            if (trimmed && trimmed !== item.code) return trimmed;
            return secondary?.trim() || item.code;
          })()
        : item.code,
      code: item.code,
      status: catalogEffectiveStatus(item.status, version?.status),
      versionLabel: version ? `v${version.version}` : null,
      href: `/${locale}/franchise/questionnaires/${item.id}${q}`,
      category: null,
      subcategory: null,
      subcategoryId: null,
      description: null,
      nameFr: version?.title_fr ?? null,
      nameAr: version?.title_ar ?? null,
      questionnaireVersionId: version?.id ?? null,
      draftVersionId: version?.id ?? null,
      identityRowVersion: item.row_version,
      versionRowVersion: version?.row_version ?? null,
    };
  });
  const ruleRows: FranchiseCatalogRow[] = rules.filter((item) => item.library_id === libraryId&&groups.RULE.ids.includes(item.id)).map((item) => {
    const version = ruleVersions.find((value) => value.id === item.current_draft_version_id) ?? ruleVersions.find((value) => value.id === item.current_published_version_id);
    return {
      id: item.id,
      kind: "RULE",
      title: item.rule_key,
      code: item.rule_key,
      status: catalogEffectiveStatus(item.status, version?.status),
      versionLabel: version ? `v${version.version}` : null,
      href: `/${locale}/franchise/regles/${item.id}${q}`,
      category: null,
      subcategory: null,
      subcategoryId: null,
      description: null,
      nameFr: null,
      nameAr: null,
      draftVersionId: version?.id ?? null,
      identityRowVersion: item.row_version,
      versionRowVersion: version?.row_version ?? null,
      ruleActions: version?.actions ?? [],
      rulePayload: version ? {condition_ast:version.condition_ast,actions:version.actions,dependency_graph:version.dependency_graph,priority:version.priority,sensitive:version.sensitive}:null,
    };
  });
  const questionByVersion = new Map(questionVersions.map((item) => [item.id, item]));
  const questionnaireByVersion = new Map(questionnaireVersions.map((item) => [item.id, item.questionnaire_id]));
  const questionRows: FranchiseQuestionRow[] = questions.filter((item) => item.library_id === libraryId).map((item) => {
    const version = questionVersions.find((value) => value.id === item.current_draft_version_id) ?? questionVersions.find((value) => value.id === item.current_published_version_id);
    const linked = questionnaireQuestions.find((link) => questionByVersion.get(link.question_version_id)?.question_id === item.id);
    return {
      id: item.id,
      key: item.question_key,
      status: catalogEffectiveStatus(item.status, version?.status),
      label: version ? (locale === "ar" ? version.label_ar : version.label_fr) : item.question_key,
      help: version ? ((locale === "ar" ? version.help_ar : version.help_fr) ?? "") : "",
      labelFr: version?.label_fr,
      labelAr: version?.label_ar,
      helpFr: version?.help_fr ?? "",
      helpAr: version?.help_ar ?? "",
      versionId: version?.id ?? null,
      answerType: version?.answer_type ?? null,
      required: version?.required_by_default ?? false,
      questionnaireId: linked ? questionnaireByVersion.get(linked.questionnaire_version_id) ?? null : null,
    };
  });
  const counts=serverPage.counts;
  const withReviews=(item:FranchiseCatalogRow):FranchiseCatalogRow=>({...item,reviewEvents:changes.filter((x)=>x.target_id===item.id&&x.target_type===item.kind).map((x)=>({id:x.id,versionId:x.target_version_id,status:x.status,requestedAt:x.requested_at,reviewedAt:x.reviewed_at,comment:x.review_comment}))});
  return {
    status: "success",
    workspace: overlayFranchiseLibraryDemo({
      mandate: {
        franchiseId: selected.id,
        operatorCode: selected.operator_code,
        type: selected.franchise_type,
        libraryId,
        libraryCode: library.data[0].code,
        libraryName: (namedLibrary?pickName(namedLibrary,library.data[0].code):library.data[0].code)+(selected.activation_mode==="NON_CONTRACTUAL_DEMO"?(locale==="ar"?" · محاكاة غير تعاقدية":" · Simulation non contractuelle"):""),
        libraryStatus: library.data[0].status,
        libraryRowVersion: library.data[0].row_version,
        currentReleaseId: library.data[0].current_release_id,
        operatorOrganizationId: selected.operator_organization_id,
      },
      counts,
      serverPage,
      categories,
      services: serviceRows.map(withReviews),
      questionnaires: questionnaireRows.map(withReviews),
      rules: ruleRows.map(withReviews),
      questions: questionRows,
      availableMandates,
      mandates:allowed.map((f)=>({id:f.id,organizationId:f.operator_organization_id,operatorCode:f.operator_code})),
      compositionRules:compositionRules.data.map((r)=>({versionId:r.questionnaire_version_id,ruleVersionId:r.rule_version_id,order:r.evaluation_order})),
      ruleVersionBank:ruleVersions.map((r)=>({id:r.id,title:rules.find((x)=>x.id===r.rule_id)?.rule_key??r.rule_id,status:r.status,version:r.version})),
      questionVersionBank: questionVersions.map((q) => ({id:q.id,questionId:q.question_id,labelFr:q.label_fr,labelAr:q.label_ar,answerType:q.answer_type,status:q.status})),
      compositionSections: sectionsParsed.data.map((section) => ({versionId:section.questionnaire_version_id,key:section.section_key,labelFr:section.label_fr,labelAr:section.label_ar,helpFr:section.help_fr??"",helpAr:section.help_ar??""})),
      compositionQuestions: questionnaireQuestions.map((q) => ({versionId:q.questionnaire_version_id,questionVersionId:q.question_version_id,sectionKey:sectionsParsed.data.find((s) => s.id===q.section_id)?.section_key ?? "",required:q.required_override ?? true,sortOrder:q.sort_order})),
      releases: releases.filter((item) => item.library_id === libraryId).map((item) => ({ id: item.id, key: item.release_key, status: item.status })),
    }, locale, q),
  };
}

export async function loadFranchiseLibraryWorkspace(input: {locale: "fr" | "ar";organizationId?: string;franchiseId?:string;libraryId?:string;catalog?:CatalogPageInput}): Promise<FranchiseLibraryLoadResult> {
  try { return await loadFranchiseLibraryWorkspaceUnchecked(input); }
  catch(error) {
    if(error instanceof Error && error.message === "FRANCHISE_CATALOG_QUERY_FAILED")return {status:"error",reason:"QUERY_FAILED"};
    if(error instanceof Error && error.message === "FRANCHISE_CATALOG_INVALID_RESPONSE")return {status:"error",reason:"INVALID_RESPONSE"};
    throw error;
  }
}
