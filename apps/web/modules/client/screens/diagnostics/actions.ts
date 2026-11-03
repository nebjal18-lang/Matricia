"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerDiagnosticsRepository } from "@/modules/shared/lib/diagnostics-opportunities/server-repository";
import { uuid } from "@/modules/shared/lib/diagnostics-opportunities/model";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import {captureMarketingFunnelTouch, recordMarketingFunnelEvent } from "@/modules/shared/lib/marketing-autopilot/funnel";

export type State = {
  status: "idle" | "success" | "error";
  diagnosticRunId?:string;organizationId?:string;
  reason?: "VALIDATION" | "COMMAND" | "NO_SUBMITTED_ASSESSMENT" | "ANALYSIS_SCOPE_REQUIRED" | "PUBLISHED_POLICY_REQUIRED";
};
const base = z.object({ locale: z.enum(["fr", "ar"]), idempotencyKey: uuid });
function values(f: FormData) { return Object.fromEntries(f.entries()); }

export async function completeLatestAction(_: State, f: FormData): Promise<State> {
  const parsed = base.extend({ organizationId: uuid, analysisServiceId:z.union([uuid,z.literal("")]).optional(), confirmSnapshot: z.literal("CONFIRMED") }).safeParse(values(f));
  if (!parsed.success) return { status: "error", reason: "VALIDATION" };

  // Only the selected organization's submitted assessment is needed here.
  // Loading the entire dashboard would make this command depend on unrelated
  // catalogue rows and every diagnostic projection being readable/parseable.
  const client=await getSupabaseServerClient();
  const sessionResult=await client.from("questionnaire_sessions").select("id,organization_id,library_id").eq("organization_id",parsed.data.organizationId).eq("audience","CLIENT").eq("status","SUBMITTED").order("submitted_at",{ascending:false}).order("id").limit(1);
  if(sessionResult.error)return{status:"error",reason:"COMMAND"};
  const sessions=z.array(z.object({id:uuid,organization_id:uuid,library_id:uuid})).max(1).safeParse(sessionResult.data);
  if(!sessions.success)return{status:"error",reason:"COMMAND"};
  const latestSession=sessions.data[0];
  if(!latestSession||latestSession.organization_id!==parsed.data.organizationId)return{status:"error",reason:"NO_SUBMITTED_ASSESSMENT"};
  const repository=await createServerDiagnosticsRepository(parsed.data.organizationId);

  // A service is supplementary explicit context; published SUGGEST_SERVICE actions
  // remain authoritative. No first or sole service is silently attached.
  let serviceId:string|null=null;
  if(parsed.data.analysisServiceId){
    const services=await client.from("catalog_services").select("id").eq("library_id",latestSession.library_id).eq("status","PUBLISHED").not("current_published_version_id","is",null).eq("id",parsed.data.analysisServiceId).limit(1);
    if(services.error||services.data?.length!==1||services.data[0]?.id!==parsed.data.analysisServiceId)return{status:"error",reason:"ANALYSIS_SCOPE_REQUIRED"};
    serviceId=services.data[0].id;
  }
  await captureMarketingFunnelTouch();
  const result = await repository.complete({
    sessionId: latestSession.id,
    serviceId,
    idempotencyKey: parsed.data.idempotencyKey,
    correlationId: randomUUID(),
  });
  if (result.status === "error") return { status: "error", reason: result.reason==="POLICY_REQUIRED"?"PUBLISHED_POLICY_REQUIRED":"COMMAND" };
  const runId=uuid.safeParse(result.value.diagnostic_run_id);
  if(!runId.success)return{status:"error",reason:"COMMAND"};
  if(result.value.opportunity_created===true)await recordMarketingFunnelEvent("OPPORTUNITY_CREATED", runId.data);
  revalidatePath(`/${parsed.data.locale}/client/diagnostics`);
  return { status: "success",diagnosticRunId:runId.data,organizationId:latestSession.organization_id };
}
export async function completeAction(_:State,f:FormData):Promise<State>{const p=base.extend({sessionId:uuid,serviceId:uuid,confirmSnapshot:z.literal("CONFIRMED")}).safeParse(values(f));if(!p.success)return{status:"error",reason:"VALIDATION"};await captureMarketingFunnelTouch();const r=await(await createServerDiagnosticsRepository()).complete({sessionId:p.data.sessionId,serviceId:p.data.serviceId,idempotencyKey:p.data.idempotencyKey,correlationId:randomUUID()});if(r.status==="error")return{status:"error",reason:r.reason==="POLICY_REQUIRED"?"PUBLISHED_POLICY_REQUIRED":"COMMAND"};if(r.value.opportunity_created===true)await recordMarketingFunnelEvent("OPPORTUNITY_CREATED",String(r.value.diagnostic_run_id));revalidatePath(`/${p.data.locale}/client/diagnostics`);return{status:"success"}}
export async function opportunityAction(_:State,f:FormData):Promise<State>{const p=base.extend({runId:uuid,opportunityId:uuid,action:z.enum(["ACCEPT","DEFER","REQUEST_RFQ","CLOSE"]),deferredUntil:z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),z.literal("")]),rowVersion:z.coerce.number().int().positive()}).safeParse(values(f));if(!p.success||(p.data.action==="DEFER"&&!p.data.deferredUntil))return{status:"error",reason:"VALIDATION"};const r=await(await createServerDiagnosticsRepository()).transition({opportunityId:p.data.opportunityId,action:p.data.action,deferredUntil:p.data.deferredUntil?`${p.data.deferredUntil}T23:59:59Z`:null,rowVersion:p.data.rowVersion,idempotencyKey:p.data.idempotencyKey,correlationId:randomUUID()});if(r.status==="error")return{status:"error",reason:"COMMAND"};revalidatePath(`/${p.data.locale}/client/diagnostics/${p.data.runId}`);return{status:"success"}}
