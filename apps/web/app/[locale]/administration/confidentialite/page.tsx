import{DsrRectificationPanel}from"@/modules/admin/screens/privacy/rectification-panel";
import { RetentionExecutionPanel } from "@/modules/admin/screens/privacy/retention-panel";
import { retentionConsoleSchema } from "@/modules/admin/screens/privacy/retention-model";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { sensitivePageContext, adminReadFailure } from "@/modules/admin/ui/sensitive-page-context";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { PrivacyPanel } from "@/modules/admin/screens/privacy/panel";
export const dynamic = "force-dynamic";
export default async function PrivacyPage({params}: {params: Promise<{locale:string}>}) {
 const {locale} = await params; if(!isLocale(locale)) notFound();
 const context = await sensitivePageContext({ locale, path: "confidentialite", active: "settings", title: locale === "ar" ? "الخصوصية وحقوق الأشخاص" : "Confidentialité et droits des personnes", lead: locale === "ar" ? "معالجة موثقة ومحددة النطاق." : "Traitement traçable et limité au périmètre autorisé.", roles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "READ_ONLY_AUDITOR"] });
 if (context.status === "blocked") return context.view;
 const client = context.access.client;
 const [response, retentionResponse, rectificationResponse] = await Promise.all([client.rpc("get_admin_privacy_console_v1"),client.rpc("get_admin_retention_execution_console_v1"),client.rpc("get_admin_dsr_rectification_console_v1")]);
 const rectification=z.array(z.object({requestId:z.string().uuid(),organizationName:z.string(),displayName:z.string(),preferredLocale:z.string(),profileVersion:z.number()})).safeParse(rectificationResponse.data);
 const retention = retentionConsoleSchema.safeParse(retentionResponse.data);
 const parsed = z.object({retentionActions:z.array(z.object({id:z.string().uuid(),organizationId:z.string().uuid(),actionType:z.string(),status:z.string(),requestedAt:z.string(),responsibleRole:z.string(),workItemId:z.string().uuid().nullable()})).default([]),requests:z.array(z.object({id:z.string().uuid(),organization_id:z.string().uuid(),request_type:z.string(),status:z.string(),due_at:z.string(),row_version:z.number(),export_reference:z.string().nullable().optional()})),policies:z.array(z.object({id:z.string().uuid(),organization_id:z.string().uuid(),disposition:z.string(),retention_days:z.number()})),organizations:z.array(z.object({id:z.string().uuid(),display_name:z.string()}))}).safeParse(response.data);
 return context.wrap(<main className="client-page">{response.error||!parsed.success?<WorkspaceFailure locale={locale} reason={adminReadFailure(response.error)} returnPath={context.selfPath} />:<div className="client-stack"><PrivacyPanel locale={locale} {...parsed.data} keys={Array.from({length:parsed.data.requests.length+3},()=>randomUUID())}/>{!retentionResponse.error && retention.success ? <RetentionExecutionPanel locale={locale} data={retention.data} keys={[randomUUID(),randomUUID()]}/> : <WorkspaceFailure locale={locale} reason={adminReadFailure(retentionResponse.error)} returnPath={context.selfPath} />}{!rectificationResponse.error&&rectification.success?<DsrRectificationPanel locale={locale}items={rectification.data}keys={Object.fromEntries(rectification.data.map((r)=>[r.requestId,randomUUID()]))}/>:<WorkspaceFailure locale={locale} reason={adminReadFailure(rectificationResponse.error)} returnPath={context.selfPath} />}</div>}</main>);
}
