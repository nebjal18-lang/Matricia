import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type AdminLink = { id: string; href: string; label: string; summary: string };

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

export function adminActorLinks(locale: Locale, q: string): AdminLink[] {
  const p = `/${locale}`;
  return [
    { id: "orgs", href: `${p}/administration/entreprises${q}`, label: t(locale, "Organisations", "المؤسسات"), summary: t(locale, "Consulter et administrer les passeports d’organisations multi-rôles.", "عرض وإدارة جوازات المؤسسات متعددة الأدوار.") },
    { id: "users", href: `${p}/administration/utilisateurs${q}`, label: t(locale, "Utilisateurs, rôles & invitations", "المستخدمون والأدوار والدعوات"), summary: t(locale, "Gérer comptes, rôles, invitations et accès membres.", "إدارة الحسابات والأدوار والدعوات وصلاحيات الأعضاء.") },
    { id: "clients", href: `${p}/administration/clients${q}`, label: t(locale, "Clients", "العملاء"), summary: t(locale, "Suivre les organisations clientes, profils et dossiers actifs.", "متابعة مؤسسات العملاء والملفات النشطة.") },
    { id: "capability-reviews", href: `${p}/administration/revues-capacites${q}`, label: t(locale, "Revues de capacités", "مراجعات القدرات"), summary: t(locale, "Valider les preuves de capacité métier avant activation.", "اعتماد أدلة القدرة المهنية قبل التفعيل.") },
    { id: "privacy", href: `${p}/administration/confidentialite${q}`, label: t(locale, "Confidentialité et droits des personnes", "الخصوصية وحقوق الأشخاص"), summary: t(locale, "Traiter les droits personnes et les demandes de rétention.", "معالجة حقوق الأشخاص وطلبات الاحتفاظ.") },
    { id: "compliance", href: `${p}/administration/conformite-clients${q}`, label: t(locale, "Conformité clients", "امتثال العملاء"), summary: t(locale, "Revue humaine des dossiers de conformité Client.", "مراجعة بشرية لملفات امتثال العملاء.") },
    { id: "providers", href: `${p}/administration/providers${q}`, label: t(locale, "Prestataires", "مقدمو الخدمات"), summary: t(locale, "Piloter le référentiel et le statut des prestataires.", "قيادة دليل مقدمي الخدمات وحالاتهم.") },
    { id: "qualification", href: `${p}/administration/qualification${q}`, label: t(locale, "Qualification prestataires", "تأهيل مقدمي الخدمات"), summary: t(locale, "Décider la qualification et les preuves associées.", "اتخاذ قرارات التأهيل والأدلة المرتبطة.") },
    { id: "capacity", href: `${p}/administration/capacite${q}`, label: t(locale, "Capacité & documents prestataires", "قدرة ووثائق مقدمي الخدمات"), summary: t(locale, "Contrôler capacités déclarées et pièces justificatives.", "مراقبة القدرات المصرح بها والوثائق الداعمة.") },
    { id: "franchise", href: `${p}/administration/franchises${q}`, label: t(locale, "Franchisés", "أصحاب الامتياز"), summary: t(locale, "Administrer les organisations franchise et leurs mandats.", "إدارة مؤسسات الامتياز وتفويضاتها.") },
    { id: "territories", href: `${p}/administration/territoires${q}`, label: t(locale, "Territoires & mandats", "الأقاليم والتفويضات"), summary: t(locale, "Définir territoires, mandats et règles de gouvernance.", "تحديد الأقاليم والتفويضات وقواعد الحوكمة.") },
  ];
}

