import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { readAllPages } from "@/modules/client/data/pagination";
import { z } from "zod";
import { resolveClientOrganizationContext } from "@/modules/shared/client-organization-context";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

const uuid = z.string().uuid();
const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value as Record<string, unknown>[] : [];
const text = (row: Record<string, unknown>, key: string) => String(row[key] ?? "");
const nullableText = (row: Record<string, unknown>, key: string) => row[key] == null ? null : String(row[key]);
export type DocumentVault = { organizations: Array<{ id: string; name: string }>; documents: Array<{ id: string; organizationId: string; type: string; version: number; fileName: string; expiresOn: string | null; status: string; scanStatus: string; scanResultId: string | null }>; targets: Array<{ id: string; organizationId: string; type: "SERVICE_REQUEST" | "CONTRACT_VERSION" | "MISSION"; label: string }>; hasNext?: boolean; page?: number; total?: number; expiredDocumentCount?: number; bindings: Array<{ id: string; organizationId: string; documentId: string; targetType: string; targetId: string; purpose: string; documentVersion: number; revokedAt: string | null }> };
export type VaultResult = { status: "success"; value: DocumentVault } | { status: "error"; reason: "UNAUTHENTICATED" | "UNAVAILABLE" | "INVALID_RESPONSE" | "FORBIDDEN" };
const empty = (): VaultResult => ({ status: "success", value: { organizations: [], documents: [], targets: [], bindings: [] } });

export async function loadClientDocumentVault(requestedOrganizationId?: string, page = 1, options?: { query?: string; includePending?: boolean }): Promise<VaultResult> {
  const client = await getSupabaseServerClient(), { data: auth, error: authError } = await client.auth.getUser();
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure) return { status: "error", reason: authFailure };
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const membershipsResult = await client.from("organization_memberships").select("id,organization_id").eq("user_id", auth.user.id).eq("status", "ACTIVE").limit(100);
  if (membershipsResult.error) return { status: "error", reason: "UNAVAILABLE" };
  const memberships = rows(membershipsResult.data), membershipIds = memberships.map((item) => text(item, "id"));
  if (!membershipIds.length) return empty();
  const rolesResult = await client.from("organization_member_roles").select("membership_id").in("membership_id", membershipIds).is("revoked_at", null).in("role_code", ["CLIENT_OWNER", "CLIENT_ADMIN"]).limit(300);
  if (rolesResult.error) return { status: "error", reason: "UNAVAILABLE" };
  const allowedMemberships = new Set(rows(rolesResult.data).map((item) => text(item, "membership_id")));
  const authorized = memberships.filter((item) => allowedMemberships.has(text(item, "id"))).map((item) => ({ organization_id: text(item, "organization_id") }));
  if (!authorized.every((item) => uuid.safeParse(item.organization_id).success)) return { status: "error", reason: "INVALID_RESPONSE" };
  const context = resolveClientOrganizationContext(authorized, requestedOrganizationId);
  if (context.status === "error") return { status: "error", reason: "FORBIDDEN" };
  const organizationId = context.membership.organization_id;
  const [organizationResult, documentsResult, requestsResult, contractsResult, missionsResult, bindingsResult, revocationsResult] = await Promise.all([
    client.from("organizations").select("id,display_name").eq("id", organizationId).limit(1),
    client.rpc("list_client_document_page", { p_organization_id: organizationId, p_query: options?.query ?? "", p_page: Math.min(100000,Math.max(1,page)), p_include_pending: options?.includePending ?? false }),
    readAllPages((from,to) => client.from("service_requests").select("id,client_organization_id,status").eq("client_organization_id", organizationId).order("created_at", { ascending: false }).order("id").range(from,to)),
    readAllPages((from,to) => client.from("contracts").select("id,client_organization_id,status,current_version").eq("client_organization_id", organizationId).order("updated_at", { ascending: false }).order("id").range(from,to)),
    readAllPages((from,to) => client.from("missions").select("id,client_organization_id,status").eq("client_organization_id", organizationId).order("updated_at", { ascending: false }).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_document_bindings").select("id,organization_id,document_id,target_type,target_id,purpose,document_version").eq("organization_id", organizationId).order("created_at", { ascending: false }).order("id").range(from,to)),
    readAllPages((from,to) => client.from("client_document_binding_revocations").select("binding_id,revoked_at").eq("organization_id", organizationId).order("binding_id").range(from,to)),
  ]);
  if ([organizationResult, documentsResult, requestsResult, contractsResult, missionsResult, bindingsResult, revocationsResult].some((result) => result.error)) return { status: "error", reason: "UNAVAILABLE" };
  const documentPage = z.object({ documents: z.array(z.record(z.string(),z.unknown())), total: z.number().int().nonnegative().safe(), expired_count: z.number().int().nonnegative().safe() }).safeParse(documentsResult.data);
  if (!documentPage.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const contracts = rows(contractsResult.data), contractIds = contracts.map((item) => text(item, "id"));
  const versionsResult = contractIds.length ? await readAllPages((from,to) => client.from("contract_versions").select("id,contract_id,version").in("contract_id", contractIds).order("id").range(from,to)) : { data: [], error: null };
  if (versionsResult.error) return { status: "error", reason: "UNAVAILABLE" };
  const versions = rows(versionsResult.data), revoked = new Map(rows(revocationsResult.data).map((item) => [text(item, "binding_id"), text(item, "revoked_at")])), targets: DocumentVault["targets"] = [];
  for (const item of rows(requestsResult.data)) targets.push({ id: text(item, "id"), organizationId, type: "SERVICE_REQUEST", label: `Demande ${text(item, "id").slice(0, 8)} · ${text(item, "status")}` });
  for (const item of contracts) { const version = versions.find((candidate) => text(candidate, "contract_id") === text(item, "id") && Number(candidate.version) === Number(item.current_version)); if (version) targets.push({ id: text(version, "id"), organizationId, type: "CONTRACT_VERSION", label: `Contrat ${text(item, "id").slice(0, 8)} · v${String(item.current_version)} · ${text(item, "status")}` }); }
  for (const item of rows(missionsResult.data)) targets.push({ id: text(item, "id"), organizationId, type: "MISSION", label: `Mission ${text(item, "id").slice(0, 8)} · ${text(item, "status")}` });
  const hasNext = documentPage.data.documents.length > 25;
  const documents = documentPage.data.documents.slice(0,25).map((item) => ({ id: text(item, "id"), organizationId, type: text(item, "document_type"), version: Number(item.version), fileName: text(item, "original_file_name"), expiresOn: nullableText(item, "expires_on"), status: text(item,"status"), scanStatus: text(item,"scan_status"), scanResultId: nullableText(item,"current_scan_result_id") }));
  const bindings = rows(bindingsResult.data).map((item) => ({ id: text(item, "id"), organizationId, documentId: text(item, "document_id"), targetType: text(item, "target_type"), targetId: text(item, "target_id"), purpose: text(item, "purpose"), documentVersion: Number(item.document_version), revokedAt: revoked.get(text(item, "id")) ?? null }));
  if ([...documents, ...targets, ...bindings].some((item) => !uuid.safeParse(item.id).success)) return { status: "error", reason: "INVALID_RESPONSE" };
  return { status: "success", value: { hasNext, page, total: documentPage.data.total, expiredDocumentCount: documentPage.data.expired_count, organizations: rows(organizationResult.data).map((item) => ({ id: text(item, "id"), name: text(item, "display_name") })), documents, targets, bindings } };
}
