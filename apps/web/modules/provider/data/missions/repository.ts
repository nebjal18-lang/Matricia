import { readMissionSignedScopeStates } from "@/modules/shared/lib/contracts-missions/signed-scope-states";
import {obligationRetirementRow,milestoneRetirementRow,retirementColumns,milestoneRetirementColumns,projectRetirement} from "@/modules/shared/lib/contracts-missions/operational-scope";
import { readAllPages, readRelatedPages } from "@/modules/shared/lib/data/read-pages";
import { selectProviderMembership } from "@/modules/provider/data/spaces/organization-context";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { providerMissionRows as row, type ProviderMissionDashboard } from "./model";

export type ProviderMissionsResult = { status: "success"; dashboard: ProviderMissionDashboard } | { status: "error"; reason: "UNAUTHENTICATED" | "NO_PROVIDER_ORGANIZATION" | "CONTEXT_REQUIRED" | "FORBIDDEN" | "QUERY_FAILED" | "INVALID_RESPONSE" };

export async function loadProviderMissions(locale: "fr" | "ar", requestedOrganizationId?: string, requestedMissionId?: string, requestedPage=1, requestedSearch=""): Promise<ProviderMissionsResult> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const membershipResult = await readAllPages((from,to)=>client.from("organization_memberships").select("organization_id,organizations!inner(display_name),organization_member_roles!inner(role_code,revoked_at)").eq("user_id", auth.user!.id).eq("status", "ACTIVE").is("organization_member_roles.revoked_at", null).in("organization_member_roles.role_code", ["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_TECHNICIAN", "PROVIDER_VIEWER", "PROVIDER_SALES", "PROVIDER_ACCOUNTING"]).order("id").range(from,to));
  if (membershipResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const members=z.array(row.membership).safeParse(membershipResult.data);
  if(!members.success)return{status:"error",reason:"INVALID_RESPONSE"};
  const selected=selectProviderMembership(members.data,requestedOrganizationId);
  if(!selected)return{status:"error",reason:requestedOrganizationId?"FORBIDDEN":members.data.length>1?"CONTEXT_REQUIRED":"NO_PROVIDER_ORGANIZATION"};
  const membership={data:selected};
  const organizationId = membership.data.organization_id;
  const canManageAssignments=membership.data.organization_member_roles?.some(role=>role.revoked_at===null&&["PROVIDER_OWNER","PROVIDER_MANAGER"].includes(role.role_code))??false;
  const canOperate=membership.data.organization_member_roles?.some(role=>role.revoked_at===null&&["PROVIDER_OWNER","PROVIDER_MANAGER","PROVIDER_TECHNICIAN"].includes(role.role_code))??false;
  let counts:{activeMissions:number|null;deliverablesDue:number|null}={activeMissions:null,deliverablesDue:null};
  let countsReadState:"SUCCESS"|"UNAVAILABLE"="UNAVAILABLE";
  try{const result=await client.rpc("get_provider_mission_counts_v1",{p_organization_id:organizationId}),parsed=z.object({active_missions:z.number().int().safe().nonnegative(),deliverables_due:z.number().int().safe().nonnegative().nullable()}).safeParse(result.data);if(!result.error&&parsed.success){counts={activeMissions:parsed.data.active_missions,deliverablesDue:parsed.data.deliverables_due};countsReadState="SUCCESS"}}catch{/* Counts remain unavailable, never an invented zero. */}
  const page=Number.isSafeInteger(requestedPage)&&requestedPage>0&&requestedPage<=100000?requestedPage:1;
  let missionQuery = client.from("missions").select("id,contract_id,contract_version_id,scope_reconciliation_required,status,started_at,completed_at").eq("provider_organization_id", organizationId).order("updated_at", { ascending: false }).order("id",{ascending:false});
  if (requestedMissionId) missionQuery = missionQuery.eq("id", requestedMissionId);
  else missionQuery=missionQuery.range((page-1)*100,page*100);
  const search=requestedSearch.trim();
  if(search.length>200)return{status:"error",reason:"INVALID_RESPONSE"};
  const missionResult = !requestedMissionId&&search?await client.rpc("search_provider_missions_v1",{p_organization_id:organizationId,p_search:search,p_page:page}):await missionQuery;
  if (missionResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const missions = z.array(row.mission).safeParse(missionResult.data);
  if (!missions.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const displayed=missions.data.slice(0,100),pagination={listPage:page,hasMoreMissions:missions.data.length>100};
  if (displayed.length === 0) return { status: "success", dashboard: { ...pagination,canManageAssignments,canOperate,counts,countsReadState,organizationId, organizationName: membership.data.organizations.display_name, missions: [] } };
  const missionIds = displayed.map((item) => item.id), contractIds = displayed.map((item) => item.contract_id);
  const scopeStates = await readMissionSignedScopeStates(missionIds, ids => client.rpc("get_mission_signed_scope_states_v1", { p_mission_ids: ids }));
  if (scopeStates.status === "error") return { status: "error", reason: "QUERY_FAILED" };
  const [milestoneResult, deliverableResult, contractResult, contractVersionResult,checklistResult,checklistSnapshotResult,retirementResult,milestoneRetirementResult] = await Promise.all([
    readRelatedPages(missionIds,(ids,from,to)=>client.from("mission_milestones").select("id,mission_id,milestone_key,title_fr,title_ar,status,due_at,row_version").in("mission_id",ids).order("sort_order").order("id").range(from,to)),
    readRelatedPages(missionIds,(ids,from,to)=>client.from("deliverables").select("id,mission_id,deliverable_key,contractual_key,source_contract_version_id,scope_generation,label_fr,label_ar,proof_required,status,current_version").in("mission_id",ids).order("id").range(from,to)),
    readRelatedPages(contractIds,(ids,from,to)=>client.from("contracts").select("id,current_version").in("id",ids).order("id").range(from,to)),
    readRelatedPages(contractIds,(ids,from,to)=>client.from("contract_versions").select("id,contract_id,version,price_minor::text,currency,content_hash,request_snapshot").in("contract_id",ids).order("version").order("contract_id").range(from,to)),
    readRelatedPages(missionIds,(ids,from,to)=>client.from("mission_checklist_items").select("id,mission_id,milestone_id,item_key,label_fr,label_ar,instructions_fr,instructions_ar,proof_required,allowed_proof_types,status,checklist_snapshot_id").in("mission_id",ids).order("item_key").order("id").range(from,to)),
    readRelatedPages(missionIds,(ids,from,to)=>client.from("mission_checklist_snapshots").select("id,mission_id,template_version,template_content_hash").in("mission_id",ids).order("id").range(from,to)),
    readRelatedPages(missionIds,(ids,from,to)=>client.from("mission_obligation_retirements_v1").select(retirementColumns).in("mission_id",ids).order("deliverable_id").range(from,to)),
    readRelatedPages(missionIds,(ids,from,to)=>client.from("mission_milestone_retirements_v1").select(milestoneRetirementColumns).in("mission_id",ids).order("milestone_id").range(from,to)),
  ]);
  if (retirementResult.error||milestoneRetirementResult.error||milestoneResult.error || deliverableResult.error || contractResult.error || contractVersionResult.error||checklistResult.error||checklistSnapshotResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const milestones = z.array(row.milestone).safeParse(milestoneResult.data), deliverables = z.array(row.deliverable).safeParse(deliverableResult.data), contracts = z.array(row.contract).safeParse(contractResult.data), contractVersions = z.array(row.contractVersion).safeParse(contractVersionResult.data),checklists=z.array(row.checklist).safeParse(checklistResult.data),checklistSnapshots=z.array(row.checklistSnapshot).safeParse(checklistSnapshotResult.data);
  const retirements=z.array(obligationRetirementRow).safeParse(retirementResult.data),retiredMilestones=z.array(milestoneRetirementRow).safeParse(milestoneRetirementResult.data);
  if (!retirements.success||!retiredMilestones.success||!milestones.success || !deliverables.success || !contracts.success || !contractVersions.success||!checklists.success||!checklistSnapshots.success) return { status: "error", reason: "INVALID_RESPONSE" };
  if(displayed.some(mission=>!contractVersions.data.some(version=>version.id===mission.contract_version_id&&version.contract_id===mission.contract_id)))return{status:"error",reason:"INVALID_RESPONSE"};
  const serviceIds=[...new Set(contractVersions.data.flatMap(version=>{const id=z.string().uuid().safeParse(version.request_snapshot?.service_version_id);return id.success?[id.data]:[];}))];
  const serviceResult=serviceIds.length?await readRelatedPages(serviceIds,(ids,from,to)=>client.from("catalog_service_versions").select("id,name_fr,name_ar").in("id",ids).order("id").range(from,to)):{data:[],error:null};
  const serviceNames=z.array(z.object({id:z.string().uuid(),name_fr:z.string(),name_ar:z.string()})).safeParse(serviceResult.data);
  if(serviceResult.error)return{status:"error",reason:"QUERY_FAILED"};
  if(!serviceNames.success)return{status:"error",reason:"INVALID_RESPONSE"};
  const serviceById=new Map(serviceNames.success?serviceNames.data.map(service=>[service.id,locale==="ar"?service.name_ar:service.name_fr]):[]);
  const deliverableIds = deliverables.data.map((item) => item.id);
  const versionResult = deliverableIds.length ? await readRelatedPages(deliverableIds,(ids,from,to)=>client.from("delivery_versions").select("id,deliverable_id,version,description,submitted_at,content_hash,links").in("deliverable_id",ids).order("version", { ascending: false }).order("id").range(from,to)) : { data: [], error: null };
  if (versionResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const versions = z.array(row.version).safeParse(versionResult.data);
  if (!versions.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const versionIds = versions.data.map((item) => item.id);
  const [receiptResult,assignmentResult,optionsResult,decisionsResult,correctionsResult]=await Promise.all([
    readRelatedPages(deliverableIds,(ids,from,to)=>client.from("acceptance_checklists").select("deliverable_id,delivery_version,criterion_key,status,comment,decided_at,label_fr,label_ar").in("deliverable_id",ids).order("id").range(from,to)),
    readRelatedPages(missionIds,(ids,from,to)=>client.from("provider_mission_assignments_v1").select("mission_id,user_id,assigned_at,revoked_at").in("mission_id",ids).is("revoked_at",null).order("mission_id").order("user_id").range(from,to)),
    canManageAssignments?client.rpc("list_provider_mission_assignment_options_v1",{p_organization_id:organizationId}):Promise.resolve({data:[],error:null}),
    readRelatedPages(milestones.data.map(m=>m.id),(ids,from,to)=>client.from("mission_milestone_decisions_v1").select("milestone_id,decision,reason,decided_at").in("milestone_id",ids).order("audit_event_id").range(from,to)),
    readRelatedPages(milestones.data.map(m=>m.id),(ids,from,to)=>client.from("mission_milestone_corrections_v1").select("milestone_id,reason,submitted_at").in("milestone_id",ids).order("submitted_at").order("id").range(from,to)),
  ]);
  if(receiptResult.error||assignmentResult.error||optionsResult.error||decisionsResult.error||correctionsResult.error)return{status:"error",reason:"QUERY_FAILED"};
  const decisions=z.array(z.object({milestone_id:z.string().uuid(),decision:z.string(),reason:z.string(),decided_at:z.string()})).safeParse(decisionsResult.data),corrections=z.array(z.object({milestone_id:z.string().uuid(),reason:z.string(),submitted_at:z.string()})).safeParse(correctionsResult.data);
  const receipts=z.array(z.object({deliverable_id:z.string().uuid(),delivery_version:z.number().int().nonnegative(),criterion_key:z.string(),label_fr:z.string().nullable(),label_ar:z.string().nullable(),status:z.string(),comment:z.string().nullable(),decided_at:z.string().nullable()})).safeParse(receiptResult.data);
  const assignments=z.array(z.object({mission_id:z.string().uuid(),user_id:z.string().uuid(),assigned_at:z.string(),revoked_at:z.string().nullable()})).safeParse(assignmentResult.data);
  const options=z.array(z.object({user_id:z.string().uuid(),display_name:z.string()})).safeParse(optionsResult.data);
  if(!receipts.success||!assignments.success||!options.success||!decisions.success||!corrections.success)return{status:"error",reason:"INVALID_RESPONSE"};

  const proofResult = versionIds.length ? await readRelatedPages(versionIds,(ids,from,to)=>client.from("delivery_proofs").select("id,delivery_version_id,proof_type,scan_status,metadata").in("delivery_version_id",ids).order("id").range(from,to)) : { data: [], error: null };
  if (proofResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const proofs = z.array(row.proof).safeParse(proofResult.data);
  if (!proofs.success) return { status: "error", reason: "INVALID_RESPONSE" };
  return { status: "success", dashboard: { ...pagination,canManageAssignments,canOperate,counts,countsReadState,organizationId, organizationName: membership.data.organizations.display_name,technicianOptions:options.data.map(option=>({userId:option.user_id,displayName:option.display_name})), missions: displayed.map((mission) => {
    const contract = contracts.data.find((item) => item.id === mission.contract_id); const contractVersion = contractVersions.data.find((item) => item.contract_id === mission.contract_id && item.id === mission.contract_version_id);
    const requestTitle=contractVersion?.request_snapshot?.description,serviceId=contractVersion?.request_snapshot?.service_version_id;
    const title=typeof requestTitle==="string"&&requestTitle.trim()?requestTitle.trim():typeof serviceId==="string"?serviceById.get(serviceId):undefined;
    return { signedScopePending:scopeStates.states.get(mission.id)!,scopeReconciliationRequired:mission.scope_reconciliation_required,title,id: mission.id,canOperate:canManageAssignments||Boolean(membership.data.organization_member_roles?.some(role=>role.role_code==="PROVIDER_TECHNICIAN"&&role.revoked_at===null)&&assignments.data.some(a=>a.mission_id===mission.id&&a.user_id===auth.user!.id)),assignments:assignments.data.filter(a=>a.mission_id===mission.id).map(a=>({userId:a.user_id,assignedAt:a.assigned_at})), contractId: mission.contract_id, status: mission.status, startedAt: mission.started_at, completedAt: mission.completed_at, contract: contract && contractVersion ? { currentVersion: contractVersion.version, priceMinor: contractVersion.price_minor, currency: contractVersion.currency, contentHash: contractVersion.content_hash } : null,
      milestones: milestones.data.filter((item) => item.mission_id === mission.id).map((item) => ({ retired:retiredMilestones.data.some(retired=>retired.milestone_id===item.id),id: item.id, key: item.milestone_key, title: locale === "ar" ? item.title_ar : item.title_fr, status: item.status, dueAtLabel:item.due_at?new Intl.DateTimeFormat(locale==="ar"?"ar-MA":"fr-MA",{timeZone:"Africa/Casablanca",dateStyle:"medium",timeStyle:"short"}).format(new Date(item.due_at)):null,dueAt: item.due_at, rowVersion: item.row_version,decisions:decisions.data.filter(d=>d.milestone_id===item.id).map(d=>({decision:d.decision,reason:d.reason,decidedAt:d.decided_at})),corrections:corrections.data.filter(c=>c.milestone_id===item.id).map(c=>({reason:c.reason,submittedAt:c.submitted_at})) })),
      checklistItems:checklists.data.filter(item=>item.mission_id===mission.id).map(item=>{const snapshot=checklistSnapshots.data.find(value=>value.id===item.checklist_snapshot_id);const missionVersionIds=versions.data.filter(version=>deliverables.data.some(deliverable=>deliverable.mission_id===mission.id&&deliverable.id===version.deliverable_id)).map(version=>version.id);return{retired:Boolean(item.milestone_id&&retiredMilestones.data.some(retired=>retired.milestone_id===item.milestone_id)),id:item.id,key:item.item_key,label:locale==="ar"?item.label_ar:item.label_fr,instructions:locale==="ar"?item.instructions_ar:item.instructions_fr,proofRequired:item.proof_required,allowedProofTypes:item.allowed_proof_types,status:item.status,templateVersion:snapshot?.template_version??null,templateHash:snapshot?.template_content_hash??null,proofOptions:proofs.data.filter(proof=>missionVersionIds.includes(proof.delivery_version_id)&&proof.scan_status==="CLEAN"&&(item.allowed_proof_types.length===0||item.allowed_proof_types.includes(proof.proof_type))).map(proof=>({id:proof.id,type:proof.proof_type}))}}),
      deliverables: deliverables.data.filter((item) => item.mission_id === mission.id).map((item) => ({ retirement:projectRetirement(retirements.data.find(retired=>retired.deliverable_id===item.id)),contractualKey:item.contractual_key??item.deliverable_key,sourceContractVersionId:item.source_contract_version_id,scopeGeneration:item.scope_generation,id: item.id, key: item.deliverable_key, label: locale === "ar" ? item.label_ar : item.label_fr, proofRequired: item.proof_required, status: item.status, currentVersion: item.current_version, versions: versions.data.filter((version) => version.deliverable_id === item.id).map((version) => { const versionProofs=proofs.data.filter((proof) => proof.delivery_version_id === version.id); const proofScanStatus=versionProofs.length===0?"NONE":versionProofs.every((proof)=>proof.scan_status==="CLEAN")?"CLEAN":versionProofs.some((proof)=>proof.scan_status==="INFECTED")?"INFECTED":versionProofs.some((proof)=>proof.scan_status==="ERROR")?"ERROR":"PENDING"; return { id: version.id, version: version.version, description: version.description, submittedAt: version.submitted_at, contentHash: version.content_hash, proofCount: versionProofs.length, proofScanStatus,links:version.links.filter(link=>{try{return new URL(link).protocol==="https:"}catch{return false}}),proofs:versionProofs.map(proof=>({id:proof.id,type:proof.proof_type,scanStatus:proof.scan_status,label:proof.metadata?.original_file_name??`${proof.proof_type} · ${proof.id.slice(0,8)}`})),criteria:receipts.data.filter(receipt=>receipt.deliverable_id===item.id&&receipt.delivery_version===version.version).map(receipt=>({key:receipt.criterion_key,label:(locale==="ar"?receipt.label_ar:receipt.label_fr)??(locale==="ar"?checklists.data.find(item=>item.mission_id===mission.id&&item.item_key===receipt.criterion_key)?.label_ar:checklists.data.find(item=>item.mission_id===mission.id&&item.item_key===receipt.criterion_key)?.label_fr)??receipt.criterion_key,status:receipt.status,comment:receipt.comment,decidedAt:receipt.decided_at})) }; }) })) };
  }) } };
}
