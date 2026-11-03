import Link from "next/link";
import { redirect, unstable_rethrow } from "next/navigation";
import { listInvitations } from "@/app/[locale]/invitations/actions";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { SpaceSnapshot } from "@/modules/admin/data/spaces/space-data";
import { AdminReadError } from "@/modules/admin/ui/admin-read-error";
import { InviteUserForm } from "./actor-forms";
import { createAdminInvitationFormDefaults } from "./invitation-defaults";

export async function ProviderInvitationWorkspace({ locale, query, snapshot }: { locale:Locale;query:string;snapshot:SpaceSnapshot }) {
  const ar=locale==="ar";
  const href=`/${locale}/administration/providers/nouvelle${query}`;
  const invitation = await listInvitations().catch(error=>{unstable_rethrow(error);return {status:"error" as const,reason:"UNAVAILABLE" as const};});
  if(invitation.status==="error") {
    if(invitation.reason==="UNAUTHENTICATED") redirect(connexionHref(locale,{next:href}));
    return <main className="client-page"><AdminReadError locale={locale} reason="UNAVAILABLE" retryHref={href}/></main>;
  }
  const organizations=[...new Map(snapshot.rows.filter(row=>row.organizationId).map(row=>[row.organizationId!,{id:row.organizationId!,displayName:row.title}])).values()];
  const selectedOrganization=new URLSearchParams(query).get("organizationId");
  return <main className="client-page">
    <section className="client-card"><h2>{ar ? "المستلم والمؤسسة وصلاحيات الدعوة" : "Destinataire, organisation et droits de l’invitation"}</h2>
      <p>{ar ? "تستهدف الدعوة شخصاً عبر بريده الإلكتروني ضمن مؤسسة مقدمة للخدمات موجودة. لا يُنشأ ملف شركة أو تأهيل مهني بمجرد الدعوة. عند غياب صلاحية الدعوة المباشرة، يُرسل الطلب للمراجعة المستقلة أولاً." : "L’invitation vise une personne par son adresse email dans une organisation prestataire existante. Elle ne crée ni société ni qualification professionnelle. Sans habilitation d’invitation directe, la demande est d’abord soumise à une revue indépendante."}</p>
      <Link href={`/${locale}/administration/entreprises/nouvelle${query}`}>{ar ? "إعداد مؤسسة جديدة أولاً" : "Préparer d’abord une nouvelle organisation"}</Link>
    </section>
    {organizations.length ? <InviteUserForm {...createAdminInvitationFormDefaults()} locale={locale} query={query} organizations={organizations} eligibleIds={invitation.organizations.map(org=>org.id)} defaultOrganizationId={selectedOrganization && organizations.some(org=>org.id===selectedOrganization)?selectedOrganization:""} defaultRole="PROVIDER_VIEWER" roleFamily="PROVIDER"/> : <p role="status">{ar ? "لا توجد مؤسسة مقدمة للخدمات متاحة في النطاق الحالي. أنشئ المؤسسة وتحقق منها قبل دعوة ممثلها." : "Aucune organisation prestataire disponible dans ce périmètre. Créez et vérifiez l’organisation avant d’inviter son représentant."}</p>}
  </main>;
}
