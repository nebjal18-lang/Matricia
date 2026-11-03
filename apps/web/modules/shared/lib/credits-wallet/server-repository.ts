import { readAllPages } from "@/modules/shared/lib/data/read-pages";
import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { createCreditsRepository } from "./repository";

export async function createServerCreditsRepository(requestedOrganizationId?: string) {
  const c = await getSupabaseServerClient();
  const requested = z.string().uuid().safeParse(requestedOrganizationId).success ? requestedOrganizationId : null;
  const scope = (ids: string[]) => requested && ids.includes(requested) ? [requested] : requested ? [] : ids;
  let catalogue: Promise<{ data: unknown; error: unknown }> | undefined;
  async function publicCatalogue(ids: string[]) {
    const scoped = scope(ids);
    if (!scoped.length) return { data: { benefits: [], boxes: [] }, error: null };
    if (scoped.length !== 1) return { data: null, error: { code: "42501" } };
    catalogue ??= Promise.resolve(c.rpc("list_client_credit_catalog_v1", { p_organization_id: scoped[0] }));
    const result = await catalogue;
    const data = result.data as { organization_id?: unknown; benefits?: unknown; boxes?: unknown } | null;
    return result.error || !data || data.organization_id !== scoped[0] || !Array.isArray(data.benefits) || !Array.isArray(data.boxes)
      ? { data: null, error: result.error ?? { code: "INVALID_RESPONSE" } }
      : { data: { benefits: data.benefits, boxes: data.boxes }, error: null };
  }
  let identity: ReturnType<typeof c.auth.getUser> | undefined;
  const readIdentity = () => identity ??= c.auth.getUser();
  const repository = createCreditsRepository({
    async user() { const { data } = await readIdentity(); return data.user?.id ?? null; },
    async memberships(id) { return c.from("organization_memberships").select("id,organization_id").eq("user_id", id).eq("status", "ACTIVE").limit(100); },
    async roles(ids) { return ids.length ? c.from("organization_member_roles").select("membership_id,role_code,revoked_at").in("membership_id", ids).limit(300) : { data: [], error: null }; },
    async organizations(ids) { const scoped = scope(ids); return scoped.length ? c.from("organizations").select("id,display_name").in("id", scoped).limit(1) : { data: [], error: null }; },
    async wallets(ids) { const scoped = scope(ids); return scoped.length ? c.from("credit_wallets").select("id,organization_id,unit_code").in("organization_id", scoped).eq("wallet_type", "CLIENT").limit(100) : { data: [], error: null }; },
    async balances(ids) { const scoped = scope(ids); return scoped.length ? c.from("credit_wallet_balances").select("wallet_id,balance::text").in("organization_id", scoped).eq("wallet_type", "CLIENT").limit(100) : { data: [], error: null }; },
    async lots(ids) { const scoped = scope(ids); return scoped.length ? readAllPages((from,to) => c.from("client_credit_lot_positions_v1").select("id,wallet_id,source_type,quantity,expires_at,library_id,available,reserved").in("organization_id", scoped).order("expires_at").order("id").range(from,to)) : { data: [], error: null }; },
    async funding(ids) { const scoped = scope(ids); return scoped.length ? c.rpc("list_credit_lot_funding_statuses_v1", { p_organization_ids: scoped }) : { data: [], error: null }; },
    async movements(ids) { const scoped = scope(ids); return scoped.length ? readAllPages((from,to)=>c.from("credit_lot_movements").select("credit_lot_id,movement_type,quantity::text").in("organization_id",scoped).order("id").range(from,to)) : { data: [], error: null }; },
    async benefits(ids) {
      const result = await publicCatalogue(ids);
      if (result.error || !result.data) return { data: null, error: result.error };
      const rows = result.data.benefits;
      if (!rows.every((row) => row && typeof row === "object" && !Array.isArray(row) && typeof row.reservable === "boolean")) return { data: null, error: { code: "INVALID_RESPONSE" } };
      return { data: rows.filter((row) => row.reservable).map((row) => { const copy = { ...row }; delete copy.reservable; return copy; }), error: null };
    },
    async boxes(ids) {
      const result = await publicCatalogue(ids);
      return result.error || !result.data ? { data: null, error: result.error } : { data: result.data.boxes, error: null };
    },
    async customerBoxes(ids) { const scoped = scope(ids); return scoped.length ? readAllPages((from,to) => c.from("customer_boxes").select("id,organization_id,box_version_id,period_start,period_end").in("organization_id", scoped).order("period_end", { ascending: false }).order("id").range(from,to)) : { data: [], error: null }; },
    async redemptions(ids) { const scoped = scope(ids); return scoped.length ? readAllPages((from,to) => c.from("benefit_redemptions").select("id,organization_id,wallet_id,benefit_version_id,units::text,reserved_credits::text,status,reservation_expires_at,delivery_proof_hash,row_version::text").in("organization_id", scoped).order("created_at", { ascending: false }).order("id").range(from,to)) : { data: [], error: null }; },
    async acceptedProof(id) { return c.from("benefit_redemptions").select("id,status,delivery_proof_hash").eq("id", id).maybeSingle(); },
    async rpc(name, input) { return c.rpc(name, input); },
  });
  return {
    ...repository,
    async load() {
      const { data, error } = await readIdentity();
      const failure = classifyAuthReadFailure(error);
      if (failure) return { status: "error" as const, reason: failure };
      if (!data.user) return { status: "error" as const, reason: "UNAUTHENTICATED" as const };
      if (requestedOrganizationId !== undefined && !requested) return { status: "error" as const, reason: "INVALID_INPUT" as const };
      const result = await repository.load();
      if (result.status === "success" && requested && !result.value.organizations.some(item => item.id === requested)) return { status: "error" as const, reason: "FORBIDDEN" as const };
      return result;
    },
  };
}