export function adminParcoursLinks(locale: Locale, q: string): AdminLink[] {
  const p = `/${locale}`;
  return [
    { id: "franchise-applications", href: `${p}/administration/candidatures-franchise${q}`, label: t(locale, "Candidatures franchise", "ترشيحات الامتياز"), summary: t(locale, "Instruire et décider les candidatures franchise.", "دراسة قرارات ترشيحات الامتياز.") },
    { id: "diagnostics", href: `${p}/administration/diagnostics${q}`, label: t(locale, "Diagnostics", "التشخيصات"), summary: t(locale, "Superviser scores, anomalies et recommandations.", "الإشراف على الدرجات والشذوذ والتوصيات.") },
    { id: "demandes", href: `${p}/administration/demandes${q}`, label: t(locale, "Besoins & demandes", "الحاجات والطلبات"), summary: t(locale, "Suivre les RFQ et besoins exprimés par les clients.", "متابعة طلبات العروض وحاجات العملاء.") },
    { id: "matching", href: `${p}/administration/matching${q}`, label: t(locale, "Matching & consultations", "المطابقة والاستشارات"), summary: t(locale, "Contrôler l’éligibilité et les consultations ouvertes.", "مراقبة الأهلية والاستشارات المفتوحة.") },
    { id: "devis", href: `${p}/administration/devis${q}`, label: t(locale, "Devis & comparaison", "العروض والمقارنة"), summary: t(locale, "Comparer devis normalisés sans montants flottants.", "مقارنة العروض الموحّدة دون مبالغ عشرية عائمة.") },
    { id: "contrats", href: `${p}/administration/contrats${q}`, label: t(locale, "Contrats & signatures", "العقود والتوقيعات"), summary: t(locale, "Superviser versions contractuelles et signatures.", "الإشراف على نسخ العقود والتوقيعات.") },
    { id: "avenants", href: `${p}/administration/avenants${q}`, label: t(locale, "Avenants", "الملاحق"), summary: t(locale, "Traiter les avenants et changements de périmètre.", "معالجة الملاحق وتغييرات النطاق.") },
    { id: "missions", href: `${p}/administration/missions${q}`, label: t(locale, "Missions", "المهام"), summary: t(locale, "Piloter l’exécution des missions et jalons.", "قيادة تنفيذ المهام والمعالم.") },
    { id: "jalons", href: `${p}/administration/jalons${q}`, label: t(locale, "Jalons, livrables & preuves", "المعالم والتسليمات والأدلة"), summary: t(locale, "Valider livrables, preuves et acceptation.", "اعتماد التسليمات والأدلة والقبول.") },
    { id: "documents", href: `${p}/administration/documents${q}`, label: t(locale, "Documents & coffre", "الوثائق والخزينة"), summary: t(locale, "Superviser le coffre documentaire et les preuves.", "الإشراف على خزينة الوثائق والأدلة.") },
    { id: "messagerie", href: `${p}/administration/messagerie${q}`, label: t(locale, "Messagerie & notifications", "المراسلة والإشعارات"), summary: t(locale, "Surveiller fils internes et notifications critiques.", "مراقبة المحادثات الداخلية والإشعارات الحرجة.") },
    { id: "litiges", href: `${p}/administration/litiges${q}`, label: t(locale, "Litiges & réaffectations", "النزاعات وإعادة التعيين"), summary: t(locale, "Médiation, preuves et réaffectation contrôlée.", "الوساطة والأدلة وإعادة التعيين المضبوطة.") },
    { id: "reputation", href: `${p}/administration/incitations${q}`, label: t(locale, "Récompenses, badges et parrainage", "المكافآت والشارات والإحالة"), summary: t(locale, "Gérer badges, récompenses et programmes de parrainage.", "إدارة الشارات والمكافآت وبرامج الإحالة.") },
    { id: "recurring", href: `${p}/administration/achats-groupes${q}`, label: t(locale, "Achats groupés", "مشتريات مجمّعة"), summary: t(locale, "Piloter pools d’achat et allocations fournisseurs.", "قيادة مجمعات الشراء وتوزيع الموردين.") },
  ];
}

export const ADMIN_SPACE_IDS = [
  "providers", "qualification", "capacite", "franchises", "territoires", "gouvernance",
  "diagnostics", "demandes", "matching", "devis", "contrats", "avenants",
  "missions", "jalons", "documents", "messagerie", "litiges",
] as const;

export type AdminSpaceId = (typeof ADMIN_SPACE_IDS)[number];

export function isAdminSpaceId(value: string): value is AdminSpaceId {
  return (ADMIN_SPACE_IDS as readonly string[]).includes(value);
}

export const SPACE_RESERVED_VIEWS = ["nouvelle", "comparer", "preparer", "reutilisation", "preferences", "validations"] as const;
export type SpaceReservedView = (typeof SPACE_RESERVED_VIEWS)[number];

export function isReservedView(value: string): value is SpaceReservedView {
  return (SPACE_RESERVED_VIEWS as readonly string[]).includes(value);
}
