import { z } from "zod";
import type { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export type AllocationTarget = { id: string; organizationId: string; type: "MISSION" | "MISSION_MILESTONE" | "INVOICE" | "DOCUMENT" | "RFQ"; labelFr: string; labelAr: string };
const id = z.string().uuid();
const entity = z.object({ id, organization_id: id.optional(), client_organization_id: id.optional() }).passthrough();
const invoice = z.object({ id, organization_id: id, label_fr: z.string().min(1), label_ar: z.string().min(1) });
const milestone = z.object({ id, title_fr: z.string(), title_ar: z.string(), missions: z.object({ client_organization_id: id }) });
/** Uses the authenticated connection and existing tenant projections; never bypasses RLS. */
export async function loadAllocationTargets(client: Awaited<ReturnType<typeof getSupabaseServerClient>>, organizationId: string): Promise<{ status: "success" | "partial"; targets: AllocationTarget[]; truncated: boolean; invoiceError?: "FORBIDDEN" | "UNAVAILABLE" | "INVALID_RESPONSE" } | { status: "unavailable" }> {
  const results = await Promise.all([
    client.from("missions").select("id,client_organization_id").eq("client_organization_id", organizationId).order("id").limit(101),
    client.from("mission_milestones").select("id,title_fr,title_ar,missions!inner(client_organization_id)").eq("missions.client_organization_id", organizationId).order("id").limit(101),
    client.rpc("list_client_allocation_invoice_targets", {p_organization_id:organizationId,p_limit:101}),
    client.from("client_compliance_documents").select("id,organization_id,original_file_name").eq("organization_id", organizationId).order("id").limit(101),
    // The typed allocation contract calls this RFQ but references the originating service_request.
    client.from("service_requests").select("id,client_organization_id").eq("client_organization_id", organizationId).order("id").limit(101),
  ]);
  if (results.some((result,index) => index !== 2 && result.error)) return { status: "unavailable" };
  const missions=z.array(entity).safeParse(results[0]!.data), milestones=z.array(milestone).safeParse(results[1]!.data), invoices=z.array(invoice).safeParse(results[2]!.error ? [] : results[2]!.data), documents=z.array(entity.extend({original_file_name:z.string()})).safeParse(results[3]!.data), requests=z.array(entity).safeParse(results[4]!.data);
  if (!missions.success || !milestones.success || !documents.success || !requests.success) return { status: "unavailable" };
  const invoiceRows = invoices.success ? invoices.data : [];
  const invoiceError = results[2]!.error ? (results[2]!.error.code === "42501" ? "FORBIDDEN" as const : "UNAVAILABLE" as const) : !invoices.success ? "INVALID_RESPONSE" as const : undefined;
  if (missions.data.some(row=>row.client_organization_id!==organizationId) || milestones.data.some(row=>row.missions.client_organization_id!==organizationId) || invoiceRows.some(row=>row.organization_id!==organizationId) || documents.data.some(row=>row.organization_id!==organizationId) || requests.data.some(row=>row.client_organization_id!==organizationId)) return { status:"unavailable" };
  const targets: AllocationTarget[] = [
    ...missions.data.slice(0,100).map(row=>({id:row.id,organizationId,type:"MISSION" as const,labelFr:`Mission · ${row.id.slice(0,8)}`,labelAr:`مهمة تعاقدية · ${row.id.slice(0,8)}`})),
    ...milestones.data.slice(0,100).map(row=>({id:row.id,organizationId,type:"MISSION_MILESTONE" as const,labelFr:row.title_fr,labelAr:row.title_ar})),
    ...invoiceRows.slice(0,100).map(row=>({id:row.id,organizationId,type:"INVOICE" as const,labelFr:row.label_fr,labelAr:row.label_ar})),
    ...documents.data.slice(0,100).map(row=>({id:row.id,organizationId,type:"DOCUMENT" as const,labelFr:row.original_file_name,labelAr:row.original_file_name})),
    ...requests.data.slice(0,100).map(row=>({id:row.id,organizationId,type:"RFQ" as const,labelFr:`Dossier de demande · ${row.id.slice(0,8)}`,labelAr:`ملف الطلب · ${row.id.slice(0,8)}`})),
  ];
  const truncated = results.some(result=>Array.isArray(result.data) && result.data.length>100);
  return { status: truncated || invoiceError ? "partial" : "success", truncated, invoiceError, targets:[...new Map(targets.map(item=>[`${item.type}:${item.id}`,item])).values()] };
}
