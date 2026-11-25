import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ProcessStep } from "@/modules/shared/shell/admin-process-strip";
import type { AdminSpaceId } from "./admin-nav";

/** Film métier 1→11 (ordonnancement Matricia). */
export type FilmStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type AdminFilmContext = {
  step: FilmStepNumber;
  title: string;
  why: string;
  owner: string;
  nextAction: string;
  prevHref: string | null;
  nextHref: string | null;
  steps: ProcessStep[];
};

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

const FILM_LABELS: Record<FilmStepNumber, { fr: string; ar: string }> = {
  1: { fr: "Préparer la plateforme", ar: "تجهيز المنصة" },
  2: { fr: "Valider le franchisé", ar: "اعتماد صاحب الامتياز" },
  3: { fr: "Inviter le réseau", ar: "دعوة الشبكة" },
  4: { fr: "Inscriptions", ar: "التسجيلات" },
  5: { fr: "Confirmer les acteurs", ar: "تأكيد الفاعلين" },
  6: { fr: "Besoin client", ar: "حاجة العميل" },
  7: { fr: "Mise en relation", ar: "الربط" },
  8: { fr: "Devis", ar: "العروض" },
  9: { fr: "Contrat & signature", ar: "العقد والتوقيع" },
  10: { fr: "Mission", ar: "المهمة" },
  11: { fr: "Argent & suivi", ar: "المال والمتابعة" },
};

function buildSteps(locale: Locale, current: FilmStepNumber): ProcessStep[] {
  return ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const).map((n) => {
    const label = FILM_LABELS[n];
    return {
      id: `film-${n}`,
      label: `${n}. ${t(locale, label.fr, label.ar)}`,
      state: n < current ? "done" : n === current ? "current" : "pending",
    };
  });
}

type SpaceFilmSpec = {
  step: FilmStepNumber;
  whyFr: string;
  whyAr: string;
  ownerFr: string;
  ownerAr: string;
  nextFr: string;
  nextAr: string;
  prevPath: string | null;
  nextPath: string | null;
};

