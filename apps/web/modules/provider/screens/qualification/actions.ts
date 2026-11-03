"use server";

import { z } from "zod";
import {interventionDeclaration} from "@/modules/provider/data/qualification/intervention-modes";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { providerCapacityInputSchema, providerDocumentInputSchema, providerProfileInputSchema, providerServiceInputSchema } from "@/modules/provider/data/qualification/model";
import { providerRegionsInputSchema } from "@/modules/provider/data/qualification/regions";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { validateProviderDocumentFile } from "./document-upload";

export type ProviderActionState = { status: "idle" } | { status: "success"; outcome: string } | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "CONFLICT" | "FAILED" };
const outcomeSchema = z.object({ outcome: z.string().min(3), command_id: z.string().uuid() }).passthrough();
const uploadReservationSchema = z.object({
  outcome: z.literal("PROVIDER_DOCUMENT_UPLOAD_RESERVED"),
  status:z.enum(["UPLOAD_PENDING","BOUND"]).default("UPLOAD_PENDING"),
  upload_id: z.string().uuid(),
  storage_bucket: z.literal("provider-qualification"),
  storage_object_path: z.string().min(10).max(1000),
});
const text = (data: FormData, key: string) => String(data.get(key) ?? "");
function failure(error: { code?: string; message?: string } | null): ProviderActionState {
  if (error?.code === "42501") return { status: "error", reason: "FORBIDDEN" };
  if (error?.code === "40001" || error?.code === "23505" || error?.message?.includes("IDEMPOTENCY")) return { status: "error", reason: "CONFLICT" };
  return { status: "error", reason: "FAILED" };
}
async function rpc(name: string, args: Record<string, unknown>): Promise<ProviderActionState> {
  const client = await getSupabaseServerClient(); const { data: auth } = await client.auth.getUser();
  if (!auth.user) return { status: "error", reason: "UNAUTHENTICATED" };
  const result = await client.rpc(name, args); if (result.error) return failure(result.error);
  const parsed = outcomeSchema.safeParse(result.data); return parsed.success ? { status: "success", outcome: parsed.data.outcome } : { status: "error", reason: "FAILED" };
}
export async function submitProviderProfile(_: ProviderActionState, data: FormData): Promise<ProviderActionState> {
  if (!isLocale(text(data,"locale"))) return { status:"error",reason:"VALIDATION" };
  const parsed=providerProfileInputSchema.safeParse({organizationId:text(data,"organizationId"),expectedRowVersion:text(data,"expectedRowVersion"),activitySummary:text(data,"activitySummary"),teamSize:text(data,"teamSize"),yearsExperience:text(data,"yearsExperience"),accountingContactEmail:text(data,"accountingContactEmail"),secondarySubcontractingAllowed:data.get("secondarySubcontractingAllowed")==="yes",idempotencyKey:text(data,"idempotencyKey")});
  if(!parsed.success)return{status:"error",reason:"VALIDATION"};const v=parsed.data;
  return rpc("submit_provider_profile",{p_provider_organization_id:v.organizationId,p_profile:{activity_summary:v.activitySummary,team_size:v.teamSize,years_experience:v.yearsExperience,accounting_contact_email:v.accountingContactEmail,secondary_subcontracting_allowed:v.secondarySubcontractingAllowed},p_expected_row_version:v.expectedRowVersion,p_idempotency_key:v.idempotencyKey});
}
export async function requestProviderService(_: ProviderActionState,data:FormData):Promise<ProviderActionState>{
  if(!isLocale(text(data,"locale")))return{status:"error",reason:"VALIDATION"};const parsed=providerServiceInputSchema.safeParse({organizationId:text(data,"organizationId"),serviceId:text(data,"serviceId"),idempotencyKey:text(data,"idempotencyKey")});if(!parsed.success)return{status:"error",reason:"VALIDATION"};return rpc("request_provider_service",{p_provider_organization_id:parsed.data.organizationId,p_service_id:parsed.data.serviceId,p_idempotency_key:parsed.data.idempotencyKey});
}
export async function declareProviderCapacity(_:ProviderActionState,data:FormData):Promise<ProviderActionState>{
  if(!isLocale(text(data,"locale")))return{status:"error",reason:"VALIDATION"};const status=text(data,"capacityStatus");const unitsRaw=text(data,"availableUnits");const parsed=providerCapacityInputSchema.safeParse({organizationId:text(data,"organizationId"),serviceId:text(data,"serviceId")||null,capacityStatus:status,availableUnits:status==="PAUSED"?null:Number(unitsRaw),leadTimeDays:Number(text(data,"leadTimeDays")),reason:text(data,"reason"),idempotencyKey:text(data,"idempotencyKey")});if(!parsed.success)return{status:"error",reason:"VALIDATION"};const v=parsed.data;return rpc("declare_provider_capacity",{p_provider_organization_id:v.organizationId,p_service_id:v.serviceId,p_capacity_status:v.capacityStatus,p_available_units:v.availableUnits,p_lead_time_days:v.leadTimeDays,p_reason:v.reason,p_idempotency_key:v.idempotencyKey});
}
export async function declareProviderRegions(_:ProviderActionState,data:FormData):Promise<ProviderActionState>{
  if(!isLocale(text(data,"locale")))return{status:"error",reason:"VALIDATION"};
  const parsed=providerRegionsInputSchema.safeParse({organizationId:text(data,"organizationId"),regionCodes:data.getAll("regionCodes").map(String),reason:text(data,"reason"),idempotencyKey:text(data,"idempotencyKey")});
  if(!parsed.success)return{status:"error",reason:"VALIDATION"};const v=parsed.data;
  return rpc("declare_provider_regions",{p_provider_organization_id:v.organizationId,p_region_codes:v.regionCodes,p_reason:v.reason,p_idempotency_key:v.idempotencyKey});
}
export async function recordProviderDocument(_:ProviderActionState,data:FormData):Promise<ProviderActionState>{
  if(!isLocale(text(data,"locale")))return{status:"error",reason:"VALIDATION"};
  const parsed=providerDocumentInputSchema.safeParse({organizationId:text(data,"organizationId"),documentKind:text(data,"documentKind"),code:text(data,"code").toUpperCase(),issuerName:text(data,"issuerName"),referenceNumber:text(data,"referenceNumber"),issuedOn:text(data,"issuedOn"),expiresOn:text(data,"expiresOn"),providerServiceIds:data.getAll("providerServiceIds").map(String),changeReason:text(data,"changeReason"),idempotencyKey:text(data,"idempotencyKey")});
  if(!parsed.success)return{status:"error",reason:"VALIDATION"};
  const v=parsed.data;const client=await getSupabaseServerClient();const{data:auth}=await client.auth.getUser();
  if(!auth.user)return{status:"error",reason:"UNAUTHENTICATED"};
  const file=await validateProviderDocumentFile(data.get("documentFile"));
  if(file.status==="error")return{status:"error",reason:"VALIDATION"};
  const reservation=await client.rpc("begin_provider_document_upload_v2",{p_provider_organization_id:v.organizationId,p_declared_mime_type:file.value.mimeType,p_declared_size_bytes:file.value.sizeBytes,p_expected_content_hash:file.value.sha256,p_operation_key:v.idempotencyKey});
  if(reservation.error)return failure(reservation.error);
  const reserved=uploadReservationSchema.safeParse(reservation.data);if(!reserved.success)return{status:"error",reason:"FAILED"};
  const stored=reserved.data.status==="BOUND"?{error:null}:await client.storage.from(reserved.data.storage_bucket).upload(reserved.data.storage_object_path,file.value.bytes,{contentType:file.value.mimeType,upsert:false,cacheControl:"3600"});
  if(stored.error&&String((stored.error as {statusCode?:string}).statusCode)!=="409")return failure(stored.error);
  const result=await client.rpc("record_provider_document_version",{p_provider_organization_id:v.organizationId,p_document_kind:v.documentKind,p_code:v.code,p_document:{issuer_name:v.issuerName,reference_number:v.referenceNumber,issued_on:v.issuedOn,expires_on:v.expiresOn,storage_object_path:reserved.data.storage_object_path,content_hash:file.value.sha256,metadata:{declared_mime_type:file.value.mimeType,declared_size_bytes:file.value.sizeBytes}},p_provider_service_ids:v.providerServiceIds,p_change_reason:v.changeReason,p_idempotency_key:v.idempotencyKey});
  if(result.error){await client.storage.from(reserved.data.storage_bucket).remove([reserved.data.storage_object_path]);return failure(result.error)}
  const recorded=outcomeSchema.safeParse(result.data);if(!recorded.success){await client.storage.from(reserved.data.storage_bucket).remove([reserved.data.storage_object_path]);return{status:"error",reason:"FAILED"}}
  return{status:"success",outcome:recorded.data.outcome};
}

