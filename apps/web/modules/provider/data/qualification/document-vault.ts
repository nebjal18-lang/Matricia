import { z } from "zod";
import { selectProviderMembership } from "@/modules/provider/data/spaces/organization-context";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { getServerAuthUser, getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import type { ProviderDocument } from "./model";

const uuid = z.string().uuid();
const membershipSchema = z.object({
  id: uuid,
  organization_id: uuid,
  organizations: z.object({ display_name: z.string().min(1) }),
  organization_member_roles: z.array(z.object({ role_code: z.string(), revoked_at: z.string().nullable() })).default([]),
});
const documentSchema = z.object({
  id: uuid,
  version_number: z.number().int().positive(),
  status: z.string(),
  expires_on: z.string().nullable(),
  storage_object_path: z.string().optional(),
  provider_document_families: z.object({ document_kind: z.string(), code: z.string() }),
});

export type ProviderDocumentVault =
  | {
      status: "success";
      organizationId: string;
      organizationName: string;
      canManage: boolean;
      page: number;
      hasMore: boolean;
      documents: ProviderDocument[];
    }
  | {
      status: "error";
      reason:
        | "UNAUTHENTICATED"
        | "AUTH_QUERY_FAILED"
        | "NO_PROVIDER_ORGANIZATION"
        | "MEMBERSHIP_QUERY_FAILED"
        | "MEMBERSHIP_SHAPE_INVALID"
        | "DOCUMENTS_QUERY_FAILED"
        | "DOCUMENTS_SHAPE_INVALID";
    };

/** Lightweight vault read — independent from catalogue/eligibility so a catalog failure cannot blank the coffre. */
export async function loadProviderDocumentVault(
  requestedOrganizationId?: string,
  documentPage = 1,
  documentFilter: { search?: string; kinds?: string[] } = {},
): Promise<ProviderDocumentVault> {
  const [client, authResult] = await Promise.all([getSupabaseServerClient(), getServerAuthUser()]);
  const { data: auth, error: authError } = authResult;
  const authFailure = classifyAuthReadFailure(authError);
  if (authFailure) return { status: "error", reason: authFailure === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : "AUTH_QUERY_FAILED" };
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };

  const membershipResult = await client
    .from("organization_memberships")
    .select("id,organization_id,organizations!inner(display_name),organization_member_roles!inner(role_code,revoked_at)")
    .eq("user_id", auth.user.id)
    .eq("status", "ACTIVE")
    .is("organization_member_roles.revoked_at", null)
    .in("organization_member_roles.role_code", ["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_TECHNICIAN", "PROVIDER_ACCOUNTING", "PROVIDER_VIEWER"])
    .limit(100);
  if (membershipResult.error) return { status: "error", reason: "MEMBERSHIP_QUERY_FAILED" };
  const memberships = z.array(membershipSchema).safeParse(membershipResult.data);
  if (!memberships.success) return { status: "error", reason: "MEMBERSHIP_SHAPE_INVALID" };
  const selected = selectProviderMembership(memberships.data, requestedOrganizationId);
  if (!selected) return { status: "error", reason: "NO_PROVIDER_ORGANIZATION" };

  const organizationId = selected.organization_id;
  const page = Number.isSafeInteger(documentPage) && documentPage > 0 && documentPage <= 100000 ? documentPage : 1;
  const documentsResult = await client.rpc("list_provider_entry_documents_v1", {
    p_provider_organization_id: organizationId,
    p_page: page,
    p_search: documentFilter.search ?? "",
    p_kinds: documentFilter.kinds ?? [],
  });
  if (documentsResult.error) return { status: "error", reason: "DOCUMENTS_QUERY_FAILED" };
  const pageResult = z.object({ items: z.array(documentSchema).max(31), required_documents_complete: z.boolean() }).safeParse(documentsResult.data);
  if (!pageResult.success) return { status: "error", reason: "DOCUMENTS_SHAPE_INVALID" };

  const documents = pageResult.data.items;
  const documentPaths = documents.flatMap((item) => (item.storage_object_path ? [item.storage_object_path] : []));
  const scansResult = documentPaths.length
    ? await client.from("provider_document_scan_jobs").select("storage_object_path,scan_status").eq("provider_organization_id", organizationId).in("storage_object_path", documentPaths)
    : { data: [], error: null };
  if (scansResult.error) return { status: "error", reason: "DOCUMENTS_QUERY_FAILED" };
  const scans = z.array(z.object({ storage_object_path: z.string(), scan_status: z.enum(["PENDING", "CLEAN", "INFECTED", "ERROR"]) })).safeParse(scansResult.data ?? []);
  if (!scans.success) return { status: "error", reason: "DOCUMENTS_SHAPE_INVALID" };
  const scansByPath = new Map(scans.data.map((item) => [item.storage_object_path, item.scan_status]));

  return {
    status: "success",
    organizationId,
    organizationName: selected.organizations.display_name,
    canManage: selected.organization_member_roles.some((role) => role.revoked_at === null && ["PROVIDER_OWNER", "PROVIDER_MANAGER"].includes(role.role_code)),
    page,
    hasMore: documents.length > 30,
    documents: documents.slice(0, 30).map((item) => ({
      id: item.id,
      kind: item.provider_document_families.document_kind,
      code: item.provider_document_families.code,
      version: item.version_number,
      status: item.status,
      scanStatus: item.storage_object_path ? scansByPath.get(item.storage_object_path) : undefined,
      expiresOn: item.expires_on,
    })),
  };
}
