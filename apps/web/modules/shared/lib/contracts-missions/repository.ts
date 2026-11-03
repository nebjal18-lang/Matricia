import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { readMissionSignedScopeStates } from "./signed-scope-states";
import {obligationRetirementRow,milestoneRetirementRow,retirementColumns,milestoneRetirementColumns,projectRetirement} from "./operational-scope";
import { z } from "zod";
import {missionPreparationSchema,type MissionPreparation}from"./preparation";
import { signatureReadinessSchema } from "./signature-readiness";
import { readContractPages, readContractRelations } from "./read-pages";
import { resolveClientOrganizationContext } from "@/modules/shared/client-organization-context";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { ContractItemType, ContractMissionDashboard } from "./model";

const id = z.string().uuid();
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const amount = z.union([z.string().regex(/^-?\d+$/), z.number().int().safe()]).transform((value): string => String(value));
const member = z.object({ organization_id: id, organizations: z.object({ display_name: z.string().min(1) }) });
const contractRow = z.object({ id, provider_organization_id: id, status: z.string(), current_version: z.number().int().positive(), row_version: z.number().int().positive() });
const versionRow = z.object({ id, contract_id: id, version: z.number().int().positive(), selected_quote_version_id: id, price_minor: amount, currency: z.string().regex(/^[A-Z]{3}$/), content_hash: hash, change_reason: z.string().min(3), created_at: z.string() });
const signatureRow = z.object({ id, contract_id: id, contract_version_id: id, organization_id: id, signer_role: z.string().min(1), contract_hash: hash, signed_at: z.string(), proof: z.object({ method: z.string().min(1), evidence_hash: hash }).passthrough() });
const itemType = z.enum(["DELIVERABLE", "EXCLUSION", "ACCEPTANCE_CRITERION", "PAYMENT_TERM", "CORRECTION", "PENALTY"]);
const itemRow = z.object({ id, contract_version_id: id, item_key: z.string(), item_type: itemType, label_fr: z.string().min(1), label_ar: z.string().min(1), sort_order: z.number().int().positive() });
const missionRow = z.object({ id, contract_id: id, contract_version_id: id, scope_reconciliation_required:z.boolean(), status: z.string(), started_at: z.string().nullable(), completed_at: z.string().nullable() });
const milestoneRow = z.object({ id, mission_id: id, milestone_key: z.string(), title_fr: z.string(), title_ar: z.string(), status: z.string(), due_at: z.string().nullable(), row_version: z.number().int().positive() });
const deliverableRow = z.object({ id, mission_id: id, deliverable_key: z.string(), contractual_key:z.string().nullable(), source_contract_version_id:id.nullable(), scope_generation:z.number().int().positive(), label_fr: z.string(), label_ar: z.string(), status: z.string(), current_version: z.number().int().nonnegative() });
const criterionRow = z.object({ deliverable_id: id, delivery_version: z.number().int().nonnegative(), label_fr:z.string().nullable(), label_ar:z.string().nullable(), criterion_key: z.string(), status: z.string() });
const deliveryVersionRow = z.object({ id, deliverable_id: id, version: z.number().int().positive() });
const deliveryProofRow = z.object({ delivery_version_id: id, scan_status: z.enum(["PENDING","CLEAN","INFECTED","ERROR"]) });

type LoadResult = { status: "success"; dashboard: ContractMissionDashboard } | { status: "error"; reason: "UNAUTHENTICATED" | "NO_CLIENT_ORGANIZATION" | "ORGANIZATION_SELECTION_REQUIRED" | "FORBIDDEN_ORGANIZATION" | "QUERY_FAILED" | "INVALID_RESPONSE" };
function rows<T>(schema: z.ZodType<T>, value: unknown) {
  return z.array(schema).safeParse(value);
}

