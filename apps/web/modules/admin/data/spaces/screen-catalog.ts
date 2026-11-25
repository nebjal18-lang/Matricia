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
  /** When set, primary create CTA opens this real parcours instead of a fake free-form create page. */
  createHref?: (locale: Locale, query: string) => string;
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
    columns: (l) => t(l, "Prestataire,Services déclarés,Qualification,Capacité documents,Documents,Contrat partenaire,Action", "مقدم الخدمة,الخدمات,التأهيل,قدرة الوثائق,الوثائق,عقد الشريك,إجراء").split(","),
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
    lead: (l) => t(l, "Consultez et gérez la capacité d’intervention de vos prestataires, selon les règles applicables.", "راجعوا وقدّروا قدرة التدخل لمقدمي الخدمات وفق القواعد المعمول بها."),
    search: (l) => t(l, "Rechercher un prestataire, un service…", "ابحث عن مقدم خدمة أو خدمة…"),
    columns: (l) => t(l, "Prestataire,Code document,Statut,Type,Version,Document,Expiration,Actions", "مقدم الخدمة,رمز الوثيقة,الحالة,النوع,النسخة,الوثيقة,انتهاء الصلاحية,إجراءات").split(","),
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
    lead: (l) => t(l, "Annuaire des franchises actives et de leur gouvernance. Pas de création libre ici : ouvrez un dossier dans Candidatures franchise.", "دليل الامتيازات النشطة وحوكمتها. لا إنشاء حر هنا: افتحوا ملفاً من ترشيحات الامتياز."),
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
    createLabel: (l) => t(l, "Traiter une candidature", "معالجة ترشيح"),
    createView: "nouvelle",
    createHref: (l, q) => `/${l}/administration/candidatures-franchise${q}`,
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
    columns: (l) => t(l, "Franchisé,Territoire / périmètre,Bibliothèque,Mandat,Début,Fin,État,Actions", "صاحب الامتياز,الإقليم,المكتبة,التفويض,البداية,النهاية,الحالة,إجراءات").split(","),
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
    id: "gouvernance", nav: "actors", current: "governance", source: "approvals", resourceType: "FRANCHISE_APPROVAL",
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
    createLabel: (l) => t(l, "Préparer une validation", "تحضير مصادقة"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Priorités et conflits de rôles", "أولويات وتعارض الأدوار"),
    empty: (l) => t(l, "Aucune validation en file.", "لا توجد مصادقة في الانتظار."),
    cycleTitle: (l) => t(l, "Cycle de validation", "دورة المصادقة"),
  },
  diagnostics: {
    id: "diagnostics", nav: "parcours", current: "diagnostics", source: "diagnostics", resourceType: "DIAGNOSTIC",
    title: (l) => t(l, "Diagnostics", "التشخيصات"),
    lead: (l) => t(l, "Supervisez les diagnostics : scores, priorités et dossiers à reprendre. En mode Film démo, la file affiche le scénario régional déterministe.", "أشرفوا على التشخيصات: الدرجات والأولويات والملفات للمراجعة. في وضع فيلم العرض تُعرض السيناريوهات الإقليمية المحددة."),
    search: (l) => t(l, "Rechercher un diagnostic…", "ابحث عن تشخيص…"),
    columns: (l) => t(l, "Organisation,Diagnostic,Version du questionnaire,Score,Priorités détectées,Dernière activité,État", "المؤسسة,التشخيص,نسخة الاستبيان,النتيجة,الأولويات,آخر نشاط,الحالة").split(","),
    pills: (l) => t(l, "Brouillons,En cours,Terminés,À revoir,Archivés", "مسودات,جارٍ,منتهية,للمراجعة,مؤرشفة").split(","),
    filters: (l) => t(l, "Statut,Type,Organisation,Priorité,Période", "الحالة,النوع,المؤسسة,الأولوية,الفترة").split(","),
    pipeline: (l) => [
      { label: t(l, "Collecte", "الجمع"), hint: t(l, "Questionnaire", "الاستبيان"), tone: "violet" },
      { label: t(l, "Analyse", "التحليل"), hint: t(l, "Priorités", "الأولويات"), tone: "sky" },
      { label: t(l, "Résultat", "النتيجة"), hint: t(l, "Synthèse", "الملخص"), tone: "mint" },
      { label: t(l, "Plan d’action", "خطة العمل"), hint: t(l, "Recommandations", "التوصيات"), tone: "peach" },
      { label: t(l, "Conversion", "التحويل"), hint: t(l, "Besoin", "الحاجة"), tone: "violet" },
    ],
    tabs: (l) => t(l, "Synthèse,Priorités,Recommandations,Historique", "ملخص,الأولويات,التوصيات,التاريخ").split(","),
    createLabel: (l) => t(l, "Ouvrir le parcours acteur — diagnostic", "فتح مسار الفاعل — التشخيص"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "À revoir", "للمراجعة"),
    empty: (l) => t(l, "Aucun diagnostic à afficher.", "لا يوجد تشخيص للعرض."),
    cycleTitle: (l) => t(l, "Cycle du diagnostic", "دورة التشخيص"),
  },
  demandes: {
    id: "demandes", nav: "parcours", current: "demandes", source: "requests", resourceType: "REQUEST",
    title: (l) => t(l, "Besoins & demandes", "الحاجات والطلبات"),
    lead: (l) => t(l, "Supervisez les demandes client, de l’expression du besoin jusqu’à l’attribution. L’admin ne rédige pas le besoin à la place du Client.", "أشرفوا على طلبات العميل من التعبير عن الحاجة حتى الإسناد. الإدارة لا تكتب الحاجة باسم العميل."),
    search: (l) => t(l, "Rechercher une demande, un besoin…", "ابحث عن طلب أو حاجة…"),
    columns: (l) => t(l, "Organisation,Besoin,Domaine / service,Source,Complétude,Consultations,Offres,État", "المؤسسة,الحاجة,المجال / الخدمة,المصدر,الاكتمال,الاستشارات,العروض,الحالة").split(","),
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
    tabs: (l) => t(l, "Synthèse,Classification,Consultation,Offres,Historique", "ملخص,التصنيف,الاستشارة,العروض,التاريخ").split(","),
    createLabel: (l) => t(l, "Ouvrir le parcours acteur — demande", "فتح مسار الفاعل — الطلب"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "À revoir", "للمراجعة"),
    empty: (l) => t(l, "Aucune demande à afficher.", "لا يوجد طلب للعرض."),
    cycleTitle: (l) => t(l, "Cycle d’une demande", "دورة الطلب"),
  },
  matching: {
    id: "matching", nav: "parcours", current: "matching", source: "requests", resourceType: "MATCHING",
    title: (l) => t(l, "Mise en relation & consultations", "الربط والاستشارات"),
    lead: (l) => t(l, "Supervisez l’éligibilité, les scores explicables et les consultations — sans opacité.", "أشرفوا على الأهلية والدرجات القابلة للتفسير والاستشارات — دون غموض."),
    search: (l) => t(l, "Rechercher une consultation…", "ابحث عن استشارة…"),
    columns: (l) => t(l, "Organisation,Domaine / service,Éligibles,Exclus,Score,Raison d’exclusion,Revue,Consultations,État", "المؤسسة,المجال / الخدمة,المؤهلون,المستبعدون,الدرجة,سبب الاستبعاد,المراجعة,الاستشارات,الحالة").split(","),
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
    tabs: (l) => t(l, "Demande,Candidats,Exclusions,Historique", "الطلب,المرشحون,الاستبعادات,التاريخ").split(","),
    createLabel: (l) => t(l, "Ouvrir le parcours acteur — matching", "فتح مسار الفاعل — المطابقة"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "À revoir", "للمراجعة"),
    empty: (l) => t(l, "Aucune mise en relation à afficher.", "لا توجد عمليات ربط للعرض."),
    cycleTitle: (l) => t(l, "Cycle de mise en relation", "دورة الربط"),
  },
  devis: {
    id: "devis", nav: "parcours", current: "devis", source: "quotes", resourceType: "QUOTE",
    title: (l) => t(l, "Devis & comparaison", "العروض والمقارنة"),
    lead: (l) => t(l, "Supervisez les devis normalisés reçus pour chaque demande — le client choisit.", "أشرفوا على العروض الموحّدة الواردة لكل طلب — يختار العميل."),
    search: (l) => t(l, "Rechercher un devis…", "ابحث عن عرض…"),
    columns: (l) => t(l, "Devis,Demande,Prestataire,Version,Lignes,Sous-total,Taxes,Total,Validité,Conformité,État", "العرض,الطلب,مقدم الخدمة,النسخة,البنود,المجموع الفرعي,الضرائب,الإجمالي,الصلاحية,الامتثال,الحالة").split(","),
    pills: (l) => t(l, "Brouillons,Reçus,À vérifier,Révisions demandées,Validés,Expirés,Sélectionnés,Refusés", "مسودات,واردة,للتحقق,مراجعات,مصادق عليها,منتهية,مختارة,مرفوضة").split(","),
    filters: (l) => t(l, "Demande,Organisation,Prestataire,Statut,Devise,Fiscalité,Période", "الطلب,المؤسسة,مقدم الخدمة,الحالة,العملة,الضريبة,الفترة").split(","),
    pipeline: (l) => [
      { label: t(l, "Réception", "الاستلام"), hint: t(l, "Devis", "عرض"), tone: "violet" },
      { label: t(l, "Contrôle", "الرقابة"), hint: t(l, "Conformité", "الامتثال"), tone: "sky" },
      { label: t(l, "Comparaison", "المقارنة"), hint: t(l, "Normalisé", "موحّد"), tone: "mint" },
      { label: t(l, "Sélection", "الاختيار"), hint: t(l, "Client", "العميل"), tone: "peach" },
    ],
    tabs: (l) => t(l, "Synthèse,Montants,Conformité,Historique", "ملخص,المبالغ,الامتثال,التاريخ").split(","),
    createLabel: (l) => t(l, "Ouvrir le parcours acteur — devis", "فتح مسار الفاعل — العرض"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "À revoir", "للمراجعة"),
    empty: (l) => t(l, "Aucun devis à afficher.", "لا يوجد عرض للعرض."),
    cycleTitle: (l) => t(l, "Comparaison des offres", "مقارنة العروض"),
  },
  contrats: {
    id: "contrats", nav: "parcours", current: "contrats", source: "missions", resourceType: "CONTRACT",
    title: (l) => t(l, "Contrats & signatures", "العقود والتوقيعات"),
    lead: (l) => t(l, "Supervisez le cycle contrat → signature → activation. L’admin n’appose pas la signature métier.", "أشرفوا على دورة العقد ← التوقيع ← التفعيل. الإدارة لا تضع التوقيع المهني."),
    search: (l) => t(l, "Rechercher un contrat…", "ابحث عن عقد…"),
    columns: (l) => t(l, "Contrat,Mission,Client,Prestataire,Version,Signataires,Signature,Activation,État", "العقد,المهمة,العميل,مقدم الخدمة,النسخة,الموقعون,التوقيع,التفعيل,الحالة").split(","),
    pills: (l) => t(l, "À préparer,En revue,À signer,Signature en cours,Signés,À activer,Actifs,Suspendus,Clos,Archivés", "للتحضير,قيد المراجعة,للتوقيع,توقيع جارٍ,موقعة,للتفعيل,نشطة,موقوفة,مغلقة,مؤرشفة").split(","),
    filters: (l) => t(l, "Organisation cliente,Prestataire,Mission,Statut,Version,Signature,Période", "مؤسسة العميل,مقدم الخدمة,المهمة,الحالة,النسخة,التوقيع,الفترة").split(","),
    pipeline: (l) => [
      { label: t(l, "Offre choisie", "العرض المختار"), hint: t(l, "Source", "المصدر"), tone: "violet" },
      { label: t(l, "Brouillon", "المسودة"), hint: t(l, "Clauses", "البنود"), tone: "sky" },
      { label: t(l, "Revue", "المراجعة"), hint: t(l, "Contrôle", "الرقابة"), tone: "peach" },
      { label: t(l, "Signature", "التوقيع"), hint: t(l, "Parties", "الأطراف"), tone: "mint" },
      { label: t(l, "Activation", "التفعيل"), hint: t(l, "Mission", "المهمة"), tone: "violet" },
    ],
    tabs: (l) => t(l, "Synthèse,Parties,Signatures,Historique", "ملخص,الأطراف,التوقيعات,التاريخ").split(","),
    createLabel: (l) => t(l, "Ouvrir le parcours acteur — contrat", "فتح مسار الفاعل — العقد"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Signatures en attente", "توقيعات معلّقة"),
    empty: (l) => t(l, "Aucun contrat à afficher.", "لا يوجد عقد للعرض."),
    cycleTitle: (l) => t(l, "Cycle de vie d’un contrat", "دورة حياة العقد"),
  },
  avenants: {
    id: "avenants", nav: "parcours", current: "avenants", source: "missions", resourceType: "AMENDMENT",
    title: (l) => t(l, "Avenants", "الملاحق"),
    lead: (l) => t(l, "Supervisez les avenants et le delta de prix — rédaction côté Client.", "أشرفوا على الملاحق وفرق السعر — الصياغة لدى العميل."),
    search: (l) => t(l, "Rechercher un avenant…", "ابحث عن ملحق…"),
    columns: (l) => t(l, "Avenant,Contrat source,Objet,Delta prix,N°,Signataires,Signature,Activation,État", "الملحق,العقد المصدر,الموضوع,فرق السعر,الرقم,الموقعون,التوقيع,التفعيل,الحالة").split(","),
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
    tabs: (l) => t(l, "Motif,Impacts,Signature,Historique", "السبب,الآثار,التوقيع,التاريخ").split(","),
    createLabel: (l) => t(l, "Ouvrir le parcours acteur — avenant", "فتح مسار الفاعل — الملحق"),
    createView: "preparer",
    exportable: true,
    treatTitle: (l) => t(l, "À revoir", "للمراجعة"),
    empty: (l) => t(l, "Aucun avenant à afficher.", "لا يوجد ملحق للعرض."),
    cycleTitle: (l) => t(l, "Cycle de vie d’un avenant", "دورة حياة الملحق"),
  },
  missions: {
    id: "missions", nav: "parcours", current: "missions", source: "missions", resourceType: "MISSION",
    title: (l) => t(l, "Missions", "المهام"),
    lead: (l) => t(l, "Supervisez l’exécution des missions, de l’activation du contrat à la clôture.", "أشرفوا على تنفيذ المهام من تفعيل العقد حتى الإغلاق."),
    search: (l) => t(l, "Rechercher une mission…", "ابحث عن مهمة…"),
    columns: (l) => t(l, "Mission,Contrat,Client,Prestataire,Progression,Prochain jalon,Livrables,Risques,État", "المهمة,العقد,العميل,مقدم الخدمة,التقدم,المعلم التالي,التسليمات,المخاطر,الحالة").split(","),
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
    tabs: (l) => t(l, "Synthèse,Jalons,Livrables,Historique", "ملخص,المعالم,التسليمات,التاريخ").split(","),
    createLabel: (l) => t(l, "Ouvrir le parcours acteur — mission", "فتح مسار الفاعل — المهمة"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "À revoir", "للمراجعة"),
    empty: (l) => t(l, "Aucune mission à afficher.", "لا توجد مهمة للعرض."),
    cycleTitle: (l) => t(l, "Cycle de vie d’une mission", "دورة حياة المهمة"),
  },
  jalons: {
    id: "jalons", nav: "parcours", current: "jalons", source: "missions", resourceType: "MILESTONE",
    title: (l) => t(l, "Jalons, livrables & preuves", "المعالم والتسليمات والأدلة"),
    lead: (l) => t(l, "Supervisez l’avancement des jalons et des preuves avant facturation.", "أشرفوا على تقدم المعالم والأدلة قبل الفوترة."),
    search: (l) => t(l, "Rechercher un jalon, un livrable…", "ابحث عن معلم أو تسليم…"),
    columns: (l) => t(l, "Mission,Jalon,Livrable,Responsable,Échéance,Preuves,Validation,Facturation liée,État", "المهمة,المعلم,التسليم,المسؤول,الاستحقاق,الأدلة,المصادقة,الفوترة,الحالة").split(","),
    pills: (l) => t(l, "Jalons à venir,En cours,Livrables déposés,À valider,Rejetés,Acceptés,En retard,Archivés", "معالم قادمة,جارٍ,تسليمات مودعة,للمصادقة,مرفوضة,مقبولة,متأخرة,مؤرشفة").split(","),
    filters: (l) => t(l, "Mission,Client,Prestataire,Type,Statut,Échéance", "المهمة,العميل,مقدم الخدمة,النوع,الحالة,الاستحقاق").split(","),
    pipeline: (l) => [
      { label: t(l, "Planifier", "التخطيط"), hint: t(l, "Jalons", "المعالم"), tone: "violet" },
      { label: t(l, "Exécuter", "التنفيذ"), hint: t(l, "Activités", "الأنشطة"), tone: "sky" },
      { label: t(l, "Déposer", "الإيداع"), hint: t(l, "Preuves", "الأدلة"), tone: "peach" },
      { label: t(l, "Examiner", "المعاينة"), hint: t(l, "Avis", "الرأي"), tone: "violet" },
      { label: t(l, "Accepter", "القبول"), hint: t(l, "Client", "العميل"), tone: "sky" },
      { label: t(l, "Facturer", "الفوترة"), hint: t(l, "Déclenchement", "التفعيل"), tone: "peach" },
    ],
    tabs: (l) => t(l, "Synthèse,Preuves,Décisions,Historique", "ملخص,الأدلة,القرارات,التاريخ").split(","),
    createLabel: (l) => t(l, "Examiner les jalons d’une mission", "مراجعة مراحل مهمة"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "Jalons SUBMITTED", "معالم مقدَّمة"),
    empty: (l) => t(l, "Aucun jalon à afficher.", "لا يوجد معلم للعرض."),
    cycleTitle: (l) => t(l, "Cycle jalon → paiement", "من المعلم إلى الدفع"),
  },
  documents: {
    id: "documents", nav: "parcours", current: "documents", source: "documents", resourceType: "DOCUMENT",
    title: (l) => t(l, "Documents & coffre", "الوثائق والخزينة"),
    lead: (l) => t(l, "Supervisez le coffre documentaire versionné, les scans et les expirations.", "أشرفوا على خزينة الوثائق ذات الإصدارات والمسح والانتهاء."),
    search: (l) => t(l, "Rechercher un document…", "ابحث عن وثيقة…"),
    columns: (l) => t(l, "Document,Propriétaire,Type,Dossier,Sensibilité,Version,Scan,Accès,Expiration,État", "الوثيقة,المالك,النوع,الملف,الحساسية,النسخة,المسح,الوصول,الانتهاء,الحالة").split(","),
    pills: (l) => t(l, "Tous,À examiner,En analyse,Conforme,Bloqué,À renouveler,Expiré,Archivé", "الكل,للمعاينة,قيد التحليل,مطابق,محظور,للتجديد,منتهٍ,مؤرشف").split(","),
    filters: (l) => t(l, "Organisation,Type d’acteur,Dossier lié,Classification,Statut scan,Expiration", "المؤسسة,نوع الفاعل,الملف المرتبط,التصنيف,حالة المسح,الانتهاء").split(","),
    pipeline: (l) => [
      { label: t(l, "Dépôt", "الإيداع"), hint: t(l, "Coffre", "الخزينة"), tone: "violet" },
      { label: t(l, "Scan", "المسح"), hint: t(l, "Contrôle", "الرقابة"), tone: "sky" },
      { label: t(l, "Revue", "المراجعة"), hint: t(l, "Décision", "القرار"), tone: "peach" },
      { label: t(l, "Partage", "المشاركة"), hint: t(l, "Accès", "الوصول"), tone: "mint" },
    ],
    tabs: (l) => t(l, "Aperçu,Versions,Accès,Historique", "معاينة,النسخ,الوصول,التاريخ").split(","),
    createLabel: (l) => t(l, "Préparer un partage contrôlé", "تحضير مشاركة خاضعة للرقابة"),
    createView: "nouvelle",
    exportable: true,
    treatTitle: (l) => t(l, "À traiter", "للمعالجة"),
    empty: (l) => t(l, "Aucun document à afficher.", "لا توجد وثيقة للعرض."),
    cycleTitle: (l) => t(l, "Coffre sécurisé", "خزينة آمنة"),
  },
  messagerie: {
    id: "messagerie", nav: "parcours", current: "messagerie", source: "messages", resourceType: "MESSAGE",
    title: (l) => t(l, "Messagerie & notifications", "المراسلة والإشعارات"),
    lead: (l) => t(l, "Supervisez séparément les conversations de dossier et les notifications plateforme.", "أشرفوا على محادثات الملفات وإشعارات المنصة بشكل منفصل."),
    search: (l) => t(l, "Rechercher une conversation ou une notification…", "ابحث عن محادثة أو إشعار…"),
    columns: (l) => t(l, "Objet,Participants,Contexte,Canal,Dernière activité,Non lus,État d’envoi,Priorité", "الموضوع,المشاركون,السياق,القناة,آخر نشاط,غير مقروء,حالة الإرسال,الأولوية").split(","),
    pills: (l) => t(l, "Conversations,Non lus,Signalés,Notifications,Envoyées,Échecs,Préférences", "محادثات,غير مقروء,مبلغ عنها,إشعارات,مرسلة,إخفاقات,تفضيلات").split(","),
    filters: (l) => t(l, "Organisation,Acteur,Dossier lié,Canal,Priorité,État", "المؤسسة,الفاعل,الملف,القناة,الأولوية,الحالة").split(","),
    pipeline: () => [],
    tabs: (l) => t(l, "Conversations,Notifications,Préférences,Historique", "المحادثات,الإشعارات,التفضيلات,التاريخ").split(","),
    exportable: true,
    treatTitle: (l) => t(l, "À revoir", "للمراجعة"),
    empty: (l) => t(l, "Aucune conversation ni notification à afficher pour ce filtre.", "لا محادثة ولا إشعار لهذا التصفية."),
    cycleTitle: (l) => t(l, "Fils et notifications", "المحادثات والإشعارات"),
  },
  litiges: {
    id: "litiges", nav: "parcours", current: "litiges", source: "disputes", resourceType: "DISPUTE",
    title: (l) => t(l, "Litiges & réaffectations", "النزاعات وإعادة التعيين"),
    lead: (l) => t(l, "Traitez les différends : médiation, décision motivée et réaffectation contrôlée.", "عالجوا الخلافات: وساطة وقرار معلل وإعادة تعيين مضبوطة."),
    search: (l) => t(l, "Rechercher un litige…", "ابحث عن نزاع…"),
    columns: (l) => t(l, "Litige,Mission,Parties,Motif,Preuves,Contradictoire,Médiation,Décision,État", "النزاع,المهمة,الأطراف,السبب,الأدلة,الحضوري,الوساطة,القرار,الحالة").split(","),
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
    tabs: (l) => t(l, "Synthèse,Preuves,Médiation,Décisions,Historique", "ملخص,الأدلة,الوساطة,القرارات,التاريخ").split(","),
    exportable: true,
    treatTitle: (l) => t(l, "À traiter", "للمعالجة"),
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

export function spaceCreateHref(locale: Locale, spec: SpaceSpec, query: string): string | null {
  if (!spec.createLabel) return null;
  if (spec.createHref) return spec.createHref(locale, query);
  if (spec.createView) return spaceHref(locale, spec.id, query, spec.createView);
  return null;
}

export function statusTone(status: string): SpaceTone {
  const key = status.toUpperCase();
  if (/(ACTIVE|ACTIF|VERIFIED|TERMINE|DONE|SIGNED|APPROVED|QUALIFI|CLOS|ACCEPTE|CONFORME|MINT)/.test(key)) return "mint";
  if (/(PENDING|REVIEW|COURS|INSTRUCTION|CANDIDAT|BROUILLON|VIOLET)/.test(key)) return "violet";
  if (/(SUSPEND|REJECT|REFUS|INACTIVE|EXPIR|BLOQU|RETARD|URGENT|DANGER)/.test(key)) return "peach";
  return "sky";
}
