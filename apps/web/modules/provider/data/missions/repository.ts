import { selectProviderMembership } from "@/modules/provider/data/spaces/organization-context";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { providerMissionRows as row, type ProviderMissionDashboard } from "./model";

export type ProviderMissionsResult = { status: "success"; dashboard: ProviderMissionDashboard } | { status: "error"; reason: "UNAUTHENTICATED" | "NO_PROVIDER_ORGANIZATION" | "QUERY_FAILED" | "INVALID_RESPONSE" };

export async function loadProviderMissions(locale: "fr" | "ar", requestedOrganizationId?: string, requestedMissionId?: string, requestedPage=1): Promise<ProviderMissionsResult> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const membershipResult = await client.from("organization_memberships").select("organization_id,organizations!inner(display_name),organization_member_roles!inner(role_code,revoked_at)").eq("user_id", auth.user.id).eq("status", "ACTIVE").is("organization_member_roles.revoked_at", null).in("organization_member_roles.role_code", ["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_TECHNICIAN"]).limit(100);
  if (membershipResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const membership = row.membership.safeParse(selectProviderMembership(z.array(row.membership).safeParse(membershipResult.data).data ?? [], requestedOrganizationId));
  if (!membership.success) return { status: "error", reason: membershipResult.data ? "INVALID_RESPONSE" : "NO_PROVIDER_ORGANIZATION" };
  const organizationId = membership.data.organization_id;
  const page=Number.isSafeInteger(requestedPage)&&requestedPage>0&&requestedPage<=100000?requestedPage:1;
  let missionQuery = client.from("missions").select("id,contract_id,status,started_at,completed_at").eq("provider_organization_id", organizationId).order("updated_at", { ascending: false }).order("id",{ascending:false});
  if (requestedMissionId) missionQuery = missionQuery.eq("id", requestedMissionId);
  else missionQuery=missionQuery.range((page-1)*100,page*100);
  const missionResult = await missionQuery;
  if (missionResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const missions = z.array(row.mission).safeParse(missionResult.data);
  if (!missions.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const displayed=missions.data.slice(0,100),pagination={listPage:page,hasMoreMissions:missions.data.length>100};
  if (displayed.length === 0) return { status: "success", dashboard: { ...pagination,organizationId, organizationName: membership.data.organizations.display_name, missions: [] } };
  const missionIds = displayed.map((item) => item.id), contractIds = displayed.map((item) => item.contract_id);
  const [milestoneResult, deliverableResult, contractResult, contractVersionResult,checklistResult,checklistSnapshotResult] = await Promise.all([
    client.from("mission_milestones").select("id,mission_id,milestone_key,title_fr,title_ar,status,due_at,row_version").in("mission_id", missionIds).order("sort_order"),
    client.from("deliverables").select("id,mission_id,deliverable_key,label_fr,label_ar,proof_required,status,current_version").in("mission_id", missionIds),
    client.from("contracts").select("id,current_version").in("id", contractIds),
    client.from("contract_versions").select("contract_id,version,price_minor,currency,content_hash,request_snapshot").in("contract_id", contractIds),
    client.from("mission_checklist_items").select("id,mission_id,item_key,label_fr,label_ar,instructions_fr,instructions_ar,proof_required,allowed_proof_types,status,checklist_snapshot_id").in("mission_id",missionIds).order("item_key"),
    client.from("mission_checklist_snapshots").select("id,mission_id,template_version,template_content_hash").in("mission_id",missionIds),
  ]);
  if (milestoneResult.error || deliverableResult.error || contractResult.error || contractVersionResult.error||checklistResult.error||checklistSnapshotResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const milestones = z.array(row.milestone).safeParse(milestoneResult.data), deliverables = z.array(row.deliverable).safeParse(deliverableResult.data), contracts = z.array(row.contract).safeParse(contractResult.data), contractVersions = z.array(row.contractVersion).safeParse(contractVersionResult.data),checklists=z.array(row.checklist).safeParse(checklistResult.data),checklistSnapshots=z.array(row.checklistSnapshot).safeParse(checklistSnapshotResult.data);
  if (!milestones.success || !deliverables.success || !contracts.success || !contractVersions.success||!checklists.success||!checklistSnapshots.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const serviceIds=[...new Set(contractVersions.data.flatMap(version=>{const id=z.string().uuid().safeParse(version.request_snapshot?.service_version_id);return id.success?[id.data]:[];}))];
  const serviceResult=serviceIds.length?await client.from("catalog_service_versions").select("id,name_fr,name_ar").in("id",serviceIds):{data:[],error:null};
  const serviceNames=z.array(z.object({id:z.string().uuid(),name_fr:z.string(),name_ar:z.string()})).safeParse(serviceResult.data);
  const serviceById=new Map(serviceNames.success?serviceNames.data.map(service=>[service.id,locale==="ar"?service.name_ar:service.name_fr]):[]);
  const deliverableIds = deliverables.data.map((item) => item.id);
  const versionResult = deliverableIds.length ? await client.from("delivery_versions").select("id,deliverable_id,version,description,submitted_at,content_hash").in("deliverable_id", deliverableIds).order("version", { ascending: false }) : { data: [], error: null };
  if (versionResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const versions = z.array(row.version).safeParse(versionResult.data);
  if (!versions.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const versionIds = versions.data.map((item) => item.id);
  const proofResult = versionIds.length ? await client.from("delivery_proofs").select("id,delivery_version_id,proof_type,scan_status").in("delivery_version_id", versionIds) : { data: [], error: null };
  if (proofResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const proofs = z.array(row.proof).safeParse(proofResult.data);
  if (!proofs.success) return { status: "error", reason: "INVALID_RESPONSE" };
  return { status: "success", dashboard: { ...pagination,organizationId, organizationName: membership.data.organizations.display_name, missions: displayed.map((mission) => {
    const contract = contracts.data.find((item) => item.id === mission.contract_id); const contractVersion = contractVersions.data.find((item) => item.contract_id === mission.contract_id && item.version === contract?.current_version);
    const requestTitle=contractVersion?.request_snapshot?.description,serviceId=contractVersion?.request_snapshot?.service_version_id;
    const title=typeof requestTitle==="string"&&requestTitle.trim()?requestTitle.trim():typeof serviceId==="string"?serviceById.get(serviceId):undefined;
    return { title,id: mission.id, contractId: mission.contract_id, status: mission.status, startedAt: mission.started_at, completedAt: mission.completed_at, contract: contract && contractVersion ? { currentVersion: contract.current_version, priceMinor: contractVersion.price_minor, currency: contractVersion.currency, contentHash: contractVersion.content_hash } : null,
      milestones: milestones.data.filter((item) => item.mission_id === mission.id).map((item) => ({ id: item.id, key: item.milestone_key, title: locale === "ar" ? item.title_ar : item.title_fr, status: item.status, dueAtLabel:item.due_at?new Intl.DateTimeFormat(locale==="ar"?"ar-MA":"fr-MA",{timeZone:"Africa/Casablanca",dateStyle:"medium",timeStyle:"short"}).format(new Date(item.due_at)):null,dueAt: item.due_at, rowVersion: item.row_version })),
      checklistItems:checklists.data.filter(item=>item.mission_id===mission.id).map(item=>{const snapshot=checklistSnapshots.data.find(value=>value.id===item.checklist_snapshot_id);const missionVersionIds=versions.data.filter(version=>deliverables.data.some(deliverable=>deliverable.mission_id===mission.id&&deliverable.id===version.deliverable_id)).map(version=>version.id);return{id:item.id,key:item.item_key,label:locale==="ar"?item.label_ar:item.label_fr,instructions:locale==="ar"?item.instructions_ar:item.instructions_fr,proofRequired:item.proof_required,allowedProofTypes:item.allowed_proof_types,status:item.status,templateVersion:snapshot?.template_version??null,templateHash:snapshot?.template_content_hash??null,proofOptions:proofs.data.filter(proof=>missionVersionIds.includes(proof.delivery_version_id)&&proof.scan_status==="CLEAN"&&(item.allowed_proof_types.length===0||item.allowed_proof_types.includes(proof.proof_type))).map(proof=>({id:proof.id,type:proof.proof_type}))}}),
      deliverables: deliverables.data.filter((item) => item.mission_id === mission.id).map((item) => ({ id: item.id, key: item.deliverable_key, label: locale === "ar" ? item.label_ar : item.label_fr, proofRequired: item.proof_required, status: item.status, currentVersion: item.current_version, versions: versions.data.filter((version) => version.deliverable_id === item.id).map((version) => { const versionProofs=proofs.data.filter((proof) => proof.delivery_version_id === version.id); const proofScanStatus=versionProofs.length===0?"NONE":versionProofs.every((proof)=>proof.scan_status==="CLEAN")?"CLEAN":versionProofs.some((proof)=>proof.scan_status==="INFECTED")?"INFECTED":versionProofs.some((proof)=>proof.scan_status==="ERROR")?"ERROR":"PENDING"; return { id: version.id, version: version.version, description: version.description, submittedAt: version.submitted_at, contentHash: version.content_hash, proofCount: versionProofs.length, proofScanStatus }; }) })) };
  }) } };
}
