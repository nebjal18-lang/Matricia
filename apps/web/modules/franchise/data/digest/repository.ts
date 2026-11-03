import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { digestConfigurationRow, digestJobRow, digestRow, latestConfigurations, type FranchiseDigestDashboard } from "./model";

const id = z.string().uuid();
const franchise = z.object({ id, operator_organization_id: id, territory_code: z.string(), status: z.literal("ACTIVE"), current_mandate_version_id: id });
const mandate = z.object({ id, franchise_id: id, territory_version_id: id, version: z.number().int().positive(), mandate_status: z.literal("ACTIVE") });
const territory = z.object({ id, franchise_id: id, territory_code: z.string(), name_fr: z.string(), name_ar: z.string() });
const membership = z.object({ organization_id: id, organization_member_roles: z.array(z.object({ role_code: z.string(), franchise_id: id.nullable(), revoked_at: z.string().nullable(),organization_member_franchise_assignments:z.array(z.object({franchise_id:id,revoked_at:z.string().nullable()})).optional() })) });

export type FranchiseDigestLoadResult = { status: "success"; dashboard: FranchiseDigestDashboard } | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "QUERY_FAILED" | "INVALID_RESPONSE" };

export async function loadFranchiseDigest(franchiseId?: string): Promise<FranchiseDigestLoadResult> {
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const [franchisesResult, mandatesResult, territoriesResult, membershipsResult, configurationsResult, digestsResult, jobsResult] = await Promise.all([
    client.from("franchises").select("id,operator_organization_id,territory_code,status,current_mandate_version_id").match(franchiseId ? { id: franchiseId } : {}).eq("status", "ACTIVE").order("created_at", { ascending: false }).limit(100),
    client.from("franchise_mandate_versions").select("id,franchise_id,territory_version_id,version,mandate_status").match(franchiseId ? { franchise_id: franchiseId } : {}).eq("mandate_status", "ACTIVE").limit(100),
    client.from("franchise_territory_versions").select("id,franchise_id,territory_code,name_fr,name_ar").match(franchiseId ? { franchise_id: franchiseId } : {}).limit(200),
    client.from("organization_memberships").select("organization_id,organization_member_roles(role_code,franchise_id,revoked_at,organization_member_franchise_assignments(franchise_id,revoked_at))").eq("user_id", auth.user.id).eq("status", "ACTIVE").limit(100),
    client.from("franchise_daily_digest_config_versions").select("id,franchise_id,recipient_user_id,version,enabled,frequency,local_send_time,time_zone,locale,created_at").match(franchiseId ? { franchise_id: franchiseId } : {}).eq("recipient_user_id", auth.user.id).order("version", { ascending: false }).limit(300),
    client.from("franchise_daily_digests").select("id,franchise_id,digest_date,locale,metrics_snapshot,generated_at").match(franchiseId ? { franchise_id: franchiseId } : {}).order("digest_date", { ascending: false }).limit(60),
    client.from("franchise_daily_digest_jobs").select("id,digest_id,franchise_id,recipient_user_id,status,attempt_count,next_attempt_at,last_error_code,updated_at").match(franchiseId ? { franchise_id: franchiseId } : {}).eq("recipient_user_id", auth.user.id).order("updated_at", { ascending: false }).limit(100),
  ]);
  if ([franchisesResult, mandatesResult, territoriesResult, membershipsResult, configurationsResult, digestsResult, jobsResult].some((result) => result.error)) return { status: "error", reason: "QUERY_FAILED" };
  const franchises = z.array(franchise).safeParse(franchisesResult.data), mandates = z.array(mandate).safeParse(mandatesResult.data), territories = z.array(territory).safeParse(territoriesResult.data), memberships = z.array(membership).safeParse(membershipsResult.data), configurations = z.array(digestConfigurationRow).safeParse(configurationsResult.data), digests = z.array(digestRow).safeParse(digestsResult.data), jobs = z.array(digestJobRow).safeParse(jobsResult.data);
  if (!franchises.success || !mandates.success || !territories.success || !memberships.success || !configurations.success || !digests.success || !jobs.success) return { status: "error", reason: "INVALID_RESPONSE" };
  const franchiseRoles = memberships.data.flatMap((member) => member.organization_member_roles.filter((role) => role.revoked_at === null && ["FRANCHISE_OWNER", "FRANCHISE_MANAGER", "FRANCHISE_VIEWER"].includes(role.role_code)).flatMap((role) => role.organization_member_franchise_assignments?.length?role.organization_member_franchise_assignments.filter((a)=>a.revoked_at===null).map((a)=>({organizationId:member.organization_id,franchiseId:a.franchise_id})):[{organizationId:member.organization_id,franchiseId:role.franchise_id}]));
  const allowed = franchises.data.filter((item) => franchiseRoles.some((role) => role.organizationId === item.operator_organization_id && (role.franchiseId === item.id || (role.franchiseId === null && franchises.data.filter((candidate) => candidate.operator_organization_id === item.operator_organization_id).length === 1))));
  const scoped = allowed.flatMap((item) => { const mandateValue = mandates.data.find((value) => value.id === item.current_mandate_version_id && value.franchise_id === item.id), territoryValue = mandateValue ? territories.data.find((value) => value.id === mandateValue.territory_version_id && value.franchise_id === item.id && value.territory_code === item.territory_code) : undefined; return mandateValue && territoryValue ? [{ id: item.id, territoryCode: item.territory_code, territoryNameFr: territoryValue.name_fr, territoryNameAr: territoryValue.name_ar, mandateVersion: mandateValue.version }] : []; });
  if (!scoped.length) return { status: "error", reason: "FORBIDDEN" };
  const ids = new Set(scoped.map((item) => item.id));
  return { status: "success", dashboard: { currentUserId: auth.user.id, franchises: scoped, configurations: latestConfigurations(configurations.data.filter((item) => ids.has(item.franchise_id))), digests: digests.data.filter((item) => ids.has(item.franchise_id)), jobs: jobs.data.filter((item) => ids.has(item.franchise_id)) } };
}
