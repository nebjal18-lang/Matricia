import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { sensitivePageContext, adminReadFailure } from "@/modules/admin/ui/sensitive-page-context";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { CapabilityResolutionForm } from "@/modules/admin/screens/capability-reviews/resolution-form";
export default async function CapabilityReviewsPage({params}:{params:Promise<{locale:string}>}){
 const{locale}=await params;if(!isLocale(locale))notFound();const ar=locale==="ar";
 const context = await sensitivePageContext({ locale, path: "revues-capacites", active: "settings", title: ar ? "مراجعات القدرات" : "Revues de capacités", lead: ar ? "الصلاحيات الفعلية تتبع الأدوار المعتمدة وسياسات قاعدة البيانات." : "Les droits effectifs suivent les rôles autorisés et les politiques de la base.", roles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "READ_ONLY_AUDITOR"] });
 if (context.status === "blocked") return context.view;
 const r = await context.access.client.rpc("get_admin_capability_reviews_v1");
 const parsed=z.array(z.object({id:z.string().uuid(),userId:z.string().uuid(),organizationId:z.string().uuid(),organizationName:z.string(),requestedCapabilities:z.array(z.string()),status:z.string(),resolution:z.string().nullable(),roles:z.array(z.string())})).safeParse(r.data);
 return context.wrap(<main className="client-page">{r.error||!parsed.success?<WorkspaceFailure locale={locale} reason={adminReadFailure(r.error)} returnPath={context.selfPath} />:<div className="client-stack">{!parsed.data.length?<p>{ar?"لا طلبات متاحة.":"Aucune demande visible."}</p>:parsed.data.map((review)=><article key={review.id} className="client-card"><h2>{review.organizationName}</h2><p>{review.status==="PENDING_POLICY_REVIEW"?(ar?"قيد الانتظار":"EN ATTENTE"):review.resolution}</p><p>{review.requestedCapabilities.join(", ")}</p><p>{ar?"لا يتم منح صلاحيات إضافية بهذه المراجعة. اختاروا دوراً معتمداً ثم تحققوا من تطبيقه أو ارفضوا الطلب.":"Cette revue n’accorde aucun privilège supplémentaire. Choisissez un rôle autorisé, vérifiez son application, ou refusez la demande."}</p><Link href={`/${locale}/administration/utilisateurs/${review.userId}/roles?organizationId=${review.organizationId}`}>{ar?"طلب تعديل الدور بأربع أعين":"Demander un changement de rôle à quatre yeux"}</Link>{review.status==="PENDING_POLICY_REVIEW"?<CapabilityResolutionForm locale={locale} reviewId={review.id} roles={review.roles}/>:null}</article>)}</div>}</main>);
}