export async function declareProviderInterventionModes(_:ProviderActionState,data:FormData):Promise<ProviderActionState>{
 if(!isLocale(text(data,"locale")))return{status:"error",reason:"VALIDATION"};
 const parsed=interventionDeclaration.safeParse({organizationId:text(data,"organizationId"),modes:data.getAll("modes").map(String),reason:text(data,"reason"),expectedVersion:text(data,"expectedVersion"),idempotencyKey:text(data,"idempotencyKey")});
 if(!parsed.success)return{status:"error",reason:"VALIDATION"};const v=parsed.data;
 return rpc("declare_provider_intervention_modes",{p_provider_organization_id:v.organizationId,p_modes:v.modes,p_reason:v.reason,p_expected_version:v.expectedVersion,p_idempotency_key:v.idempotencyKey});
}

export async function declareProviderWorkScope(_:ProviderActionState,data:FormData):Promise<ProviderActionState>{
 if(!isLocale(text(data,"locale")))return{status:"error",reason:"VALIDATION"};
 const parsed=z.object({organizationId:z.string().uuid(),radius:z.union([z.literal(""),z.coerce.number().int().nonnegative().max(2147483647)]),summary:z.string().trim().min(3).max(1000),expected:z.coerce.number().int().nonnegative(),reason:z.string().trim().min(3).max(500),key:z.string().uuid()}).safeParse({organizationId:text(data,"organizationId"),radius:text(data,"radiusKm"),summary:text(data,"missionSizeSummary"),expected:text(data,"expectedVersion"),reason:text(data,"reason"),key:text(data,"idempotencyKey")});
 if(!parsed.success)return{status:"error",reason:"VALIDATION"};const v=parsed.data;
 return rpc("declare_provider_work_scope_v1",{p_provider_organization_id:v.organizationId,p_intervention_radius_km:v.radius===""?null:v.radius,p_mission_size_summary:v.summary,p_expected_version:v.expected,p_reason:v.reason,p_operation_key:v.key});
}
