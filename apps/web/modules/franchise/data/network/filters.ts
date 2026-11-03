import type { PersonRow } from "../spaces/demo";
import { renewalCivilDate } from "../spaces/calendar";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
export type FranchiseNetworkFilters={service?:string;status?:string;capacity?:string;zone?:string;docs?:string};
const picked=(value:string|undefined)=>Boolean(value&&value!=="all");
function documentState(document:NonNullable<PersonRow["dossier"]>["documents"][number],today:string){return document.expiresOn&&document.expiresOn<today?"EXPIRED":document.status;}
export function networkFilterOptions(rows:PersonRow[],today=renewalCivilDate(new Date().toISOString())!){
 const unique=(values:string[])=>[...new Set(values)].sort();
 return{services:unique(rows.flatMap(row=>row.dossier?.qualifications.map(q=>q.serviceCode)??[])),statuses:unique(rows.map(row=>row.dossier?.status??row.stage)),capacities:unique(rows.flatMap(row=>row.dossier?.capacities.map(c=>c.status)??[])),zones:unique(rows.flatMap(row=>row.dossier?.regions??[])),documents:unique(rows.flatMap(row=>row.dossier?.documents.length?row.dossier.documents.map(d=>documentState(d,today)):["NONE"]))};
}
export function matchesFranchiseNetwork(row:PersonRow,filters:FranchiseNetworkFilters,today=renewalCivilDate(new Date().toISOString())!){
 if(picked(filters.service)&&!row.dossier?.qualifications.some(q=>q.serviceCode===filters.service))return false;
 if(picked(filters.status)&&(row.dossier?.status??row.stage)!==filters.status)return false;
 if(picked(filters.capacity)&&!row.dossier?.capacities.some(c=>c.status===filters.capacity))return false;
 if(picked(filters.zone)&&!row.dossier?.regions.includes(filters.zone!))return false;
 if(picked(filters.docs)){
  const documents=row.dossier?.documents??[];
  if(filters.docs==="NONE"?documents.length>0:!documents.some(d=>documentState(d,today)===filters.docs))return false;
 }
 return true;
}
export function networkStateLabel(code:string,locale:Locale){
 if(!/^[A-Z][A-Z0-9_]*$/u.test(code))return code;
 const labels:Record<string,[string,string]>={NOT_REQUESTED:["Non demandée","لم يطلب"],PROFILE_INCOMPLETE:["Profil à compléter","الملف يحتاج إلى استكمال"],DRAFT:["Brouillon","مسودة"],UNDER_REVIEW:["En cours de vérification","قيد التحقق"],QUALIFICATION_IN_PROGRESS:["Qualifications en cours","التأهيلات قيد التقدم"],PARTIALLY_QUALIFIED:["Partiellement qualifié","مؤهل جزئيا"],DECIDED:["Décidée","صدر القرار"],WITHDRAWN:["Demande retirée","تم سحب الطلب"],SUPERSEDED:["Version remplacée","تم استبدال النسخة"],TERMINATED:["Relation terminée","انتهت العلاقة"],FINANCIAL_RESTRICTED:["Restriction financière","تقييد مالي"],QUALITY_RESTRICTED:["Restriction qualité","تقييد جودة"],COMPLIANCE_RESTRICTED:["Restriction conformité","تقييد امتثال"],PAUSED:["En pause","متوقف مؤقتا"],NOT_DECLARED:["Non déclarée","غير مصرح بها"],NOT_SIGNED:["Non signé","غير موقع"],SIGNED:["Signé","موقع"],INVALID:["Invalide","غير صالح"],ACTIVE:["Actif","نشط"],OPEN:["Ouvert","مفتوح"],RESOLVED:["Résolu","تمت المعالجة"],ACKNOWLEDGED:["Pris en compte","تم الإقرار"],PROPOSED:["Proposé","مقترح"],COMPLETED:["Terminé","مكتمل"],CANCELLED:["Annulé","ملغى"],IMPORTANT:["Importante","مهم"],HIGH:["Élevée","مرتفعة"],CRITICAL:["Critique","حرجة"],WARNING:["Avertissement","تحذير"],INFO:["Information","معلومة"],PENDING:["En attente","قيد الانتظار"],PENDING_REVIEW:["En cours de revue","قيد المراجعة"],APPROVED:["Approuvé","معتمد"],VERIFIED:["Vérifié","موثق"],VALID:["Valide","صالح"],CLEAN:["Contrôle du fichier réussi","تم فحص الملف"],CONDITIONAL:["Sous conditions","بشروط"],INFO_REQUIRED:["Informations requises","معلومات مطلوبة"],INFORMATION_REQUIRED:["Informations requises","معلومات مطلوبة"],REJECTED:["Refusé","مرفوض"],SUSPENDED:["Suspendu","موقوف"],EXPIRED:["Expiré","منتهي الصلاحية"],SUBMITTED:["Déposé","مودع"],AVAILABLE:["Disponible","متاح"],LIMITED:["Capacité limitée","قدرة محدودة"],FULL:["Capacité complète","القدرة ممتلئة"],UNAVAILABLE:["Indisponible","غير متاح"],NONE:["Aucun document déposé","لم تودع وثائق"],SENT:["Prospect enregistré","تم تسجيل العميل المحتمل"],OPENED:["Prospect ouvert","تم فتح العميل المحتمل"],REGISTERED:["Inscription enregistrée","تم التسجيل"],PROFILE_STARTED:["Dossier ouvert","ملف مفتوح"],CONTRACT_SIGNED:["Contrat signé","عقد موقع"],INACTIVE:["Inactif","غير نشط"]};
 return labels[code]?.[locale==="ar"?1:0]??`${locale==="ar"?"حالة غير مترجمة":"État non traduit"} (${code})`;
}