const SPACE_FILM: Partial<Record<AdminSpaceId, SpaceFilmSpec>> = {
  territoires: {
    step: 1,
    whyFr: "Préparer territoires et mandats avant d’activer une franchise.",
    whyAr: "تجهيز الأقاليم والتفويضات قبل تفعيل امتياز.",
    ownerFr: "Administration Matricia",
    ownerAr: "إدارة ماتريسيا",
    nextFr: "Valider les mandats (gouvernance)",
    nextAr: "المصادقة على التفويضات (الحوكمة)",
    prevPath: "preparation",
    nextPath: "gouvernance",
  },
  franchises: {
    step: 2,
    whyFr: "Consulter les franchises déjà actives — ne crée pas un franchisé.",
    whyAr: "عرض الامتيازات المفعّلة فقط — لا ينشئ صاحب امتياز.",
    ownerFr: "Administration Matricia",
    ownerAr: "إدارة ماتريسيا",
    nextFr: "Ouvrir ou instruire une candidature",
    nextAr: "فتح أو دراسة ترشيح",
    prevPath: "gouvernance",
    nextPath: "candidatures-franchise",
  },
  gouvernance: {
    step: 2,
    whyFr: "Valider les mandats jusqu’à activation — quatre yeux si exigé.",
    whyAr: "المصادقة على التفويضات حتى التفعيل — بأربعة أعين عند اللزوم.",
    ownerFr: "Administration Matricia",
    ownerAr: "إدارة ماتريسيا",
    nextFr: "Voir les franchises actives",
    nextAr: "عرض الامتيازات المفعّلة",
    prevPath: "candidatures-franchise",
    nextPath: "franchises",
  },
  providers: {
    step: 5,
    whyFr: "Confirmer l’identité et le statut des prestataires avant le commerce.",
    whyAr: "تأكيد هوية وحالة مقدمي الخدمات قبل التجارة.",
    ownerFr: "Conformité / Administration",
    ownerAr: "الامتثال / الإدارة",
    nextFr: "Décider la qualification par service",
    nextAr: "تقرير التأهيل حسب الخدمة",
    prevPath: "entreprises",
    nextPath: "qualification",
  },
  qualification: {
    step: 5,
    whyFr: "Décider la qualification par service après dépôt des preuves.",
    whyAr: "تقرير التأهيل حسب الخدمة بعد إيداع الأدلة.",
    ownerFr: "Conformité / Administration",
    ownerAr: "الامتثال / الإدارة",
    nextFr: "Contrôler capacité et documents",
    nextAr: "مراقبة القدرة والوثائق",
    prevPath: "providers",
    nextPath: "capacite",
  },
  capacite: {
    step: 5,
    whyFr: "Contrôler capacités et pièces avant d’ouvrir le commerce.",
    whyAr: "مراقبة القدرات والوثائق قبل فتح التجارة.",
    ownerFr: "Conformité / Administration",
    ownerAr: "الامتثال / الإدارة",
    nextFr: "Ouvrir les diagnostics (après confirmation)",
    nextAr: "فتح التشخيصات (بعد التأكيد)",
    prevPath: "qualification",
    nextPath: "diagnostics",
  },
  diagnostics: {
    step: 6,
    whyFr: "Superviser la santé du diagnostic — le client dépose le besoin.",
    whyAr: "الإشراف على صحة التشخيص — العميل يودع الحاجة.",
    ownerFr: "Client (dépôt) · Admin (supervision)",
    ownerAr: "العميل (الإيداع) · الإدارة (الإشراف)",
    nextFr: "Suivre les demandes",
    nextAr: "متابعة الطلبات",
    prevPath: "qualification",
    nextPath: "demandes",
  },
  demandes: {
    step: 6,
    whyFr: "Suivre les besoins figés — admin ne rédige pas le besoin.",
    whyAr: "متابعة الحاجات المجمّدة — الإدارة لا تكتب الحاجة.",
    ownerFr: "Client (dépôt) · Admin (supervision)",
    ownerAr: "العميل (الإيداع) · الإدارة (الإشراف)",
    nextFr: "Contrôler la mise en relation",
    nextAr: "مراقبة الربط",
    prevPath: "diagnostics",
    nextPath: "matching",
  },
  matching: {
    step: 7,
    whyFr: "Contrôler l’éligibilité et les consultations — sans favoritisme opaque.",
    whyAr: "مراقبة الأهلية والاستشارات — دون محاباة غامضة.",
    ownerFr: "Système + Admin (contrôle)",
    ownerAr: "النظام + الإدارة (رقابة)",
    nextFr: "Comparer les devis",
    nextAr: "مقارنة العروض",
    prevPath: "demandes",
    nextPath: "devis",
  },
  messagerie: {
    step: 7,
    whyFr: "Surveiller les fils liés aux dossiers — pas de contournement métier.",
    whyAr: "مراقبة المحادثات المرتبطة بالملفات.",
    ownerFr: "Administration (supervision)",
    ownerAr: "الإدارة (إشراف)",
    nextFr: "Revenir aux devis",
    nextAr: "العودة إلى العروض",
    prevPath: "matching",
    nextPath: "devis",
  },
  devis: {
    step: 8,
    whyFr: "Comparer les devis normalisés — le prestataire propose, le client choisit.",
    whyAr: "مقارنة العروض الموحّدة — يقدّم المزوّد ويختار العميل.",
    ownerFr: "Prestataire + Client · Admin (supervision)",
    ownerAr: "المزوّد + العميل · الإدارة (إشراف)",
    nextFr: "Superviser contrats et signatures",
    nextAr: "الإشراف على العقود والتوقيعات",
    prevPath: "matching",
    nextPath: "contrats",
  },
  contrats: {
    step: 9,
    whyFr: "Superviser versions contractuelles après sélection d’un devis.",
    whyAr: "الإشراف على نسخ العقود بعد اختيار عرض.",
    ownerFr: "Parties + Admin (politiques)",
    ownerAr: "الأطراف + الإدارة (السياسات)",
    nextFr: "Suivre les missions",
    nextAr: "متابعة المهام",
    prevPath: "devis",
    nextPath: "missions",
  },
  avenants: {
    step: 9,
    whyFr: "Traiter les changements de périmètre rattachés au contrat.",
    whyAr: "معالجة تغييرات النطاق المرتبطة بالعقد.",
    ownerFr: "Parties + Admin",
    ownerAr: "الأطراف + الإدارة",
    nextFr: "Revenir au contrat source",
    nextAr: "العودة إلى العقد المصدر",
    prevPath: "contrats",
    nextPath: "contrats",
  },
  missions: {
    step: 10,
    whyFr: "Piloter l’exécution — preuves et acceptation côté acteurs.",
    whyAr: "قيادة التنفيذ — الأدلة والقبول لدى الفاعلين.",
    ownerFr: "Prestataire + Client · Admin / litiges",
    ownerAr: "المزوّد + العميل · الإدارة / النزاعات",
    nextFr: "Valider jalons et preuves",
    nextAr: "اعتماد المعالم والأدلة",
    prevPath: "contrats",
    nextPath: "jalons",
  },
  jalons: {
    step: 10,
    whyFr: "Valider livrables et acceptation avant facturation.",
    whyAr: "اعتماد التسليمات والقبول قبل الفوترة.",
    ownerFr: "Client (acceptation) · Admin (supervision)",
    ownerAr: "العميل (القبول) · الإدارة (إشراف)",
    nextFr: "Facturation clients",
    nextAr: "فوترة العملاء",
    prevPath: "missions",
    nextPath: "facturation-clients",
  },
  documents: {
    step: 10,
    whyFr: "Superviser le coffre documentaire et les preuves de dossier.",
    whyAr: "الإشراف على خزينة الوثائق وأدلة الملف.",
    ownerFr: "Administration (supervision)",
    ownerAr: "الإدارة (إشراف)",
    nextFr: "Messagerie du dossier",
    nextAr: "مراسلة الملف",
    prevPath: "jalons",
    nextPath: "messagerie",
  },
  litiges: {
    step: 10,
    whyFr: "Médiation et réaffectation contrôlée — avertissement avant sanction.",
    whyAr: "وساطة وإعادة تعيين مضبوطة — إنذار قبل الجزاء.",
    ownerFr: "Gestion des litiges / Administration",
    ownerAr: "إدارة النزاعات / الإدارة",
    nextFr: "Revenir à la mission",
    nextAr: "العودة إلى المهمة",
    prevPath: "missions",
    nextPath: "missions",
  },
};

