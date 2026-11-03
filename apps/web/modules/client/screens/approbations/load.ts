import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { ClientApprovalPage, ClientApprovalPolicy } from "./model";

const row = z.object({
  id: z.string().uuid(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]),
  row_version: z.coerce.number().int().positive(),
  resource_type: z.string().min(3).max(80),
  resource_id: z.string().min(1).max(200),
  amount_minor: z.union([z.string().regex(/^\d+$/u), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)]).transform(String).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  requested_at: z.string(),
}).strict();

export const APPROVAL_PAGE_SIZE = 25;

export async function loadClientApprovals(organizationId: string | null, requestedPage = 1): Promise<ClientApprovalPage> {
  if (!organizationId) return { status: "organization_required" };
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10_000 ? requestedPage : 1;
  try {
  const client = await getSupabaseServerClient();
  const query = await client
    .from("business_approval_requests")
    .select("id,status,row_version,resource_type,resource_id,amount_minor::text,currency,requested_at")
    .eq("organization_id", organizationId)
    .order("requested_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * APPROVAL_PAGE_SIZE, page * APPROVAL_PAGE_SIZE);
  if (query.error) return { status: query.error.code === "42501" ? "forbidden" : query.error.code === "PGRST301" ? "unauthenticated" : "unavailable" };
  const parsed = z.array(row).max(APPROVAL_PAGE_SIZE + 1).safeParse(query.data);
  if (!parsed.success) return { status: "unavailable" };
  const ids=parsed.data.slice(0,APPROVAL_PAGE_SIZE).map(item=>item.id);
  const subjectResponse=ids.length?await client.rpc("list_client_approval_subjects_v1",{p_organization_id:organizationId,p_request_ids:ids}):{data:[],error:null};
  const subjects=z.array(z.object({approval_request_id:z.string().uuid(),label_fr:z.string(),label_ar:z.string(),path:z.string().regex(/^\/client\//u).nullable()})).safeParse(subjectResponse.data);
  if(subjectResponse.error||!subjects.success||subjects.data.some(item=>!ids.includes(item.approval_request_id)))return{status:"unavailable"};
  const labels=new Map(subjects.data.map(item=>[item.approval_request_id,item]));
  const commandResponse=ids.length?await client.rpc("list_my_client_approval_command_states_v1",{p_organization_id:organizationId,p_approval_ids:ids}):{data:[],error:null};
  const commands=z.array(z.object({approval_request_id:z.string().uuid(),can_resume:z.boolean(),completed:z.boolean()})).safeParse(commandResponse.data);
  if(commandResponse.error||!commands.success||commands.data.some(item=>!ids.includes(item.approval_request_id)))return{status:"unavailable"};
  const states=new Map(commands.data.map(item=>[item.approval_request_id,item]));
  return { status: "success", page, hasNext: parsed.data.length > APPROVAL_PAGE_SIZE, items: parsed.data.slice(0, APPROVAL_PAGE_SIZE).map((item) => ({
    canResume:states.get(item.id)?.can_resume,completed:states.get(item.id)?.completed,
    labelFr: labels.get(item.id)?.label_fr,labelAr: labels.get(item.id)?.label_ar,path: labels.get(item.id)?.path,
    id: item.id,
    status: item.status,
    rowVersion: item.row_version,
    resourceType: item.resource_type,
    resourceId: item.resource_id,
    amountMinor: item.amount_minor === null ? null : String(item.amount_minor),
    currency: item.currency,
    requestedAt: item.requested_at,
  })) };
  } catch { return { status: "unavailable" }; }
}

const policyRow = z.object({
  id: z.string().uuid(), resource_type: z.string(), version: z.number().int().positive(),
  status: z.enum(["DRAFT", "ACTIVE", "RETIRED"]), minimum_approvals: z.number().int().positive(),
  required_role_codes: z.array(z.string()), content_hash: z.string().regex(/^[0-9a-f]{64}$/u), created_by: z.string().uuid(),
  execution_scope: z.object({ currency: z.string().optional(), minimum_amount_minor: z.string().optional(), buyer_limit_minor: z.string().nullable().optional() }),
});

export async function loadClientApprovalPolicies(organizationId: string | null): Promise<{ status: "success"; items: ClientApprovalPolicy[] } | { status: "unavailable" }> {
  if (!organizationId) return { status: "success", items: [] };
  try {
    const client = await getSupabaseServerClient();
    const all: ClientApprovalPolicy[] = [];
    for (let offset = 0; ; offset += 100) {
      const response = await client.from("business_approval_policy_versions")
        .select("id,resource_type,version,status,minimum_approvals,required_role_codes,content_hash,created_by,execution_scope")
        .eq("organization_id", organizationId).in("resource_type", ["QUOTE_SELECTION", "CONTRACT_GENERATION", "COST_ALLOCATION"])
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 99);
      if (response.error) return { status: "unavailable" };
      const parsed = z.array(policyRow).safeParse(response.data);
      if (!parsed.success) return { status: "unavailable" };
      all.push(...parsed.data.map((p) => ({ id: p.id, resourceType: p.resource_type, version: p.version, status: p.status,
        minimumApprovals: p.minimum_approvals, roleCodes: p.required_role_codes, contentHash: p.content_hash, createdBy: p.created_by, executionScope: p.execution_scope })));
      if (parsed.data.length < 100) return { status: "success", items: all };
    }
  } catch { return { status: "unavailable" }; }
}

export async function loadApprovalPolicyAccess(organizationId: string): Promise<{ userId: string; canManage: boolean } | null> {
  try {
    const client = await getSupabaseServerClient();
    const auth = await client.auth.getUser();
    if (auth.error || !auth.data.user) return null;
    const membership = await client.from("organization_memberships").select("id").eq("organization_id", organizationId).eq("user_id", auth.data.user.id).eq("status", "ACTIVE").maybeSingle();
    if (membership.error || !membership.data) return null;
    const roles = await client.from("organization_member_roles").select("role_code").eq("membership_id", membership.data.id).is("revoked_at", null).in("role_code", ["CLIENT_OWNER", "CLIENT_ADMIN"]);
    if (roles.error) return null;
    return { userId: auth.data.user.id, canManage: (roles.data?.length ?? 0) > 0 };
  } catch { return null; }
}
