import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type AdminLink = { id: string; href: string; label: string };

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

export function adminActorLinks(locale: Locale, q: string): AdminLink[] {
  const p = `/${locale}`;
  return [
    { id: "orgs", href: `${p}/administration/entreprises${q}`, label: t(locale, "Organisations", "المؤسسات") },
    { id: "users", href: `${p}/administration/utilisateurs${q}`, label: t(locale, "Utilisateurs, rôles & invitations", "المستخدمون والأدوار والدعوات") },
    { id: "clients", href: `${p}/administration/clients${q}`, label: t(locale, "Clients", "العملاء") },
    { id: "capability-reviews", href: `${p}/administration/revues-capacites${q}`, label: t(locale, "Revues de capacités", "مراجعات القدرات") },
    { id: "privacy", href: `${p}/administration/confidentialite${q}`, label: t(locale, "Confidentialité & droits", "الخصوصية والحقوق") },
    { id: "compliance", href: `${p}/administration/conformite-clients${q}`, label: t(locale, "Conformité clients", "امتثال العملاء") },
    { id: "providers", href: `${p}/administration/providers${q}`, label: t(locale, "Prestataires", "مقدمو الخدمات") },
    { id: "qualification", href: `${p}/administration/qualification${q}`, label: t(locale, "Qualification prestataires", "تأهيل مقدمي الخدمات") },
    { id: "capacity", href: `${p}/administration/capacite${q}`, label: t(locale, "Capacité & documents prestataires", "قدرة ووثائق مقدمي الخدمات") },
    { id: "franchise", href: `${p}/administration/franchises${q}`, label: t(locale, "Franchisés", "أصحاب الامتياز") },
    { id: "territories", href: `${p}/administration/territoires${q}`, label: t(locale, "Territoires, mandats & gouvernance franchise", "الأقاليم والتفويضات وحوكمة الامتياز") },
  ];
}

export function adminParcoursLinks(locale: Locale, q: string): AdminLink[] {
  const p = `/${locale}`;
  return [
    { id: "diagnostics", href: `${p}/administration/diagnostics${q}`, label: t(locale, "Diagnostics", "التشخيصات") },
    { id: "demandes", href: `${p}/administration/demandes${q}`, label: t(locale, "Besoins & demandes", "الحاجات والطلبات") },
    { id: "matching", href: `${p}/administration/matching${q}`, label: t(locale, "Matching & consultations", "المطابقة والاستشارات") },
    { id: "devis", href: `${p}/administration/devis${q}`, label: t(locale, "Devis & comparaison", "العروض والمقارنة") },
    { id: "contrats", href: `${p}/administration/contrats${q}`, label: t(locale, "Contrats & signatures", "العقود والتوقيعات") },
    { id: "avenants", href: `${p}/administration/avenants${q}`, label: t(locale, "Avenants", "الملاحق") },
    { id: "missions", href: `${p}/administration/missions${q}`, label: t(locale, "Missions", "المهام") },
    { id: "jalons", href: `${p}/administration/jalons${q}`, label: t(locale, "Jalons, livrables & preuves", "المعالم والتسليمات والأدلة") },
    { id: "documents", href: `${p}/administration/documents${q}`, label: t(locale, "Documents & coffre", "الوثائق والخزينة") },
    { id: "messagerie", href: `${p}/administration/messagerie${q}`, label: t(locale, "Messagerie & notifications", "المراسلة والإشعارات") },
    { id: "litiges", href: `${p}/administration/litiges${q}`, label: t(locale, "Litiges & réaffectations", "النزاعات وإعادة التعيين") },
    { id: "reputation", href: `${p}/administration/incitations${q}`, label: t(locale, "Réputation, badges & parrainage", "السمعة والشارات والإحالة") },
    { id: "recurring", href: `${p}/administration/achats-groupes${q}`, label: t(locale, "Services récurrents", "خدمات متكررة") },
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