export function adminFilmForSpace(locale: Locale, space: AdminSpaceId, query: string): AdminFilmContext | null {
  const spec = SPACE_FILM[space];
  if (!spec) return null;
  const p = `/${locale}/administration`;
  return {
    step: spec.step,
    title: t(locale, `Étape ${spec.step}/11`, `الخطوة ${spec.step}/11`),
    why: t(locale, spec.whyFr, spec.whyAr),
    owner: t(locale, spec.ownerFr, spec.ownerAr),
    nextAction: t(locale, spec.nextFr, spec.nextAr),
    prevHref: spec.prevPath ? `${p}/${spec.prevPath}${query}` : null,
    nextHref: spec.nextPath ? `${p}/${spec.nextPath}${query}` : null,
    steps: buildSteps(locale, spec.step),
  };
}

export function filmHubChain(locale: Locale): Array<{ id: string; hrefSuffix: string; label: string; step: FilmStepNumber }> {
  const fr = locale === "fr";
  return [
    { id: "preparation", hrefSuffix: "preparation", label: fr ? "1. Préparer" : "1. التجهيز", step: 1 },
    { id: "candidatures-franchise", hrefSuffix: "candidatures-franchise", label: fr ? "2. Franchise" : "2. الامتياز", step: 2 },
    { id: "invitations-reseau", hrefSuffix: "invitations-reseau", label: fr ? "3. Inviter le réseau" : "3. دعوة الشبكة", step: 3 },
    { id: "entreprises", hrefSuffix: "entreprises", label: fr ? "4. Inscriptions" : "4. التسجيلات", step: 4 },
    { id: "conformite-clients", hrefSuffix: "conformite-clients", label: fr ? "5. Confirmation" : "5. التأكيد", step: 5 },
    { id: "diagnostics", hrefSuffix: "diagnostics", label: fr ? "6. Besoin" : "6. الحاجة", step: 6 },
    { id: "matching", hrefSuffix: "matching", label: fr ? "7. Mise en relation" : "7. الربط", step: 7 },
    { id: "devis", hrefSuffix: "devis", label: fr ? "8. Devis" : "8. العروض", step: 8 },
    { id: "contrats", hrefSuffix: "contrats", label: fr ? "9. Contrat" : "9. العقد", step: 9 },
    { id: "missions", hrefSuffix: "missions", label: fr ? "10. Mission" : "10. المهمة", step: 10 },
    { id: "facturation-clients", hrefSuffix: "facturation-clients", label: fr ? "11. Argent" : "11. المال", step: 11 },
  ];
}

/** Chaîne dossier visible sur le hub Parcours (sous-étapes incluses). */
export function parcoursDossierChain(locale: Locale): Array<{ id: string; hrefSuffix: string; label: string }> {
  const fr = locale === "fr";
  return [
    { id: "diagnostics", hrefSuffix: "diagnostics", label: fr ? "Diagnostic" : "تشخيص" },
    { id: "demandes", hrefSuffix: "demandes", label: fr ? "Demande" : "طلب" },
    { id: "matching", hrefSuffix: "matching", label: fr ? "Matching" : "مطابقة" },
    { id: "devis", hrefSuffix: "devis", label: fr ? "Devis" : "عرض" },
    { id: "contrats", hrefSuffix: "contrats", label: fr ? "Contrat" : "عقد" },
    { id: "avenants", hrefSuffix: "avenants", label: fr ? "Avenant" : "ملحق" },
    { id: "missions", hrefSuffix: "missions", label: fr ? "Mission" : "مهمة" },
    { id: "jalons", hrefSuffix: "jalons", label: fr ? "Jalons" : "معالم" },
    { id: "documents", hrefSuffix: "documents", label: fr ? "Documents" : "وثائق" },
    { id: "messagerie", hrefSuffix: "messagerie", label: fr ? "Messages" : "رسائل" },
    { id: "litiges", hrefSuffix: "litiges", label: fr ? "Litiges" : "نزاعات" },
  ];
}
