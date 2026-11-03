import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminSpaceId } from "./admin-nav";

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

export type SpaceTone = "mint" | "sky" | "peach" | "violet";
export type SpaceKind = "queue" | "detail" | "decision" | "wizard" | "compare";
export type SpaceSource =
  | "providers" | "qualification" | "capacity" | "franchises" | "approvals" | "mandates"
  | "diagnostics" | "requests" | "quotes" | "missions" | "documents" | "messages" | "disputes";

export type SpaceSpec = {
  id: AdminSpaceId;
  nav: "actors" | "parcours";
  current: string;
  source: SpaceSource;
  resourceType: string;
  title: (locale: Locale) => string;
  lead: (locale: Locale) => string;
  search: (locale: Locale) => string;
  columns: (locale: Locale) => string[];
  pills: (locale: Locale) => string[];
  filters: (locale: Locale) => string[];
  pipeline: (locale: Locale) => Array<{ label: string; hint: string; tone: SpaceTone }>;
  tabs: (locale: Locale) => string[];
  createLabel?: (locale: Locale) => string;
  createView?: string;
  exportable: boolean;
  treatTitle: (locale: Locale) => string;
  empty: (locale: Locale) => string;
  cycleTitle: (locale: Locale) => string;
};

const specs: Record<AdminSpaceId, SpaceSpec> = {
  providers: {
    id: "providers", nav: "actors", current: "providers", source: "providers", resourceType: "PROVIDER",
    title: (l) => t(l, "Prestataires", "مقدمو الخدمات"),
    lead: (l) => t(l, "Gérez les profils professionnels, leur activité et les dossiers associés.", "أدِر الملفات المهنية ونشاطها والملفات المرتبطة."),
    search: (l) => t(l, "Rechercher un prestataire, un service, un document…", "ابحث عن مقدم خدمة أو خدمة أو وثيقة…"),
    columns: (l) => t(l, "Prestataire,Services déclarés,Qualification,Capacité,Documents,Missions,Action", "مقدم الخدمة,الخدمات,التأهيل,القدرة,الوثائق,المهام,إجراء").split(","),
    pills: () => [],
    filters: (l) => t(l, "Qualification,Activité,Disponibilité,Documents,État", "التأهيل,النشاط,التوفر,الوثائق,الحالة").split(","),
    pipeline: (l) => [
      { label: t(l, "Inscription", "التسجيل"), hint: t(l, "Profil", "الملف"), tone: "violet" },
      { label: t(l, "Services", "الخدمات"), hint: t(l, "Déclaration", "التصريح"), tone: "sky" },
      { label: t(l, "Capacité", "القدرة"), hint: t(l, "Preuves", "الأدلة"), tone: "peach" },
      { label: t(l, "Documents", "الوثائق"), hint: t(l, "Coffre", "الخزينة"), tone: "mint" },
      { label: t(l, "Qualification", "التأهيل"), hint: t(l, "Revue humaine", "مراجعة بشرية"), tone: "violet" },
      { label: t(l, "Opportunités", "الفرص"), hint: t(l, "Consultations", "الاستشارات"), tone: "sky" },
    ],
    tabs: (l) => t(l, "Vue d’ensemble,Profil,Services,Capacité,Documents,Qualification,Consultations,Devis,Missions,Facturation,Réputation,Audit", "نظرة عامة,الملف,الخدمات,القدرة,الوثائق,التأهيل,الاستشارات,العروض,المهام,الفوترة,السمعة,التدقيق").split(","),
    createLabel: (l) => t(l, "Inviter un prestataire", "دعوة مقدم خدمة"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Dossiers nécessitant une action", "ملفات تتطلب إجراء"),
    empty: (l) => t(l, "Aucun prestataire ne correspond à vos critères.", "لا يوجد مقدم خدمة مطابق."),
    cycleTitle: (l) => t(l, "Parcours prestataire", "مسار مقدم الخدمة"),
  },
  qualification: {
    id: "qualification", nav: "actors", current: "qualification", source: "qualification", resourceType: "PROVIDER_QUALIFICATION",
    title: (l) => t(l, "Qualification prestataires", "تأهيل مقدمي الخدمات"),
    lead: (l) => t(l, "Évaluez et qualifiez les prestataires selon des règles définies et une revue humaine.", "قيّم وأهّل مقدمي الخدمات وفق قواعد محددة ومراجعة بشرية."),
    search: (l) => t(l, "Rechercher un prestataire, un service, un document…", "ابحث عن مقدم خدمة أو خدمة أو وثيقة…"),
    columns: (l) => t(l, "Prestataire,Services,Documents,Capacité,État,Raison,Action", "مقدم الخدمة,الخدمات,الوثائق,القدرة,الحالة,السبب,إجراء").split(","),
    pills: (l) => t(l, "À compléter,À examiner,Complément demandé,En décision,Qualifié,Refusé", "للإستكمال,للمعاينة,تكميل مطلوب,قيد القرار,مؤهل,مرفوض").split(","),
    filters: () => [],
    pipeline: (l) => [
      { label: t(l, "Profil", "الملف"), hint: t(l, "Identité", "الهوية"), tone: "sky" },
      { label: t(l, "Services", "الخدمات"), hint: t(l, "Périmètre", "النطاق"), tone: "violet" },
      { label: t(l, "Capacité", "القدرة"), hint: t(l, "Opérationnelle", "تشغيلية"), tone: "peach" },
      { label: t(l, "Documents", "الوثائق"), hint: t(l, "Preuves", "الأدلة"), tone: "mint" },
      { label: t(l, "Revue", "المراجعة"), hint: t(l, "Humaine", "بشرية"), tone: "violet" },
      { label: t(l, "Décision", "القرار"), hint: t(l, "Justifiée", "مبررة"), tone: "mint" },
    ],
    tabs: (l) => t(l, "Résumé,Services,Documents,Capacité,Décision,Historique", "ملخص,الخدمات,الوثائق,القدرة,القرار,التاريخ").split(","),
    exportable: true,
    treatTitle: (l) => t(l, "Dossiers prioritaires", "ملفات ذات أولوية"),
    empty: (l) => t(l, "Aucun dossier de qualification en file.", "لا يوجد ملف تأهيل في الانتظار."),
    cycleTitle: (l) => t(l, "Processus de qualification", "مسار التأهيل"),
  },
  capacite: {
    id: "capacite", nav: "actors", current: "capacity", source: "capacity", resourceType: "PROVIDER_DOCUMENT",
    title: (l) => t(l, "Capacité & documents prestataires", "قدرة ووثائق مقدمي الخدمات"),
    lead: (l) => t(l, "Consultez et gérez la capacité d’intervention de vos prestataires, selon les règles applicables.", "راجع وقدرة التدخل لمقدمي الخدمات وفق القواعد المعمول بها."),
    search: (l) => t(l, "Rechercher un prestataire, un service…", "ابحث عن مقدم خدمة أو خدمة…"),
    columns: (l) => t(l, "Prestataire,Service (hiérarchie),Statut capacité,Zones d’intervention,Délai d’intervention,Documents requis,État d’expiration,Actions", "مقدم الخدمة,الخدمة,حالة القدرة,مناطق التدخل,مهلة التدخل,الوثائق المطلوبة,انتهاء الصلاحية,إجراءات").split(","),
    pills: () => [],
    filters: (l) => t(l, "Service,Qualification,Statut des documents,Disponibilité", "الخدمة,التأهيل,حالة الوثائق,التوفر").split(","),
    pipeline: () => [],
    tabs: (l) => t(l, "Capacité,Documents,Provenance,Historique", "القدرة,الوثائق,المصدر,التاريخ").split(","),
    exportable: true,
    treatTitle: (l) => t(l, "Documents à renouveler", "وثائق للتجديد"),
    empty: (l) => t(l, "Aucune capacité à afficher.", "لا توجد قدرة للعرض."),
    cycleTitle: (l) => t(l, "Règles et vérification de la capacité", "قواعد والتحقق من القدرة"),
  },
  franchises: {
    id: "franchises", nav: "actors", current: "franchise", source: "franchises", resourceType: "FRANCHISE",
    title: (l) => t(l, "Franchisés", "أصحاب الامتياز"),
    lead: (l) => t(l, "Gérez l’annuaire des franchisés, suivez leur cycle de vie et pilotez leur gouvernance.", "أدِر دليل أصحاب الامتياز وتابع دورة حياتهم وقيادتهم."),
    search: (l) => t(l, "Rechercher un franchisé, une organisation ou un périmètre…", "ابحث عن صاحب امتياز أو مؤسسة أو نطاق…"),
    columns: (l) => t(l, "Franchisé,Organisation,Périmètre autorisé,Mandat,Gouvernance,Performance,Alertes,État,Actions", "صاحب الامتياز,المؤسسة,النطاق,التفويض,الحوكمة,الأداء,التنبيهات,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "Candidatures,Actifs,Suspendus,Archivés", "الترشيحات,نشطون,موقوفون,مؤرشفون").split(","),
    filters: (l) => t(l, "Statut,Périmètre,Mandat,Conformité", "الحالة,النطاق,التفويض,الامتثال").split(","),
    pipeline: (l) => [
      { label: t(l, "Candidature", "الترشح"), hint: t(l, "Dépôt du dossier", "إيداع الملف"), tone: "violet" },
      { label: t(l, "Évaluation", "التقييم"), hint: t(l, "Due diligence", "العناية"), tone: "sky" },
      { label: t(l, "Périmètre", "النطاق"), hint: t(l, "Territoire", "الإقليم"), tone: "peach" },
      { label: t(l, "Contrat", "العقد"), hint: t(l, "Signature", "التوقيع"), tone: "mint" },
      { label: t(l, "Activation", "التفعيل"), hint: t(l, "Démarrage", "الانطلاق"), tone: "violet" },
      { label: t(l, "Pilotage", "القيادة"), hint: t(l, "Performance", "الأداء"), tone: "sky" },
    ],
    tabs: (l) => t(l, "Synthèse,Organisation,Mandat,Territoires,Documents,Performance,Finance autorisée,Historique", "ملخص,المؤسسة,التفويض,الأقاليم,الوثائق,الأداء,المالية,التاريخ").split(","),
    createLabel: (l) => t(l, "Ajouter un franchisé", "إضافة صاحب امتياز"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Dossiers à traiter", "ملفات للمعالجة"),
    empty: (l) => t(l, "Aucun franchisé à afficher.", "لا يوجد صاحب امتياز للعرض."),
    cycleTitle: (l) => t(l, "Cycle de vie franchisé", "دورة حياة صاحب الامتياز"),
  },
  territoires: {
    id: "territoires", nav: "actors", current: "territories", source: "mandates", resourceType: "FRANCHISE_MANDATE",
    title: (l) => t(l, "Territoires & mandats", "الأقاليم والتفويضات"),
    lead: (l) => t(l, "Gérez les territoires, les mandats et la gouvernance de votre réseau de franchise.", "أدِر الأقاليم والتفويضات وحوكمة شبكة الامتياز."),
    search: (l) => t(l, "Rechercher un franchisé, un territoire ou un mandat…", "ابحث عن صاحب امتياز أو إقليم أو تفويض…"),
    columns: (l) => t(l, "Franchisé,Territoire / périmètre,Bibliothèques,Mandat,Version,Début,Fin,État,Actions", "صاحب الامتياز,الإقليم,المكتبات,التفويض,النسخة,البداية,النهاية,الحالة,إجراءات").split(","),
    pills: () => [],
    filters: (l) => t(l, "État,Type de mandat,Périmètre,Échéance", "الحالة,نوع التفويض,النطاق,الاستحقاق").split(","),
    pipeline: () => [],
    tabs: (l) => t(l, "Synthèse,Périmètre,Bibliothèques,Conditions,Documents,Approbations,Historique", "ملخص,النطاق,المكتبات,الشروط,الوثائق,المصادقات,التاريخ").split(","),
    createLabel: (l) => t(l, "Préparer la revue d’un mandat", "تحضير مراجعة تفويض"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Alertes et suivi", "تنبيهات والمتابعة"),
    empty: (l) => t(l, "Aucun mandat à afficher.", "لا يوجد تفويض للعرض."),
    cycleTitle: (l) => t(l, "Gouvernance des territoires", "حوكمة الأقاليم"),
  },
  gouvernance: {
    id: "gouvernance", nav: "actors", current: "territories", source: "approvals", resourceType: "FRANCHISE_APPROVAL",
    title: (l) => t(l, "Gouvernance franchise — validations", "حوكمة الامتياز — المصادقات"),
    lead: (l) => t(l, "Traitez les demandes liées à la gouvernance franchise et suivez les validations jusqu’à activation.", "عالج طلبات حوكمة الامتياز وتابع المصادقات حتى التفعيل."),
    search: (l) => t(l, "Rechercher une demande, un franchisé…", "ابحث عن طلب أو صاحب امتياز…"),
    columns: (l) => t(l, "Demande,Franchisé,Objet,Périmètre concerné,Version,Risque,État,Approbatteur suivant,Actions", "الطلب,صاحب الامتياز,الموضوع,النطاق,النسخة,المخاطر,الحالة,المصادق التالي,إجراءات").split(","),
    pills: (l) => t(l, "À examiner,Double validation,Complément demandé,Approuvé,Refusé", "للمعاينة,تحقق مزدوج,تكميل مطلوب,مصادق,مرفوض").split(","),
    filters: (l) => t(l, "Type de demande,Périmètre,Risque,Échéance,Décideur", "نوع الطلب,النطاق,المخاطر,الاستحقاق,صاحب القرار").split(","),
    pipeline: (l) => [
      { label: t(l, "Préparation", "التحضير"), hint: t(l, "Dossier", "الملف"), tone: "violet" },
      { label: t(l, "Soumission", "الإيداع"), hint: t(l, "Dépôt", "التقديم"), tone: "peach" },
      { label: t(l, "Première revue", "المراجعة الأولى"), hint: t(l, "Analyse", "تحليل"), tone: "sky" },
      { label: t(l, "Seconde revue", "المراجعة الثانية"), hint: t(l, "Quatre yeux", "أربعة أعين"), tone: "mint" },
      { label: t(l, "Décision", "القرار"), hint: t(l, "Approbation", "المصادقة"), tone: "peach" },
      { label: t(l, "Activation", "التفعيل"), hint: t(l, "Mise en œuvre", "التنفيذ"), tone: "violet" },
    ],
    tabs: (l) => t(l, "Résumé,Impacts,Mandat,Documents,Règles,Conflits,Historique", "ملخص,الآثار,التفويض,الوثائق,القواعد,التعارضات,التاريخ").split(","),
    createLabel: (l) => t(l, "Créer une demande", "إنشاء طلب"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Priorités et conflits de rôles", "أولويات وتعارض الأدوار"),
    empty: (l) => t(l, "Aucune validation en file.", "لا توجد مصادقة في الانتظار."),
    cycleTitle: (l) => t(l, "Cycle de validation", "دورة المصادقة"),
  },
  diagnostics: {
    id: "diagnostics", nav: "parcours", current: "diagnostics", source: "diagnostics", resourceType: "DIAGNOSTIC",
    title: (l) => t(l, "Diagnostics", "التشخيصات"),
    lead: (l) => t(l, "Suivez et pilotez l’ensemble des diagnostics réalisés sur la plateforme.", "تابع وقد التشخيصات المنجزة على المنصة."),
    search: (l) => t(l, "Rechercher un diagnostic…", "ابحث عن تشخيص…"),
    columns: (l) => t(l, "Organisation,Diagnostic,Version du questionnaire,Progression,Priorités détectées,Dernière activité,État,Actions", "المؤسسة,التشخيص,نسخة الاستبيان,التقدم,الأولويات,آخر نشاط,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "Brouillons,En cours,Terminés,À revoir,Archivés", "مسودات,جارٍ,منتهية,للمراجعة,مؤرشفة").split(","),
    filters: (l) => t(l, "Statut,Type,Organisation,Priorité,Période", "الحالة,النوع,المؤسسة,الأولوية,الفترة").split(","),
    pipeline: (l) => [
      { label: t(l, "Collecte", "الجمع"), hint: t(l, "Questionnaire", "الاستبيان"), tone: "violet" },
      { label: t(l, "Analyse", "التحليل"), hint: t(l, "Priorités", "الأولويات"), tone: "sky" },
      { label: t(l, "Résultat", "النتيجة"), hint: t(l, "Synthèse", "الملخص"), tone: "mint" },
      { label: t(l, "Plan d’action", "خطة العمل"), hint: t(l, "Recommandations", "التوصيات"), tone: "peach" },
      { label: t(l, "Conversion", "التحويل"), hint: t(l, "Besoin", "الحاجة"), tone: "violet" },
    ],
    tabs: (l) => t(l, "Synthèse,Réponses,Priorités,Recommandations,Plan d’action,Versions,Historique", "ملخص,الإجابات,الأولويات,التوصيات,خطة العمل,النسخ,التاريخ").split(","),
    createLabel: (l) => t(l, "Créer un diagnostic", "إنشاء تشخيص"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Analyses à reprendre", "تحليلات لإعادة"),
    empty: (l) => t(l, "Aucun diagnostic à afficher.", "لا يوجد تشخيص للعرض."),
    cycleTitle: (l) => t(l, "Cycle du diagnostic", "دورة التشخيص"),
  },
  demandes: {
    id: "demandes", nav: "parcours", current: "demandes", source: "requests", resourceType: "REQUEST",
    title: (l) => t(l, "Besoins & demandes", "الحاجات والطلبات"),
    lead: (l) => t(l, "Créez, suivez et pilotez l’ensemble des demandes, de l’expression du besoin jusqu’à l’attribution.", "أنشئ وتابع وقد الطلبات من التعبير عن الحاجة حتى الإسناد."),
    search: (l) => t(l, "Rechercher une demande, un besoin…", "ابحث عن طلب أو حاجة…"),
    columns: (l) => t(l, "Demande,Organisation,Besoin,Domaine / service,Source,Complétude,Consultation,Offres,État,Actions", "الطلب,المؤسسة,الحاجة,المجال,المصدر,الاكتمال,الاستشارة,العروض,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "Tous,Brouillons,À compléter,Prêts,En consultation,Offres reçues,Attribués,Clos,Archivés", "الكل,مسودات,للاستكمال,جاهزة,قيد الاستشارة,عروض واردة,مسندة,مغلقة,مؤرشفة").split(","),
    filters: (l) => t(l, "Organisation,Statut,Domaine,Priorité,Source,Période", "المؤسسة,الحالة,المجال,الأولوية,المصدر,الفترة").split(","),
    pipeline: (l) => [
      { label: t(l, "Description", "الوصف"), hint: t(l, "Besoin", "الحاجة"), tone: "violet" },
      { label: t(l, "Structuration", "الهيكلة"), hint: t(l, "Cadrage", "التأطير"), tone: "sky" },
      { label: t(l, "Validation", "المصادقة"), hint: t(l, "Contrôle", "الرقابة"), tone: "mint" },
      { label: t(l, "Consultation", "الاستشارة"), hint: t(l, "Publication", "النشر"), tone: "peach" },
      { label: t(l, "Offres", "العروض"), hint: t(l, "Réception", "الاستلام"), tone: "violet" },
      { label: t(l, "Choix", "الاختيار"), hint: t(l, "Prestataire", "مقدم الخدمة"), tone: "sky" },
      { label: t(l, "Mission", "المهمة"), hint: t(l, "Lancement", "الانطلاق"), tone: "mint" },
    ],
    tabs: (l) => t(l, "Synthèse,Cahier des charges,Classification,Questions / réponses,Fournisseurs éligibles,Consultation,Offres,Documents,Messages,Historique", "ملخص,دفتر التحملات,التصنيف,الأسئلة,الموردون,الاستشارة,العروض,الوثائق,الرسائل,التاريخ").split(","),
    createLabel: (l) => t(l, "Créer une demande", "إنشاء طلب"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Points d’attention", "نقاط انتباه"),
    empty: (l) => t(l, "Aucune demande à afficher.", "لا يوجد طلب للعرض."),
    cycleTitle: (l) => t(l, "Cycle d’une demande", "دورة الطلب"),
  },
  matching: {
    id: "matching", nav: "parcours", current: "matching", source: "requests", resourceType: "MATCHING",
    title: (l) => t(l, "Matching & consultations", "المطابقة والاستشارات"),
    lead: (l) => t(l, "Identifiez les meilleurs prestataires, pilotez vos consultations et suivez les réponses, en toute transparence.", "حدد أفضل مقدمي الخدمات وقد الاستشارات وتابع الردود بشفافية."),
    search: (l) => t(l, "Rechercher une consultation…", "ابحث عن استشارة…"),
    columns: (l) => t(l, "Demande,Service,Prestataires éligibles,Exclus,Revue humaine,Consultation,Réponses,État,Actions", "الطلب,الخدمة,المؤهلون,المستبعدون,المراجعة البشرية,الاستشارة,الردود,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "À matcher,À revoir,Prêts à consulter,Envoyés,Réponses en cours,Expirés,Clos", "للمطابقة,للمراجعة,جاهز للاستشارة,مرسلة,ردود جارية,منتهية,مغلقة").split(","),
    filters: (l) => t(l, "Organisation,Domaine / service,Statut qualification,Zone,Capacité,Conflit d’intérêts,Période", "المؤسسة,المجال,حالة التأهيل,المنطقة,القدرة,تعارض المصالح,الفترة").split(","),
    pipeline: (l) => [
      { label: t(l, "Éligibilité", "الأهلية"), hint: t(l, "Filtrage", "التصفية"), tone: "violet" },
      { label: t(l, "Classement", "الترتيب"), hint: t(l, "Explicable", "قابل للتفسير"), tone: "sky" },
      { label: t(l, "Revue humaine", "مراجعة بشرية"), hint: t(l, "Validation", "المصادقة"), tone: "peach" },
      { label: t(l, "Confirmation", "التأكيد"), hint: t(l, "Liste finale", "القائمة النهائية"), tone: "mint" },
      { label: t(l, "Invitation", "الدعوة"), hint: t(l, "Consultation", "الاستشارة"), tone: "violet" },
      { label: t(l, "Suivi", "المتابعة"), hint: t(l, "Réponses", "الردود"), tone: "sky" },
    ],
    tabs: (l) => t(l, "Demande,Critères,Candidats,Exclusions,Règles,Historique", "الطلب,المعايير,المرشحون,الاستبعادات,القواعد,التاريخ").split(","),
    exportable: true,
    treatTitle: (l) => t(l, "Points d’attention", "نقاط انتباه"),
    empty: (l) => t(l, "Aucun matching à afficher.", "لا توجد مطابقة للعرض."),
    cycleTitle: (l) => t(l, "Cycle de matching", "دورة المطابقة"),
  },
  devis: {
    id: "devis", nav: "parcours", current: "devis", source: "quotes", resourceType: "QUOTE",
    title: (l) => t(l, "Devis & comparaison", "العروض والمقارنة"),
    lead: (l) => t(l, "Suivez, analysez et comparez les devis reçus pour chaque demande.", "تابع وحلل وقارن العروض الواردة لكل طلب."),
    search: (l) => t(l, "Rechercher un devis…", "ابحث عن عرض…"),
    columns: (l) => t(l, "Devis,Demande,Prestataire,Version,Lignes,Sous-total,Taxes,Total,Validité,Conformité,État,Actions", "العرض,الطلب,مقدم الخدمة,النسخة,البنود,المجموع الفرعي,الضرائب,الإجمالي,الصلاحية,الامتثال,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "Brouillons,Reçus,À vérifier,Révisions demandées,Validés,Expirés,Sélectionnés,Refusés", "مسودات,واردة,للتحقق,مراجعات,مصادق عليها,منتهية,مختارة,مرفوضة").split(","),
    filters: (l) => t(l, "Demande,Organisation,Prestataire,Statut,Devise,Fiscalité,Période", "الطلب,المؤسسة,مقدم الخدمة,الحالة,العملة,الضريبة,الفترة").split(","),
    pipeline: () => [],
    tabs: (l) => t(l, "Synthèse,Lignes,Options,Conditions,Documents,Fiscalité,Versions,Historique", "ملخص,البنود,الخيارات,الشروط,الوثائق,الضريبة,النسخ,التاريخ").split(","),
    createLabel: (l) => t(l, "Préparer un devis depuis une consultation", "تحضير عرض من استشارة"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Points d’attention", "نقاط انتباه"),
    empty: (l) => t(l, "Aucun devis à afficher.", "لا يوجد عرض للعرض."),
    cycleTitle: (l) => t(l, "Comparaison des offres", "مقارنة العروض"),
  },
  contrats: {
    id: "contrats", nav: "parcours", current: "contrats", source: "missions", resourceType: "CONTRACT",
    title: (l) => t(l, "Contrats & signatures", "العقود والتوقيعات"),
    lead: (l) => t(l, "Gérez le cycle de vie des contrats, de la préparation à l’activation et au lancement des missions.", "أدِر دورة حياة العقود من التحضير إلى التفعيل وانطلاق المهام."),
    search: (l) => t(l, "Rechercher un contrat…", "ابحث عن عقد…"),
    columns: (l) => t(l, "Contrat,Demande,Client,Prestataire,Version,Signataires,Signature,Activation,État,Actions", "العقد,الطلب,العميل,مقدم الخدمة,النسخة,الموقعون,التوقيع,التفعيل,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "À préparer,En revue,À signer,Signature en cours,Signés,À activer,Actifs,Suspendus,Clos,Archivés", "للتحضير,قيد المراجعة,للتوقيع,توقيع جارٍ,موقعة,للتفعيل,نشطة,موقوفة,مغلقة,مؤرشفة").split(","),
    filters: (l) => t(l, "Organisation cliente,Prestataire,Mission,Statut,Version,Signature,Période", "مؤسسة العميل,مقدم الخدمة,المهمة,الحالة,النسخة,التوقيع,الفترة").split(","),
    pipeline: (l) => [
      { label: t(l, "Offre choisie", "العرض المختار"), hint: t(l, "Source", "المصدر"), tone: "violet" },
      { label: t(l, "Brouillon", "المسودة"), hint: t(l, "Clauses", "البنود"), tone: "sky" },
      { label: t(l, "Revue", "المراجعة"), hint: t(l, "Contrôle", "الرقابة"), tone: "peach" },
      { label: t(l, "Signature", "التوقيع"), hint: t(l, "Parties", "الأطراف"), tone: "mint" },
      { label: t(l, "Activation", "التفعيل"), hint: t(l, "Mission", "المهمة"), tone: "violet" },
    ],
    tabs: (l) => t(l, "Synthèse,Clauses,Parties,Montants,Livrables,Jalons,Documents,Signatures,Versions,Historique", "ملخص,البنود,الأطراف,المبالغ,التسليمات,المعالم,الوثائق,التوقيعات,النسخ,التاريخ").split(","),
    createLabel: (l) => t(l, "Préparer le contrat depuis le devis retenu", "تحضير عقد من العرض المختار"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Points d’attention", "نقاط انتباه"),
    empty: (l) => t(l, "Aucun contrat à afficher.", "لا يوجد عقد للعرض."),
    cycleTitle: (l) => t(l, "Cycle de vie d’un contrat", "دورة حياة العقد"),
  },
  avenants: {
    id: "avenants", nav: "parcours", current: "avenants", source: "missions", resourceType: "AMENDMENT",
    title: (l) => t(l, "Avenants", "الملاحق"),
    lead: (l) => t(l, "Gérez l’ensemble des avenants contractuels, de la demande à la nouvelle version contractuelle.", "أدِر الملاحق التعاقدية من الطلب إلى النسخة الجديدة."),
    search: (l) => t(l, "Rechercher un avenant…", "ابحث عن ملحق…"),
    columns: (l) => t(l, "Avenant,Contrat source,Objet,Version cible,Signataires,Signature,Activation,État,Actions", "الملحق,العقد المصدر,الموضوع,النسخة المستهدفة,الموقعون,التوقيع,التفعيل,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "Brouillons,En revue,À signer,Signés,À activer,Activés,Refusés,Archivés", "مسودات,قيد المراجعة,للتوقيع,موقعة,للتفعيل,مفعلة,مرفوضة,مؤرشفة").split(","),
    filters: (l) => t(l, "Contrat,Mission,Client,Prestataire,Type de modification,Statut,Période", "العقد,المهمة,العميل,مقدم الخدمة,نوع التعديل,الحالة,الفترة").split(","),
    pipeline: (l) => [
      { label: t(l, "Demande", "الطلب"), hint: t(l, "Motif", "السبب"), tone: "violet" },
      { label: t(l, "Brouillon", "المسودة"), hint: t(l, "Impacts", "الآثار"), tone: "sky" },
      { label: t(l, "Analyse d’impact", "تحليل الأثر"), hint: t(l, "Finance", "المالية"), tone: "peach" },
      { label: t(l, "Approbation", "المصادقة"), hint: t(l, "Revue", "المراجعة"), tone: "mint" },
      { label: t(l, "Signature", "التوقيع"), hint: t(l, "Parties", "الأطراف"), tone: "violet" },
      { label: t(l, "Activation", "التفعيل"), hint: t(l, "Nouvelle version", "نسخة جديدة"), tone: "sky" },
    ],
    tabs: (l) => t(l, "Motif,Modifications,Impacts,Documents,Approbation,Signature", "السبب,التعديلات,الآثار,الوثائق,المصادقة,التوقيع").split(","),
    createLabel: (l) => t(l, "Créer un avenant", "إنشاء ملحق"),
    createView: "preparer",
    exportable: true,
    treatTitle: (l) => t(l, "Avenants bloqués", "ملاحق محظورة"),
    empty: (l) => t(l, "Aucun avenant à afficher.", "لا يوجد ملحق للعرض."),
    cycleTitle: (l) => t(l, "Cycle de vie d’un avenant", "دورة حياة الملحق"),
  },
  missions: {
    id: "missions", nav: "parcours", current: "missions", source: "missions", resourceType: "MISSION",
    title: (l) => t(l, "Missions", "المهام"),
    lead: (l) => t(l, "Suivez et pilotez l’exécution des missions de la plateforme, de l’activation du contrat à la clôture.", "تابع وقد تنفيذ مهام المنصة من تفعيل العقد حتى الإغلاق."),
    search: (l) => t(l, "Rechercher une mission…", "ابحث عن مهمة…"),
    columns: (l) => t(l, "Mission,Contrat,Client,Prestataire,Progression,Prochain jalon,Livrables,Risques,État,Actions", "المهمة,العقد,العميل,مقدم الخدمة,التقدم,المعلم التالي,التسليمات,المخاطر,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "À démarrer,Actives,En attente,Bloquées,À clôturer,Clôturées,Suspendues,Archivées", "للانطلاق,نشطة,معلقة,محظورة,للإغلاق,مغلقة,موقوفة,مؤرشفة").split(","),
    filters: (l) => t(l, "Client,Prestataire,Domaine/service,Statut,Responsable,Période", "العميل,مقدم الخدمة,المجال,الحالة,المسؤول,الفترة").split(","),
    pipeline: (l) => [
      { label: t(l, "Activation", "التفعيل"), hint: t(l, "Contrat", "العقد"), tone: "mint" },
      { label: t(l, "Kickoff", "الانطلاق"), hint: t(l, "Équipe", "الفريق"), tone: "violet" },
      { label: t(l, "Jalons", "المعالم"), hint: t(l, "Exécution", "التنفيذ"), tone: "sky" },
      { label: t(l, "Livrables", "التسليمات"), hint: t(l, "Preuves", "الأدلة"), tone: "peach" },
      { label: t(l, "Acceptation", "القبول"), hint: t(l, "Client", "العميل"), tone: "mint" },
      { label: t(l, "Facturation", "الفوترة"), hint: t(l, "Rapprochement", "المطابقة"), tone: "violet" },
      { label: t(l, "Clôture", "الإغلاق"), hint: t(l, "Audit", "التدقيق"), tone: "sky" },
    ],
    tabs: (l) => t(l, "Synthèse,Équipe,Jalons,Livrables,Preuves,Documents,Messages,Finance,Avenants,Litiges,Historique", "ملخص,الفريق,المعالم,التسليمات,الأدلة,الوثائق,الرسائل,المالية,الملاحق,النزاعات,التاريخ").split(","),
    createLabel: (l) => t(l, "Préparer une mission depuis un contrat", "تحضير مهمة من عقد"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Actions sensibles", "إجراءات حساسة"),
    empty: (l) => t(l, "Aucune mission à afficher.", "لا توجد مهمة للعرض."),
    cycleTitle: (l) => t(l, "Cycle de vie d’une mission", "دورة حياة المهمة"),
  },
  jalons: {
    id: "jalons", nav: "parcours", current: "jalons", source: "missions", resourceType: "MILESTONE",
    title: (l) => t(l, "Jalons, livrables & preuves", "المعالم والتسليمات والأدلة"),
    lead: (l) => t(l, "Suivez l’avancement des jalons, la livraison des livrables et la validation des preuves sur l’ensemble des missions.", "تابع تقدم المعالم وتسليم التسليمات ومصادقة الأدلة."),
    search: (l) => t(l, "Rechercher un jalon, un livrable…", "ابحث عن معلم أو تسليم…"),
    columns: (l) => t(l, "Mission,Jalon,Livrable,Responsable,Échéance,Preuves,Validation,Facturation liée,État,Actions", "المهمة,المعلم,التسليم,المسؤول,الاستحقاق,الأدلة,المصادقة,الفوترة,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "Jalons à venir,En cours,Livrables déposés,À valider,Rejetés,Acceptés,En retard,Archivés", "معالم قادمة,جارٍ,تسليمات مودعة,للمصادقة,مرفوضة,مقبولة,متأخرة,مؤرشفة").split(","),
    filters: (l) => t(l, "Mission,Client,Prestataire,Type,Statut,Échéance", "المهمة,العميل,مقدم الخدمة,النوع,الحالة,الاستحقاق").split(","),
    pipeline: (l) => [
      { label: t(l, "Planifier", "التخطيط"), hint: t(l, "Jalons", "المعالم"), tone: "violet" },
      { label: t(l, "Exécuter", "التنفيذ"), hint: t(l, "Activités", "الأنشطة"), tone: "sky" },
      { label: t(l, "Déposer", "الإيداع"), hint: t(l, "Preuves", "الأدلة"), tone: "peach" },
      { label: t(l, "Scanner", "المسح"), hint: t(l, "Contrôle", "الرقابة"), tone: "mint" },
      { label: t(l, "Examiner", "المعاينة"), hint: t(l, "Avis", "الرأي"), tone: "violet" },
      { label: t(l, "Accepter", "القبول"), hint: t(l, "Client", "العميل"), tone: "sky" },
      { label: t(l, "Facturer", "الفوترة"), hint: t(l, "Déclenchement", "التفعيل"), tone: "peach" },
    ],
    tabs: (l) => t(l, "Synthèse,Critères d’acceptation,Livrables,Preuves,Contrôles fichiers,Commentaires,Décisions,Historique", "ملخص,معايير القبول,التسليمات,الأدلة,الضوابط,التعليقات,القرارات,التاريخ").split(","),
    createLabel: (l) => t(l, "Examiner les jalons d’une mission", "مراجعة مراحل مهمة"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Validations en attente", "مصادقات معلقة"),
    empty: (l) => t(l, "Aucun jalon à afficher.", "لا يوجد معلم للعرض."),
    cycleTitle: (l) => t(l, "Cycle jalon → paiement", "من المعلم إلى الدفع"),
  },
  documents: {
    id: "documents", nav: "parcours", current: "documents", source: "documents", resourceType: "DOCUMENT",
    title: (l) => t(l, "Documents & coffre", "الوثائق والخزينة"),
    lead: (l) => t(l, "Référentiel sécurisé des documents. Centralisez, contrôlez et suivez l’ensemble des documents de la plateforme.", "مرجع آمن للوثائق. ركّز وتحكم وتابع وثائق المنصة."),
    search: (l) => t(l, "Rechercher un document…", "ابحث عن وثيقة…"),
    columns: (l) => t(l, "Document,Propriétaire,Type,Dossier,Sensibilité,Version,Scan,Accès,Expiration,État,Actions", "الوثيقة,المالك,النوع,الملف,الحساسية,النسخة,المسح,الوصول,الانتهاء,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "Tous,À examiner,En analyse,Conforme,Bloqué,À renouveler,Expiré,Archivé", "الكل,للمعاينة,قيد التحليل,مطابق,محظور,للتجديد,منتهٍ,مؤرشف").split(","),
    filters: (l) => t(l, "Organisation,Type d’acteur,Dossier lié,Classification,Statut scan,Expiration", "المؤسسة,نوع الفاعل,الملف المرتبط,التصنيف,حالة المسح,الانتهاء").split(","),
    pipeline: () => [],
    tabs: (l) => t(l, "Aperçu,Métadonnées,Versions,Utilisations,Accès,Analyses,Historique", "معاينة,البيانات,النسخ,الاستخدامات,الوصول,التحاليل,التاريخ").split(","),
    createLabel: (l) => t(l, "Préparer un partage contrôlé", "تحضير مشاركة خاضعة للرقابة"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Documents en quarantaine", "وثائق في الحجر"),
    empty: (l) => t(l, "Aucun document à afficher.", "لا توجد وثيقة للعرض."),
    cycleTitle: (l) => t(l, "Coffre sécurisé", "خزينة آمنة"),
  },
  messagerie: {
    id: "messagerie", nav: "parcours", current: "messagerie", source: "messages", resourceType: "MESSAGE",
    title: (l) => t(l, "Messagerie & notifications", "المراسلة والإشعارات"),
    lead: (l) => t(l, "Consultez, traitez et suivez toutes les conversations et notifications de la plateforme.", "راجع وعالج وتابع المحادثات والإشعارات."),
    search: (l) => t(l, "Rechercher une conversation…", "ابحث عن محادثة…"),
    columns: (l) => t(l, "Conversation / notification,Participants,Contexte,Canal,Dernière activité,Non lus,État d’envoi,Priorité,Actions", "المحادثة,المشاركون,السياق,القناة,آخر نشاط,غير مقروء,حالة الإرسال,الأولوية,إجراءات").split(","),
    pills: (l) => t(l, "Conversations,Non lus,Signalés,Notifications en attente,Envoyées,Échecs,Préférences", "محادثات,غير مقروء,مبلغ عنها,إشعارات معلقة,مرسلة,إخفاقات,تفضيلات").split(","),
    filters: (l) => t(l, "Organisation,Acteur,Dossier lié,Canal,Priorité,État", "المؤسسة,الفاعل,الملف,القناة,الأولوية,الحالة").split(","),
    pipeline: () => [],
    tabs: (l) => t(l, "Règles,Modèles FR/AR,Canaux,Préférences utilisateur,File d’envoi,Échecs & reprises,Historique", "القواعد,القوالب,القنوات,التفضيلات,طابور الإرسال,الإخفاقات,التاريخ").split(","),
    exportable: true,
    treatTitle: (l) => t(l, "Conversations urgentes sans réponse", "محادثات عاجلة بلا رد"),
    empty: (l) => t(l, "Aucune conversation à afficher.", "لا توجد محادثة للعرض."),
    cycleTitle: (l) => t(l, "Règles de messagerie", "قواعد المراسلة"),
  },
  litiges: {
    id: "litiges", nav: "parcours", current: "litiges", source: "disputes", resourceType: "DISPUTE",
    title: (l) => t(l, "Litiges & réaffectations", "النزاعات وإعادة التعيين"),
    lead: (l) => t(l, "Traitez les différends entre clients et prestataires, conduisez la médiation, et si nécessaire, réaffectez les missions.", "عالج الخلافات بين العملاء ومقدمي الخدمات وأدر الوساطة وأعد التعيين عند الحاجة."),
    search: (l) => t(l, "Rechercher un litige…", "ابحث عن نزاع…"),
    columns: (l) => t(l, "Litige,Mission,Parties,Motif,Preuves,Contradictoire,Médiation,Décision,État,Actions", "النزاع,المهمة,الأطراف,السبب,الأدلة,الحضوري,الوساطة,القرار,الحالة,إجراءات").split(","),
    pills: (l) => t(l, "Nouveaux,Recevables,Instruction,Médiation,Décision,Réaffectation,Résolus,Clos,Archivés", "جديدة,مقبولة,تحقيق,وساطة,قرار,إعادة تعيين,محلولة,مغلقة,مؤرشفة").split(","),
    filters: (l) => t(l, "Client,Prestataire,Mission,Motif,Gravité,État,Responsable", "العميل,مقدم الخدمة,المهمة,السبب,الخطورة,الحالة,المسؤول").split(","),
    pipeline: (l) => [
      { label: t(l, "Signalement", "التبليغ"), hint: t(l, "Ouverture", "الفتح"), tone: "violet" },
      { label: t(l, "Recevabilité", "القبول"), hint: t(l, "Cadrage", "التأطير"), tone: "sky" },
      { label: t(l, "Contradictoire", "الحضوري"), hint: t(l, "Échanges", "التبادل"), tone: "peach" },
      { label: t(l, "Médiation", "الوساطة"), hint: t(l, "Accord", "الاتفاق"), tone: "mint" },
      { label: t(l, "Décision", "القرار"), hint: t(l, "Arbitrage", "التحكيم"), tone: "violet" },
      { label: t(l, "Exécution", "التنفيذ"), hint: t(l, "Réaffectation", "إعادة التعيين"), tone: "sky" },
      { label: t(l, "Clôture", "الإغلاق"), hint: t(l, "Audit", "التدقيق"), tone: "peach" },
    ],
    tabs: (l) => t(l, "Synthèse,Parties,Réclamations,Réponses,Preuves,Chronologie,Médiation,Décisions,Réaffectation,Historique", "ملخص,الأطراف,الشكاوى,الردود,الأدلة,التسلسل,الوساطة,القرارات,إعادة التعيين,التاريخ").split(","),
    exportable: true,
    treatTitle: (l) => t(l, "Cas urgents", "حالات عاجلة"),
    empty: (l) => t(l, "Aucun litige à afficher.", "لا يوجد نزاع للعرض."),
    cycleTitle: (l) => t(l, "Cycle du litige", "دورة النزاع"),
  },
};

export function spaceSpec(id: AdminSpaceId): SpaceSpec {
  return specs[id];
}

export function spaceHref(locale: Locale, id: AdminSpaceId, query: string, itemId?: string, action?: string) {
  if (!itemId) return `/${locale}/administration/${id}${query}`;
  const path = `/${locale}/administration/${id}/${itemId}${action ? `/${action}` : ""}`;
  return `${path}${query}`;
}

export function statusTone(status: string): SpaceTone {
  const key = status.toUpperCase();
  if (/(ACTIVE|ACTIF|VERIFIED|TERMINE|DONE|SIGNED|APPROVED|QUALIFI|CLOS|ACCEPTE|CONFORME|MINT)/.test(key)) return "mint";
  if (/(PENDING|REVIEW|COURS|INSTRUCTION|CANDIDAT|BROUILLON|VIOLET)/.test(key)) return "violet";
  if (/(SUSPEND|REJECT|REFUS|INACTIVE|EXPIR|BLOQU|RETARD|URGENT|DANGER)/.test(key)) return "peach";
  return "sky";
}
