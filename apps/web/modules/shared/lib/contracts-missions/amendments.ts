import { readAmendmentExecutions,type AmendmentExecution } from "./amendment-execution";
import { z } from "zod";
import{signatureReadinessSchema,type SignatureReadiness}from"./signature-readiness";
import { readContractPages,readContractRelations } from "./read-pages";
import { resolveClientOrganizationContext } from "@/modules/shared/client-organization-context";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const uuid = z.string().uuid();
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const amount = z.union([z.string().regex(/^-?\d+$/), z.number().int().safe()]).transform(String);
const member = z.object({ organization_id: uuid });
const amendment = z.object({ id: uuid, contract_id: uuid, base_contract_version_id:uuid, change_request_id:uuid,deliverables_delta:z.array(z.record(z.string(),z.unknown())), amendment_number: z.number().int().positive(), status: z.enum(["DRAFT", "PENDING_SIGNATURE", "ACTIVE", "REJECTED", "SUPERSEDED"]), price_delta_minor: amount, deadline_delta_days: z.number().int(), content_hash: hash, activated_contract_version_id: uuid.nullable(), created_at: z.string() });
const signature = z.object({ amendment_id: uuid, organization_id: uuid, signed_at: z.string() });

export type AmendmentDashboard = { organizationId: string; items: Array<{ id: string; contractId: string;reason?:string;scopeDelta?:Record<string,unknown>;deliverablesDelta?:Array<Record<string,unknown>>;execution?:AmendmentExecution|null;currency?:string|null;signatureReadiness?:SignatureReadiness|null; number: number; status: z.infer<typeof amendment>["status"]; priceDeltaMinor: string; deadlineDeltaDays: number; contentHash: string; activatedContractVersionId: string | null; createdAt: string; signatures: Array<{ organizationId: string; signedAt: string }> }> };
type Result = { status: "success"; value: AmendmentDashboard } | { status: "error"; reason: "UNAUTHENTICATED" | "NO_CLIENT_ORGANIZATION" | "ORGANIZATION_SELECTION_REQUIRED" | "FORBIDDEN_ORGANIZATION" | "QUERY_FAILED" | "INVALID_RESPONSE" };

export async function loadClientAmendments(requestedOrganizationId?: string): Promise<Result> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const membershipResult = await readContractPages((from,to)=>client.from("organization_memberships").select("organization_id,organization_member_roles!inner(role_code,revoked_at)").eq("user_id", auth.user.id).eq("status", "ACTIVE").is("organization_member_roles.revoked_at", null).in("organization_member_roles.role_code", ["CLIENT_OWNER", "CLIENT_ADMIN"]).order("id").range(from,to));
  if (membershipResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const memberships = z.array(member).safeParse(membershipResult.data);
  if (!memberships.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const context = resolveClientOrganizationContext(memberships.data, requestedOrganizationId);
  if (context.status === "error") return context;
  const organizationId = context.membership.organization_id;
  const contractsResult = await readContractPages((from,to)=>client.from("contracts").select("id").eq("client_organization_id", organizationId).order("id").range(from,to));
  if (contractsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const contracts = z.array(z.object({ id: uuid })).safeParse(contractsResult.data);
  if (!contracts.success) return { status: "error", reason: "INVALID_RESPONSE" };
  if (!contracts.data.length) return { status: "success", value: { organizationId, items: [] } };
  const amendmentsResult = await readContractRelations(contracts.data.map(contract=>contract.id),(ids,from,to)=>client.from("contract_amendments").select("id,contract_id,base_contract_version_id,change_request_id,deliverables_delta,amendment_number,status,price_delta_minor::text,deadline_delta_days,content_hash,activated_contract_version_id,created_at").in("contract_id", ids).order("created_at", { ascending: false }).order("id").range(from,to));
  if (amendmentsResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const amendments = z.array(amendment).safeParse(amendmentsResult.data);
  if (!amendments.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const baseVersionsResult=await readContractRelations(amendments.data.map(item=>item.base_contract_version_id),(ids,from,to)=>client.from("contract_versions").select("id,contract_id,currency").in("id",ids).order("id").range(from,to));
  if(baseVersionsResult.error)return{status:"error",reason:"QUERY_FAILED"};
  const baseVersions=z.array(z.object({id:uuid,contract_id:uuid,currency:z.string().regex(/^[A-Z]{3}$/u)})).safeParse(baseVersionsResult.data);
  if(!baseVersions.success||amendments.data.some(item=>!baseVersions.data.some(base=>base.id===item.base_contract_version_id&&base.contract_id===item.contract_id)))return{status:"error",reason:"INVALID_RESPONSE"};
  const changesResult=await readContractRelations(amendments.data.map(item=>item.change_request_id),(ids,from,to)=>client.from("change_requests").select("id,reason,scope_delta").in("id",ids).order("id").range(from,to)),changes=z.array(z.object({id:uuid,reason:z.string(),scope_delta:z.record(z.string(),z.unknown())})).safeParse(changesResult.data);
  if(changesResult.error)return{status:"error",reason:"QUERY_FAILED"};if(!changes.success||amendments.data.some(item=>!changes.data.some(change=>change.id===item.change_request_id)))return{status:"error",reason:"INVALID_RESPONSE"};
  const executions=await readAmendmentExecutions(amendments.data.filter(item=>item.status==="ACTIVE").map(item=>item.id),ids=>client.rpc("list_mission_amendment_preparations_v1",{p_amendment_ids:ids}));
  const readinessById=new Map<string,SignatureReadiness>();
  for(let offset=0;offset<amendments.data.length;offset+=100){try{const ids=amendments.data.slice(offset,offset+100).map(item=>item.id),result=await client.rpc("list_amendment_signature_readiness_v1",{p_amendment_ids:ids}),parsed=z.array(signatureReadinessSchema.extend({amendment_id:uuid})).max(100).safeParse(result.data);if(!result.error&&parsed.success&&parsed.data.every(row=>ids.includes(row.amendment_id)))for(const row of parsed.data)readinessById.set(row.amendment_id,row);}catch{/* Only signature readiness is unavailable; historical amendments remain visible. */}}
  const signaturesResult = amendments.data.length ? await readContractRelations(amendments.data.map(item=>item.id),(ids,from,to)=>client.from("contract_amendment_signatures").select("amendment_id,organization_id,signed_at").in("amendment_id", ids).order("amendment_id").order("organization_id").range(from,to)) : { data: [], error: null };
  if (signaturesResult.error) return { status: "error", reason: "QUERY_FAILED" };
  const signatures = z.array(signature).safeParse(signaturesResult.data);
  if (!signatures.success) return { status: "error", reason: "INVALID_RESPONSE" };
  return { status: "success", value: { organizationId, items: amendments.data.map((item) => ({ id: item.id, contractId: item.contract_id,reason:changes.data.find(change=>change.id===item.change_request_id)!.reason,scopeDelta:changes.data.find(change=>change.id===item.change_request_id)!.scope_delta,deliverablesDelta:item.deliverables_delta,execution:executions.get(item.id)??null,currency:baseVersions.data.find(base=>base.id===item.base_contract_version_id)!.currency,signatureReadiness:readinessById.get(item.id)??null, number: item.amendment_number, status: item.status, priceDeltaMinor: item.price_delta_minor, deadlineDeltaDays: item.deadline_delta_days, contentHash: item.content_hash, activatedContractVersionId: item.activated_contract_version_id, createdAt: item.created_at, signatures: signatures.data.filter((signed) => signed.amendment_id === item.id).map((signed) => ({ organizationId: signed.organization_id, signedAt: signed.signed_at })) })) } };
}
