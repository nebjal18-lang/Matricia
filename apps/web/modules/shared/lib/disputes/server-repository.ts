import { classifyAuthReadFailure } from "@/modules/shared/lib/auth/read-failure";
import { readAllPages, readRelatedPages } from "@/modules/shared/lib/data/read-pages";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { createDisputesRepository } from "./repository";

export type DisputeParty = "client" | "provider";

export async function createServerDisputesRepository(requestedOrganizationId?: string, party: DisputeParty = "client") {
  const c = await getSupabaseServerClient();
  const organizationId = z.string().uuid().safeParse(requestedOrganizationId).success ? requestedOrganizationId : null;
  const organizationColumn = party === "provider" ? "provider_organization_id" : "client_organization_id";
  return createDisputesRepository({
    async userId() { const { data, error } = await c.auth.getUser(); if(classifyAuthReadFailure(error)==="UNAVAILABLE")return{error:"UNAVAILABLE" as const};return data.user?.id ?? null; },
    async memberships(id) { return readAllPages((from,to)=>c.from("organization_memberships").select("id,organization_id").eq("user_id", id).eq("status", "ACTIVE").order("id").range(from,to)); },
    async orgRoles(ids) { return readRelatedPages(ids,(batch,from,to)=>c.from("organization_member_roles").select("membership_id,role_code,revoked_at").in("membership_id",batch).order("membership_id").order("role_code").order("library_id",{nullsFirst:true}).order("franchise_id",{nullsFirst:true}).range(from,to)); },
    async missions() { let q = c.from("missions").select("id,status").in("status", ["ACTIVE", "DELIVERY_SUBMITTED", "ACCEPTANCE_IN_PROGRESS"]); if (organizationId) q = q.eq(organizationColumn, organizationId); return readAllPages((from,to)=>q.order("created_at", { ascending: false }).order("id").range(from,to)); },
    async cases(id) { let q = c.from("dispute_cases").select("id,mission_id,client_organization_id,provider_organization_id,obligation_key,description,urgency,status,policy_snapshot,response_due_at,review_due_at,appeal_due_at,row_version,correction_due_at,deadline_calendar_snapshot"); if (organizationId) q = q.eq(organizationColumn, organizationId); if (id) q = q.eq("id", id); return readAllPages((from,to)=>q.order("opened_at", { ascending: false }).order("id").range(from,to)); },
    async evidenceContext(id) { return c.rpc("get_dispute_evidence_context_v1", { p_case_id: id, p_party: party }); },
    async evidence(ids) { return readRelatedPages(ids,(batch,from,to)=>c.from("dispute_evidence").select("id,dispute_case_id,evidence_type,statement,url,evidence_hash,visibility,created_at").in("dispute_case_id",batch).order("created_at").order("id").range(from,to)); },
    async responses(ids) { return readRelatedPages(ids,(batch,from,to)=>c.from("dispute_responses").select("id,dispute_case_id,response_type,statement,submitted_at").in("dispute_case_id",batch).order("submitted_at").order("id").range(from,to)); },
    async decisions(ids) { return readRelatedPages(ids,(batch,from,to)=>c.from("dispute_decisions").select("id,dispute_case_id,decision_number,outcome,reason,evidence_ids,rule_snapshot,decided_at").in("dispute_case_id",batch).order("decision_number").order("id").range(from,to)); },
    async appeals(ids) { return readRelatedPages(ids,(batch,from,to)=>c.from("dispute_appeals").select("id,dispute_case_id,grounds,submitted_at").in("dispute_case_id",batch).order("id").range(from,to)); },
    async events(ids) { return readRelatedPages(ids,(batch,from,to)=>c.from("dispute_case_events").select("id,dispute_case_id,event_type,from_status,to_status,created_at").in("dispute_case_id",batch).order("created_at").order("id").range(from,to)); },
    async reassignments(ids) { return readRelatedPages(ids,(batch,from,to)=>c.from("mission_reassignments").select("id,dispute_case_id,reassignment_key,status,original_cost_minor,proposed_cost_minor,cost_delta_minor,currency,row_version").in("dispute_case_id",batch).order("id").range(from,to)); },
    async rpc(name, input) { return c.rpc(name, input); },
  });
}