export async function loadContractMissions(locale: "fr" | "ar", requestedOrganizationId?: string): Promise<LoadResult> {
  const client = await getSupabaseServerClient();
  const authResult = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authResult.error);
  if (authFailure) return {status:"error",reason:authFailure === "UNAVAILABLE" ? "QUERY_FAILED" : "UNAUTHENTICATED"};
  const auth = authResult.data;
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const membershipResult = await readContractPages((from,to)=>client.from("organization_memberships").select("organization_id,organizations!inner(display_name),organization_member_roles!inner(role_code,revoked_at)").eq("user_id", auth.user.id).eq("status", "ACTIVE").is("organization_member_roles.revoked_at", null).in("organization_member_roles.role_code", ["CLIENT_OWNER", "CLIENT_ADMIN"]).order("id").range(from,to));
  if (membershipResult.error) return { status: "error", reason: membershipResult.error.code === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : "QUERY_FAILED" };
  const memberships = z.array(member).safeParse(membershipResult.data);
  if (!memberships.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const context = resolveClientOrganizationContext(memberships.data, requestedOrganizationId);
  if (context.status === "error") return context;
  const membership = context.membership;
  const organizationId = membership.organization_id;

  const contractsResult = await readContractPages((from,to)=>client.from("contracts").select("id,provider_organization_id,status,current_version,row_version").eq("client_organization_id", organizationId).order("created_at", { ascending: false }).order("id").range(from,to));
  if (contractsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const contracts = rows(contractRow, contractsResult.data);
  if (!contracts.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const contractIds = contracts.data.map((contract) => contract.id);
  if (contractIds.length === 0) return { status: "success", dashboard: { organizationId, organizationName: membership.organizations.display_name, contracts: [], missions: [] } };

  const [versionsResult, signaturesResult, missionsResult] = await Promise.all([
    readContractRelations(contractIds,(ids,from,to)=>client.from("contract_versions").select("id,contract_id,version,selected_quote_version_id,price_minor,currency,content_hash,change_reason,created_at").in("contract_id", ids).order("version", { ascending: false }).order("id").range(from,to)),
    readContractRelations(contractIds,(ids,from,to)=>client.from("contract_signatures").select("id,contract_id,contract_version_id,organization_id,signer_role,contract_hash,signed_at,proof").in("contract_id", ids).order("id").range(from,to)),
    readContractRelations(contractIds,(ids,from,to)=>client.from("missions").select("id,contract_id,contract_version_id,scope_reconciliation_required,status,started_at,completed_at").eq("client_organization_id", organizationId).in("contract_id", ids).order("created_at", { ascending: false }).order("id").range(from,to)),
  ]);
  if (versionsResult.error || signaturesResult.error || missionsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const versions = rows(versionRow, versionsResult.data), signatures = rows(signatureRow, signaturesResult.data), missions = rows(missionRow, missionsResult.data);
  if (!versions.success || !signatures.success || !missions.success) return { status: "error", reason: "INVALID_RESPONSE" };

  if(contracts.data.some(contract=>!versions.data.some(version=>version.contract_id===contract.id&&version.version===contract.current_version)))return{status:"error",reason:"INVALID_RESPONSE"};
  const readinessById=new Map<string,z.infer<typeof signatureReadinessSchema>>();
  // A signature subsystem outage does not erase the healthy contractual history.
  for(let offset=0;offset<contractIds.length;offset+=100){try{const ids=contractIds.slice(offset,offset+100),result=await client.rpc("list_contract_signature_readiness_v1",{p_contract_ids:ids}),parsed=z.array(signatureReadinessSchema.extend({contract_id:id})).max(100).safeParse(result.data);if(!result.error&&parsed.success&&parsed.data.every(row=>ids.includes(row.contract_id)))for(const row of parsed.data)readinessById.set(row.contract_id,row);}catch{ /* Explicitly unavailable on the corresponding contract. */ }}
  const preparationById=new Map<string,MissionPreparation>();
  for(const contract of contracts.data.filter(row=>["ACTIVE","AMENDED"].includes(row.status)&&!missions.data.some(mission=>mission.contract_id===row.id))){
    const current=versions.data.find(version=>version.contract_id===contract.id&&version.version===contract.current_version);
    if(current){try{const result=await client.rpc("get_client_mission_preparation_v1",{p_contract_id:contract.id,p_contract_version_id:current.id});const parsed=missionPreparationSchema.safeParse(result.data);if(!result.error&&parsed.success&&parsed.data.contract_id===contract.id&&parsed.data.contract_version_id===current.id)preparationById.set(contract.id,parsed.data);}catch{ /* The preparation state is explicitly unavailable; contractual history remains readable. */ }}
  }
  const versionIds = versions.data.map((version) => version.id);
  const missionIds = missions.data.map((mission) => mission.id);
  const scopeStates = await readMissionSignedScopeStates(missionIds, ids => client.rpc("get_mission_signed_scope_states_v1", { p_mission_ids: ids }));
  if (scopeStates.status === "error") return { status: "error", reason: "QUERY_FAILED" };
  const [itemsResult, milestonesResult, deliverablesResult,retirementResult,milestoneRetirementResult] = await Promise.all([
    readContractRelations(versionIds,(ids,from,to)=>client.from("contract_items").select("id,contract_version_id,item_key,item_type,label_fr,label_ar,sort_order").in("contract_version_id", ids).order("sort_order").order("id").range(from,to)),
    missionIds.length ? readContractRelations(missionIds,(ids,from,to)=>client.from("mission_milestones").select("id,mission_id,milestone_key,title_fr,title_ar,status,due_at,row_version").in("mission_id", ids).order("sort_order").order("id").range(from,to)) : Promise.resolve({ data: [], error: null }),
    missionIds.length ? readContractRelations(missionIds,(ids,from,to)=>client.from("deliverables").select("id,mission_id,deliverable_key,contractual_key,source_contract_version_id,scope_generation,label_fr,label_ar,status,current_version").in("mission_id", ids).order("id").range(from,to)) : Promise.resolve({ data: [], error: null }),
    missionIds.length?readContractRelations(missionIds,(ids,from,to)=>client.from("mission_obligation_retirements_v1").select(retirementColumns).in("mission_id",ids).order("deliverable_id").range(from,to)):Promise.resolve({data:[],error:null}),
    missionIds.length?readContractRelations(missionIds,(ids,from,to)=>client.from("mission_milestone_retirements_v1").select(milestoneRetirementColumns).in("mission_id",ids).order("milestone_id").range(from,to)):Promise.resolve({data:[],error:null}),
  ]);
  if (retirementResult.error||milestoneRetirementResult.error||itemsResult.error || milestonesResult.error || deliverablesResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const items = rows(itemRow, itemsResult.data), milestones = rows(milestoneRow, milestonesResult.data), deliverables = rows(deliverableRow, deliverablesResult.data);
  const retirements=z.array(obligationRetirementRow).safeParse(retirementResult.data),retiredMilestones=z.array(milestoneRetirementRow).safeParse(milestoneRetirementResult.data);
  if (!retirements.success||!retiredMilestones.success||!items.success || !milestones.success || !deliverables.success) return { status: "error", reason: "INVALID_RESPONSE" };

  const deliverableIds = deliverables.data.map((deliverable) => deliverable.id);
  const [criteriaResult,deliveryVersionsResult,checklistLabelsResult] = await Promise.all([
    deliverableIds.length ? readContractRelations(deliverableIds,(ids,from,to)=>client.from("acceptance_checklists").select("deliverable_id,delivery_version,criterion_key,status,label_fr,label_ar").in("deliverable_id", ids).order("deliverable_id").order("criterion_key").range(from,to)) : Promise.resolve({ data: [], error: null }),
    deliverableIds.length ? readContractRelations(deliverableIds,(ids,from,to)=>client.from("delivery_versions").select("id,deliverable_id,version").in("deliverable_id", ids).order("id").range(from,to)) : Promise.resolve({ data: [], error: null }),
    missionIds.length ? readContractRelations(missionIds,(ids,from,to)=>client.from("mission_checklist_items").select("mission_id,item_key,label_fr,label_ar").in("mission_id",ids).order("mission_id").order("item_key").range(from,to)) : Promise.resolve({data:[],error:null}),
  ]);
  if (criteriaResult.error||deliveryVersionsResult.error||checklistLabelsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const criteria = rows(criterionRow, criteriaResult.data),deliveryVersions=rows(deliveryVersionRow,deliveryVersionsResult.data),checklistLabels=rows(z.object({mission_id:id,item_key:z.string(),label_fr:z.string(),label_ar:z.string()}),checklistLabelsResult.data);
  if (!criteria.success||!deliveryVersions.success||!checklistLabels.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const deliveryVersionIds=deliveryVersions.data.map((version)=>version.id);
  const deliveryProofsResult=deliveryVersionIds.length?await readContractRelations(deliveryVersionIds,(ids,from,to)=>client.from("delivery_proofs").select("delivery_version_id,scan_status").in("delivery_version_id",ids).order("id").range(from,to)):{data:[],error:null};
  if(deliveryProofsResult.error)return{status:"error",reason:"QUERY_FAILED"};
  const deliveryProofs=rows(deliveryProofRow,deliveryProofsResult.data);
  if(!deliveryProofs.success)return{status:"error",reason:"INVALID_RESPONSE"};
  if (missions.data.some((mission) => !versions.data.some((version) => version.id === mission.contract_version_id && version.contract_id === mission.contract_id))) return { status: "error", reason: "INVALID_RESPONSE" };

  const [quoteLinksResult,partiesResult]=await Promise.all([
    readContractRelations(versions.data.map(version=>version.selected_quote_version_id),(ids,from,to)=>client.from("quote_versions").select("id,rfq_id").in("id",ids).order("id").range(from,to)),
    readContractRelations(versionIds,(ids,from,to)=>client.from("contract_parties").select("contract_version_id,organization_id,party_role,legal_snapshot").in("contract_version_id",ids).order("contract_version_id").order("party_role").range(from,to)),
  ]);
  if(quoteLinksResult.error||partiesResult.error)return{status:"error",reason:"QUERY_FAILED"};
  const quoteLinks=rows(z.object({id,rfq_id:id}),quoteLinksResult.data),parties=rows(z.object({contract_version_id:id,organization_id:id,party_role:z.enum(["CLIENT","PROVIDER"]),legal_snapshot:z.object({legal_name:z.string().optional(),display_name:z.string().optional()}).passthrough()}),partiesResult.data);
  if(!quoteLinks.success||!parties.success)return{status:"error",reason:"INVALID_RESPONSE"};
  const rfqsResult=await readContractRelations(quoteLinks.data.map(quote=>quote.rfq_id),(ids,from,to)=>client.from("rfqs").select("id,request_version_id").in("id",ids).order("id").range(from,to));
  if(rfqsResult.error)return{status:"error",reason:"QUERY_FAILED"};
  const rfqs=rows(z.object({id,request_version_id:id}),rfqsResult.data);if(!rfqs.success)return{status:"error",reason:"INVALID_RESPONSE"};
  const requestVersionsResult=await readContractRelations(rfqs.data.map(rfq=>rfq.request_version_id),(ids,from,to)=>client.from("service_request_versions").select("id,client_organization_id,description").eq("client_organization_id",organizationId).in("id",ids).order("id").range(from,to));
  if(requestVersionsResult.error)return{status:"error",reason:"QUERY_FAILED"};
  const requestVersions=rows(z.object({id,client_organization_id:id,description:z.string()}),requestVersionsResult.data);if(!requestVersions.success||requestVersions.data.some(version=>version.client_organization_id!==organizationId))return{status:"error",reason:"INVALID_RESPONSE"};
  const versionTitle=(quoteVersionId:string)=>{const quote=quoteLinks.data.find(row=>row.id===quoteVersionId),rfq=rfqs.data.find(row=>row.id===quote?.rfq_id);return requestVersions.data.find(row=>row.id===rfq?.request_version_id)?.description.trim()||null;};
  const providerName=(versionId:string,providerId:string)=>{const party=parties.data.find(row=>row.contract_version_id===versionId&&row.party_role==="PROVIDER"&&row.organization_id===providerId);return party?.legal_snapshot.display_name?.trim()||party?.legal_snapshot.legal_name?.trim()||null;};

  // Serialize human date labels once. Node and browser tzdata may disagree even
  // for the same explicit IANA zone, so Client components must not recalculate.
  const timestampFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" });
  const timestampLabel = (value: string) => { const normalized = /T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/u.test(value) ? `${value}Z` : value; const date = new Date(normalized); return Number.isNaN(date.getTime()) ? "—" : timestampFormatter.format(date); };
  const localizedItems = (contractVersionId: string) => items.data.filter((item) => item.contract_version_id === contractVersionId).map((item) => ({ id: item.id, key: item.item_key, type: item.item_type as ContractItemType, label: locale === "ar" ? item.label_ar : item.label_fr, sortOrder: item.sort_order }));
  const versionSignatures = (contractVersionId: string) => signatures.data.filter((signature) => signature.contract_version_id === contractVersionId).map((signature) => ({ id: signature.id, organizationId: signature.organization_id, signerRole: signature.signer_role, contractHash: signature.contract_hash, signedAt: signature.signed_at, signedAtLabel: timestampLabel(signature.signed_at), method: signature.proof.method, evidenceHash: signature.proof.evidence_hash }));

  return { status: "success", dashboard: {
    organizationId,
    organizationName: membership.organizations.display_name,
    contracts: contracts.data.flatMap((contract) => {
      const history = versions.data.filter((version) => version.contract_id === contract.id).sort((left, right) => right.version - left.version);
      const current = history.find((version) => version.version === contract.current_version);
      if (!current) return [];
      return [{
        id: contract.id,
        missionPreparation:preparationById.get(contract.id)??null,
        providerOrganizationId: contract.provider_organization_id,
        providerOrganizationName: providerName(current.id,contract.provider_organization_id),
        signatureReadiness:readinessById.get(contract.id)??null,
        title: versionTitle(current.selected_quote_version_id),
        status: contract.status,
        currentVersion: contract.current_version,
        rowVersion: contract.row_version,
        versionId: current.id,
        selectedQuoteVersionId: current.selected_quote_version_id,
        priceMinor: String(current.price_minor),
        currency: current.currency,
        contentHash: current.content_hash,
        changeReason: current.change_reason,
        createdAt: current.created_at,
        createdAtLabel: timestampLabel(current.created_at),
        signatureCount: versionSignatures(current.id).length,
        signatures: versionSignatures(current.id),
        items: localizedItems(current.id),
        history: history.map((version) => ({ id: version.id, version: version.version, selectedQuoteVersionId: version.selected_quote_version_id, priceMinor: String(version.price_minor), currency: version.currency, contentHash: version.content_hash, changeReason: version.change_reason, createdAt: version.created_at, createdAtLabel: timestampLabel(version.created_at) })),
      }];
    }),
    missions: missions.data.flatMap((mission) => {
      const contractVersion = versions.data.find((version) => version.id === mission.contract_version_id && version.contract_id === mission.contract_id);
      if (!contractVersion) return [];
      return [{
        id: mission.id,
        contractId: mission.contract_id,
        title: versionTitle(contractVersion.selected_quote_version_id),
        contractVersionId: mission.contract_version_id,
        signedScopePending:scopeStates.states.get(mission.id)!,scopeReconciliationRequired:mission.scope_reconciliation_required,
        contractSnapshot: { versionId: contractVersion.id, version: contractVersion.version, selectedQuoteVersionId: contractVersion.selected_quote_version_id, priceMinor: String(contractVersion.price_minor), currency: contractVersion.currency, contentHash: contractVersion.content_hash, changeReason: contractVersion.change_reason, createdAt: contractVersion.created_at, createdAtLabel: timestampLabel(contractVersion.created_at), items: localizedItems(contractVersion.id), signatures: versionSignatures(contractVersion.id) },
        status: mission.status,
        startedAt: mission.started_at,
        completedAt: mission.completed_at,
        milestones: milestones.data.filter((milestone) => milestone.mission_id === mission.id).map((milestone) => ({ retired:retiredMilestones.data.some(retired=>retired.milestone_id===milestone.id),id: milestone.id, key: milestone.milestone_key, title: locale === "ar" ? milestone.title_ar : milestone.title_fr, status: milestone.status, dueAt: milestone.due_at, rowVersion: milestone.row_version })),
        deliverables: deliverables.data.filter((deliverable) => deliverable.mission_id === mission.id).map((deliverable) => {const current=deliveryVersions.data.find((version)=>version.deliverable_id===deliverable.id&&version.version===deliverable.current_version);const proofs=current?deliveryProofs.data.filter((proof)=>proof.delivery_version_id===current.id):[];const proofScanStatus=proofs.length===0?"NONE":proofs.every((proof)=>proof.scan_status==="CLEAN")?"CLEAN":proofs.some((proof)=>proof.scan_status==="INFECTED")?"INFECTED":proofs.some((proof)=>proof.scan_status==="ERROR")?"ERROR":"PENDING";return { retirement:projectRetirement(retirements.data.find(retired=>retired.deliverable_id===deliverable.id)),contractualKey:deliverable.contractual_key??deliverable.deliverable_key,sourceContractVersionId:deliverable.source_contract_version_id,scopeGeneration:deliverable.scope_generation,id: deliverable.id, key: deliverable.deliverable_key, label: locale === "ar" ? deliverable.label_ar : deliverable.label_fr, status: deliverable.status, currentVersion: deliverable.current_version, proofScanStatus, criteria: criteria.data.filter((criterion) => criterion.deliverable_id === deliverable.id && criterion.delivery_version === deliverable.current_version).map((criterion) => ({ key: criterion.criterion_key,label:(locale==="ar"?criterion.label_ar:criterion.label_fr)??(locale==="ar"?checklistLabels.data.find(item=>item.mission_id===mission.id&&item.item_key===criterion.criterion_key)?.label_ar:checklistLabels.data.find(item=>item.mission_id===mission.id&&item.item_key===criterion.criterion_key)?.label_fr)??criterion.criterion_key, status: criterion.status })) };}),
      }];
    }),
  } };
}
