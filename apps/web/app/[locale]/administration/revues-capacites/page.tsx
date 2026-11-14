import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { actorOrganizationLabel } from "@/modules/admin/data/spaces/actor-presentation";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
import { sensitivePageContext, adminReadFailure } from "@/modules/admin/ui/sensitive-page-context";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { CapabilityResolutionForm } from "@/modules/admin/screens/capability-reviews/resolution-form";
export default async function CapabilityReviewsPage({params}:{params:Promise<{locale:string}>}){
 const{locale}=await params;if(!isLocale(locale))notFound();const ar=locale==="ar";
 const context = await sensitivePageContext({ locale, path: "revues-capacites", active: "actors", actorCurrent: "capability-reviews", title: ar ? "مراجعات القدرات" : "Revues de capacités", lead: ar ? "الصلاحيات الفعلية تتبع الأدوار المعتمدة وسياسات قاعدة البيانات." : "Les droits effectifs suivent les rôles autorisés et les politiques de la base.", roles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "READ_ONLY_AUDITOR"] });
 if (context.status === "blocked") return context.view;
 const r = await context.access.client.rpc("get_admin_capability_reviews_v1");
 const parsed=z.array(z.object({id:z.string().uuid(),userId:z.string().uuid(),organizationId:z.string().uuid(),organizationName:z.string(),requestedCapabilities:z.array(z.string()),status:z.string(),resolution:z.string().nullable(),roles:z.array(z.string())})).safeParse(r.data);
 const statusLabel=(status:string)=>{
  if(status==="PENDING_POLICY_REVIEW")return ar?"قيد مراجعة السياسة":"En attente de revue politique";
  if(status==="RESOLVED")return ar?"محسوم":"Résolu";
  if(status==="REJECTED")return ar?"مرفوض":"Refusé";
  return localizeStatus(status, locale);
 };
 const resolutionLabel=(resolution:string|null)=>{
  if(!resolution)return "—";
  if(resolution==="GRANT_VIA_ROLE"||resolution==="CANONICAL_ROLE_APPLIED")return ar?"منح عبر دور معتمد":"Accord via rôle autorisé";
  if(resolution==="REJECT"||resolution==="REJECTED")return ar?"رفض الطلب":"Demande refusée";
  return localizeStatus(resolution, locale);
 };
 const capabilityLabel=(code:string)=>{
  const key=code.toUpperCase();
  if(key==="ADMIN"||key==="PLATFORM_ADMIN")return ar?"إدارة المنصة":"Administration plateforme";
  if(key==="FINANCE")return ar?"مالية":"Finance";
  if(key==="COMPLIANCE")return ar?"امتثال":"Conformité";
  if(key==="SUPPORT")return ar?"دعم":"Support";
  if(key==="READ_ONLY"||key==="AUDITOR")return ar?"تدقيق للقراءة":"Audit en lecture";
  return localizeStatus(code, locale);
 };
 const rows = parsed.success ? parsed.data : [];
 return context.wrap(<main className="client-page">{r.error||!parsed.success?<WorkspaceFailure locale={locale} reason={adminReadFailure(r.error)} returnPath={context.selfPath} />:<div className="client-stack">{!rows.length?<p>{ar?"لا طلبات متاحة.":"Aucune demande visible."}</p>:rows.map((review)=><article key={review.id} className="client-card"><h2>{actorOrganizationLabel(review.organizationName, locale)}</h2><p><strong>{ar?"الحالة":"État"}</strong> · {statusLabel(review.status)}</p>{review.resolution?<p><strong>{ar?"القرار":"Décision"}</strong> · {resolutionLabel(review.resolution)}</p>:null}<p>{review.requestedCapabilities.map(capabilityLabel).join(" · ")||"—"}</p><p>{ar?"لا يتم منح صلاحيات إضافية بهذه المراجعة. اختاروا دوراً معتمداً ثم تحققوا من تطبيقه أو ارفضوا الطلب.":"Cette revue n’accorde aucun privilège supplémentaire. Choisissez un rôle autorisé, vérifiez son application, ou refusez la demande."}</p><Link href={`/${locale}/administration/utilisateurs/${review.userId}/roles?organizationId=${review.organizationId}`}>{ar?"طلب تعديل الدور بأربع أعين":"Demander un changement de rôle à quatre yeux"}</Link>{review.status==="PENDING_POLICY_REVIEW"?<CapabilityResolutionForm locale={locale} reviewId={review.id} roles={review.roles}/>:null}</article>)}</div>}</main>);
}
