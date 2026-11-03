import type { FranchiseCrmDashboard } from "../crm/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

type Invitation=NonNullable<FranchiseCrmDashboard["prospects"][number]["invitation"]>;

/** CRM stages never certify a delivery. Only the native invitation carries that state. */
export function franchiseInvitationLabel(invitation:Invitation|undefined,locale:Locale,now=Date.now()):string|null{
 if(!invitation)return null;
 const status=!["REGISTERED","REVOKED"].includes(invitation.status)&&Date.parse(invitation.expiresAt)<now?"EXPIRED":invitation.status;
 const fr={QUEUED:"Invitation en attente d’envoi",SENT:"Invitation transmise au service d’envoi",OPENED:"Invitation ouverte",REGISTERED:"Inscription liée à l’invitation",EXPIRED:"Invitation expirée",REVOKED:"Invitation révoquée"};
 const ar={QUEUED:"دعوة في انتظار الإرسال",SENT:"دعوة محالة إلى خدمة الإرسال",OPENED:"دعوة مفتوحة",REGISTERED:"تسجيل مرتبط بالدعوة",EXPIRED:"دعوة منتهية الصلاحية",REVOKED:"دعوة ملغاة"};
 const label=(locale==="ar"?ar:fr)[status];
 return invitation.deliveryMode==="NON_CONTRACTUAL_DEMO"?`${locale==="ar"?"اختبار غير تعاقدي":"Test non contractuel"} · ${label}`:label;
}
