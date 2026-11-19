import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type ModuleSpace = "client" | "provider" | "franchise" | "admin" | "shared";
export type AdminNavGroupId = "parties" | "finance" | "catalogue" | "operations";

const CLIENT_ALL = ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_ACCOUNTING", "CLIENT_MEMBER", "CLIENT_VIEWER"] as const;
const PROVIDER_ALL = ["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_TECHNICIAN", "PROVIDER_VIEWER"] as const;
const FRANCHISE_ALL = ["FRANCHISE_OWNER", "FRANCHISE_MANAGER", "FRANCHISE_EXPERT", "FRANCHISE_PROVIDER_MANAGER", "FRANCHISE_ACCOUNTING", "FRANCHISE_VIEWER"] as const;
const ADMIN_ALL = ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER", "COMPLIANCE_MANAGER", "LIBRARY_MANAGER", "DISPUTE_MANAGER", "READ_ONLY_AUDITOR"] as const;

type ModuleRouteDefinition = { id: string; path: string; space: ModuleSpace; roles?: readonly string[]; platformRoles?: readonly string[]; requiresMembership?: boolean; authenticated?: boolean };

/** Registre unique de navigation. Il améliore la découvrabilité; les pages gardent leurs contrôles serveur et RLS. */
export const MODULE_ROUTE_REGISTRY = [
  { id: "client-home", path: "client/diagnostics", space: "client", roles: CLIENT_ALL },
  { id: "client-onboarding", path: "client/onboarding", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN"] },
  { id: "client-questionnaires", path: "client/questionnaires", space: "client", roles: CLIENT_ALL },
  { id: "client-requests", path: "client/demandes", space: "client", roles: CLIENT_ALL },
  { id: "client-missions", path: "client/missions", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_VIEWER"] },
  { id: "client-portfolio", path: "client/portefeuille", space: "client", roles: CLIENT_ALL },
  { id: "client-documents", path: "client/documents", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN"] },
  { id: "client-disputes", path: "client/litiges", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN"] },
  { id: "client-finances", path: "client/finances", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_ACCOUNTING", "CLIENT_VIEWER"] },
  { id: "client-subscription", path: "client/abonnement", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_ACCOUNTING", "CLIENT_VIEWER"] },
  { id: "client-credits", path: "client/credits", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_ACCOUNTING"] },
  { id: "client-volume", path: "client/achats-groupes", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER"] },
  { id: "client-rewards", path: "client/recompenses", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_ACCOUNTING"] },
  { id: "client-favorites", path: "client/favoris", space: "client", roles: ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_VIEWER"] },
  { id: "provider-qualification", path: "sous-traitant/qualification", space: "provider", roles: PROVIDER_ALL },
  { id: "provider-quotes", path: "sous-traitant/devis", space: "provider", roles: PROVIDER_ALL },
  { id: "provider-missions", path: "sous-traitant/missions", space: "provider", roles: PROVIDER_ALL },
  { id: "provider-planning", path: "sous-traitant/planning", space: "provider", roles: PROVIDER_ALL },
  { id: "provider-billing", path: "sous-traitant/facturation", space: "provider", roles: ["PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_VIEWER"] },
  { id: "provider-reputation", path: "sous-traitant/reputation", space: "provider", roles: PROVIDER_ALL },
  { id: "franchise-home", path: "franchise/accueil", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "franchise-perimeter", path: "franchise/perimetre", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "franchise-network", path: "franchise/reseau", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "franchise-requests", path: "franchise/demandes", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "franchise-quality", path: "franchise/qualite", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "franchise-performance", path: "franchise/performance", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "franchise-followups", path: "franchise/relances", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "franchise-governance", path: "franchise/gouvernance", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "franchise-finance", path: "franchise/finance", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "franchise-digest", path: "franchise/digest", space: "franchise", roles: FRANCHISE_ALL, platformRoles: ADMIN_ALL },
  { id: "admin-command", path: "administration/command-center", space: "admin", platformRoles: ADMIN_ALL },
  { id: "admin-parcours", path: "administration/parcours", space: "admin", platformRoles: ADMIN_ALL },
  { id: "admin-entreprises", path: "administration/entreprises", space: "admin", platformRoles: ADMIN_ALL },
  { id: "admin-clients", path: "administration/clients", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-client-compliance", path: "administration/conformite-clients", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-providers", path: "administration/providers", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "FINANCE_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-finance", path: "administration/finance", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-finance-approvals", path: "administration/approbations-finance", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-tax", path: "administration/fiscalite-maroc", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER"] },
  { id: "admin-volume", path: "administration/achats-groupes", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER"] },
  { id: "admin-franchise", path: "administration/gouvernance-franchise", space: "admin", platformRoles: ADMIN_ALL },
  { id: "admin-incentives", path: "administration/incitations", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER", "COMPLIANCE_MANAGER"] },
  { id: "admin-catalogue", path: "administration/catalogue", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "LIBRARY_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-catalogue-validation", path: "administration/catalogue/validation", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "LIBRARY_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-catalogue-publications", path: "administration/catalogue/publications", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "LIBRARY_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-cloning", path: "administration/clonage", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "LIBRARY_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-questionnaires", path: "administration/questionnaires/analytique", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "LIBRARY_MANAGER", "READ_ONLY_AUDITOR"] },
  { id: "admin-marketing", path: "administration/marketing-autopilot", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "READ_ONLY_AUDITOR"] },
  { id: "admin-operations", path: "administration/operations", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "READ_ONLY_AUDITOR"] },
  { id: "admin-abuse", path: "administration/anti-abus", space: "admin", platformRoles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "READ_ONLY_AUDITOR"] },
  { id: "admin-procurement", path: "administration/v4-1/procurement", space: "admin", platformRoles: ADMIN_ALL },
  { id: "shared-actions", path: "actions", space: "shared", requiresMembership: true },
  { id: "shared-messages", path: "messagerie", space: "shared", requiresMembership: true },
  { id: "shared-notifications", path: "notifications", space: "shared", requiresMembership: true },
  { id: "shared-organization", path: "organisation", space: "shared", authenticated: true },
  { id: "shared-roles", path: "organisation/roles", space: "shared", requiresMembership: true },
  { id: "shared-account", path: "securite/compte", space: "shared", authenticated: true },
  { id: "shared-sessions", path: "securite/sessions", space: "shared", authenticated: true },
] as const satisfies readonly ModuleRouteDefinition[];

export type ModuleRoute = (typeof MODULE_ROUTE_REGISTRY)[number];
export type ModuleRouteId = ModuleRoute["id"];

/** Groupes de navigation admin — le centre de pilotage reste mis en avant séparément. */
export const ADMIN_NAV_GROUPS = [
  { id: "parties", routes: ["admin-parcours", "admin-entreprises", "admin-clients", "admin-client-compliance", "admin-providers", "admin-franchise"] },
  { id: "finance", routes: ["admin-finance", "admin-finance-approvals", "admin-tax", "admin-volume", "admin-incentives", "admin-procurement"] },
  { id: "catalogue", routes: ["admin-catalogue", "admin-catalogue-validation", "admin-catalogue-publications", "admin-cloning", "admin-questionnaires", "admin-marketing"] },
  { id: "operations", routes: ["admin-operations", "admin-abuse"] },
] as const satisfies readonly { id: AdminNavGroupId; routes: readonly ModuleRouteId[] }[];

export const ADMIN_FEATURED_ROUTE_ID = "admin-command" as const satisfies ModuleRouteId;

type VisibilityContext = { membershipCount: number; membershipRoles: ReadonlySet<string>; platformRoles: ReadonlySet<string> };

export type AuthorizedOrganizationMembership = {
  membershipId: string;
  organizationId: string;
  displayName?: string;
};

/** Orgs de démo/test rattachées à des bibliothèques fixtures (ex. P06 concurrence). */
export function isCatalogFixtureOrganizationName(displayName: string | undefined): boolean {
  if (!displayName) return false;
  return /concurrence|\bp06\b|fixture|e2e|compatib/i.test(displayName);
}

export function resolveOrganizationContext(memberships: readonly AuthorizedOrganizationMembership[], requestedOrganizationId: string | null) {
  const requested = requestedOrganizationId ? memberships.find((membership) => membership.organizationId === requestedOrganizationId) : undefined;
  const preferred =
    memberships.find((membership) => !isCatalogFixtureOrganizationName(membership.displayName)) ?? memberships[0] ?? null;
  return { selected: requested ?? preferred, rejected: requestedOrganizationId !== null && !requested } as const;
}

export function visibleModuleRoutes(context: VisibilityContext): readonly ModuleRoute[] {
  return MODULE_ROUTE_REGISTRY.filter((candidate) => {
    const route: ModuleRouteDefinition = candidate;
    return route.authenticated === true || (route.requiresMembership === true && context.membershipCount > 0) || route.roles?.some((role) => context.membershipRoles.has(role)) === true || route.platformRoles?.some((role) => context.platformRoles.has(role)) === true;
  });
}

const frLabels: Record<ModuleRouteId, string> = {
  "client-home": "Bilans et priorités", "client-onboarding": "Dossier de l’entreprise", "client-questionnaires": "Questionnaires", "client-requests": "Demandes et devis", "client-missions": "Contrats, missions et livrables", "client-portfolio": "Portefeuille, projets et budgets", "client-documents": "Documents et renouvellements", "client-disputes": "Litiges et preuves", "client-finances": "Finances et facturation", "client-subscription": "Abonnement", "client-credits": "Crédits commerciaux", "client-volume": "Achats groupés", "client-rewards": "Récompenses, parrainage et retour sur investissement", "client-favorites": "Sous-traitants favoris",
  "provider-qualification": "Qualification et compétences", "provider-quotes": "Consultations et devis", "provider-missions": "Missions, avenants et livraisons", "provider-planning": "Planning et échéances", "provider-billing": "Facturation et rapprochements", "provider-reputation": "Réputation, badges et capacité",
  "franchise-home": "Accueil et priorités", "franchise-perimeter": "Mon périmètre", "franchise-network": "Réseau professionnel", "franchise-requests": "Demandes", "franchise-quality": "Qualité et conformité", "franchise-governance": "Gouvernance et mandats", "franchise-performance": "Performance", "franchise-followups": "Relances", "franchise-finance": "Finance autorisée", "franchise-digest": "Résumé quotidien",
  "admin-command": "Centre de pilotage", "admin-parcours": "Supervision du parcours", "admin-entreprises": "Fiches entreprises", "admin-clients": "Entreprises clientes", "admin-client-compliance": "Conformité des clients", "admin-providers": "Sous-traitants", "admin-finance": "Paiements et abonnements", "admin-finance-approvals": "Approbations et commissions", "admin-tax": "Fiscalité Maroc", "admin-volume": "Achats groupés", "admin-franchise": "Gouvernance des franchises", "admin-incentives": "Récompenses et parrainage", "admin-catalogue": "Référentiel interne", "admin-catalogue-validation": "Validation du référentiel", "admin-catalogue-publications": "Publications du référentiel", "admin-cloning": "Clonage avec provenance", "admin-questionnaires": "Analytique des questionnaires", "admin-marketing": "Marketing et calendrier éditorial", "admin-operations": "Exploitation et traitements", "admin-abuse": "Contrôle des abus", "admin-procurement": "Achats et fournisseurs avancés",
  "shared-actions": "Actions requises", "shared-messages": "Messagerie sécurisée", "shared-notifications": "Notifications", "shared-organization": "Organisation et espace de travail", "shared-roles": "Rôles et invitations", "shared-account": "Sécurité du compte", "shared-sessions": "Sessions actives",
};

const arLabels: Record<ModuleRouteId, string> = {
  "client-home": "التحليلات والأولويات", "client-onboarding": "ملف المؤسسة", "client-questionnaires": "الاستبيانات", "client-requests": "الطلبات والعروض", "client-missions": "العقود والمهام والتسليمات", "client-portfolio": "المحفظة والمشاريع والميزانيات", "client-documents": "المستندات والتجديدات", "client-disputes": "النزاعات والأدلة", "client-finances": "المالية والفواتير", "client-subscription": "الاشتراك", "client-credits": "الأرصدة التجارية", "client-volume": "المشتريات المجمعة", "client-rewards": "المكافآت والإحالة والعائد على الاستثمار", "client-favorites": "مقدمو الخدمات المفضلون",
  "provider-qualification": "التأهيل والكفاءات", "provider-quotes": "الاستشارات والعروض", "provider-missions": "المهام والملاحق والتسليمات", "provider-planning": "التخطيط والمواعيد", "provider-billing": "الفوترة والمطابقة", "provider-reputation": "السمعة والشارات والقدرة",
  "franchise-home": "الرئيسية والأولويات", "franchise-perimeter": "نطاقي", "franchise-network": "الشبكة المهنية", "franchise-requests": "الطلبات", "franchise-quality": "الجودة والامتثال", "franchise-governance": "الحوكمة والتفويضات", "franchise-performance": "الأداء", "franchise-followups": "المتابعات", "franchise-finance": "المالية المصرّح بها", "franchise-digest": "الملخص اليومي",
  "admin-command": "مركز القيادة", "admin-parcours": "إشراف المسار", "admin-entreprises": "بطاقات المؤسسات", "admin-clients": "المؤسسات العميلة", "admin-client-compliance": "امتثال العملاء", "admin-providers": "مقدمو الخدمات", "admin-finance": "المدفوعات والاشتراكات", "admin-finance-approvals": "الموافقات والعمولات", "admin-tax": "الضرائب المغربية", "admin-volume": "المشتريات المجمعة", "admin-franchise": "حوكمة الامتيازات", "admin-incentives": "المكافآت والإحالة", "admin-catalogue": "المرجع الداخلي", "admin-catalogue-validation": "اعتماد المرجع", "admin-catalogue-publications": "إصدارات المرجع", "admin-cloning": "الاستنساخ مع توثيق المصدر", "admin-questionnaires": "تحليلات الاستبيانات", "admin-marketing": "التسويق والتقويم التحريري", "admin-operations": "التشغيل والمعالجات", "admin-abuse": "مراقبة إساءة الاستخدام", "admin-procurement": "المشتريات والموردون المتقدمون",
  "shared-actions": "الإجراءات المطلوبة", "shared-messages": "المراسلة الآمنة", "shared-notifications": "الإشعارات", "shared-organization": "المؤسسة ومساحة العمل", "shared-roles": "الأدوار والدعوات", "shared-account": "أمان الحساب", "shared-sessions": "الجلسات النشطة",
};

const frAdminDescriptions: Record<Extract<ModuleRouteId, `admin-${string}`>, string> = {
  "admin-command": "Priorités du jour, exceptions et décisions sensibles.",
  "admin-parcours": "Demandes, devis, missions et diagnostics en lecture.",
  "admin-entreprises": "Fiche centrale composée par organisation.",
  "admin-clients": "Vue des entreprises et dossiers clients autorisés.",
  "admin-client-compliance": "Revue motivée des dossiers de conformité.",
  "admin-providers": "Qualification, preuves et exceptions financières.",
  "admin-finance": "Paiements, abonnements et rapprochements.",
  "admin-finance-approvals": "Commissions et validations à quatre yeux.",
  "admin-tax": "Règles fiscales datées et simulations exactes.",
  "admin-volume": "Allocation et consommation des achats groupés.",
  "admin-franchise": "Territoires, mandats, distributions et litiges.",
  "admin-incentives": "Récompenses, parrainage et contrôles associés.",
  "admin-catalogue": "Releases versionnées du référentiel interne.",
  "admin-catalogue-validation": "Validation et simulation du moteur de règles.",
  "admin-catalogue-publications": "Historique borné et retours arrière.",
  "admin-cloning": "Duplication traçable avec provenance.",
  "admin-questionnaires": "Indicateurs d’usage des questionnaires.",
  "admin-marketing": "Campagnes consenties et calendrier éditorial.",
  "admin-operations": "Notifications, audit et file d’événements.",
  "admin-abuse": "Signaux d’abus et mesures contrôlées.",
  "admin-procurement": "Achats avancés, trésorerie et fournisseurs.",
};

const arAdminDescriptions: Record<Extract<ModuleRouteId, `admin-${string}`>, string> = {
  "admin-command": "أولويات اليوم والاستثناءات والقرارات الحساسة.",
  "admin-parcours": "الطلبات والعروض والمهام والتشخيصات للقراءة.",
  "admin-entreprises": "بطاقة مركزية مركبة لكل مؤسسة.",
  "admin-clients": "عرض المؤسسات وملفات العملاء المصرح بها.",
  "admin-client-compliance": "مراجعة معللة لملفات الامتثال.",
  "admin-providers": "التأهيل والأدلة والاستثناءات المالية.",
  "admin-finance": "المدفوعات والاشتراكات والمطابقة.",
  "admin-finance-approvals": "العمولات والموافقات بمبدأ الرقابة المزدوجة.",
  "admin-tax": "قواعد ضريبية مؤرخة ومحاكاة دقيقة.",
  "admin-volume": "تخصيص واستهلاك المشتريات المجمعة.",
  "admin-franchise": "الأقاليم والتفويضات والتوزيعات والنزاعات.",
  "admin-incentives": "المكافآت والإحالة والضوابط المرتبطة.",
  "admin-catalogue": "إصدارات موثقة للمرجع الداخلي.",
  "admin-catalogue-validation": "التحقق من محرك القواعد ومحاكاته.",
  "admin-catalogue-publications": "سجل محدود وعمليات الرجوع.",
  "admin-cloning": "استنساخ قابل للتتبع مع إثبات المصدر.",
  "admin-questionnaires": "مؤشرات استخدام الاستبيانات.",
  "admin-marketing": "حملات بموافقة وتقويم تحريري.",
  "admin-operations": "الإشعارات والتدقيق وطابور الأحداث.",
  "admin-abuse": "إشارات إساءة الاستخدام والإجراءات المنضبطة.",
  "admin-procurement": "مشتريات متقدمة وخزينة وموردون.",
};

const frAdminGroups: Record<AdminNavGroupId, { title: string; description: string }> = {
  parties: { title: "Clients et partenaires", description: "Parcours, fiches, conformité et gouvernance des parties." },
  finance: { title: "Finance et fiscalité", description: "Paiements, commissions, TVA et volumes." },
  catalogue: { title: "Référentiel et contenu", description: "Catalogue, règles, publications et marketing." },
  operations: { title: "Exploitation et risque", description: "Files techniques et contrôle des abus." },
};

const arAdminGroups: Record<AdminNavGroupId, { title: string; description: string }> = {
  parties: { title: "العملاء والشركاء", description: "المسار والبطاقات والامتثال وحوكمة الأطراف." },
  finance: { title: "المالية والضرائب", description: "المدفوعات والعمولات والضريبة على القيمة المضافة والأحجام." },
  catalogue: { title: "المرجع والمحتوى", description: "الدليل والقواعد والنشر والتسويق." },
  operations: { title: "التشغيل والمخاطر", description: "الطوابير التقنية ومراقبة إساءة الاستخدام." },
};

export const moduleHubCopy = {
  fr: {
    title: "Vos espaces de travail",
    description: "Les espaces Client, Sous-traitant et Franchise utilisent uniquement les rôles de l’entreprise sélectionnée. L’administration plateforme reste séparée.",
    unavailable: "Impossible de charger vos espaces pour le moment. Réessayez sans changer d’organisation.",
    empty: "Aucun espace métier n’est encore associé à ce compte.",
    spaces: { client: "Client — entreprise sélectionnée", provider: "Sous-traitant — entreprise sélectionnée", franchise: "Franchise — entreprise sélectionnée", admin: "Administration plateforme", shared: "Compte et collaboration" },
    links: frLabels,
    admin: {
      featuredEyebrow: "Pilotage",
      featuredTitle: "Centre de pilotage",
      featuredLead: "Traitez d’abord les priorités, exceptions et décisions sensibles — puis ouvrez le module métier adapté.",
      featuredCta: "Ouvrir le centre de pilotage",
      open: "Ouvrir",
      groupsLabel: "Modules par domaine",
      groups: frAdminGroups,
      descriptions: frAdminDescriptions,
    },
  },
  ar: {
    title: "مساحات عملك",
    description: "تستخدم مساحات العميل ومقدم الخدمات والامتياز أدوار المؤسسة المختارة فقط. تبقى إدارة المنصة منفصلة.",
    unavailable: "تعذر تحميل مساحاتك حالياً. حاول مجدداً دون تغيير المؤسسة.",
    empty: "لا توجد مساحة مهنية مرتبطة بهذا الحساب بعد.",
    spaces: { client: "العميل — المؤسسة المختارة", provider: "مقدم الخدمات — المؤسسة المختارة", franchise: "الامتياز — المؤسسة المختارة", admin: "إدارة المنصة", shared: "الحساب والتعاون" },
    links: arLabels,
    admin: {
      featuredEyebrow: "القيادة",
      featuredTitle: "مركز القيادة",
      featuredLead: "عالج أولاً الأولويات والاستثناءات والقرارات الحساسة، ثم افتح الوحدة المهنية المناسبة.",
      featuredCta: "فتح مركز القيادة",
      open: "فتح",
      groupsLabel: "الوحدات حسب المجال",
      groups: arAdminGroups,
      descriptions: arAdminDescriptions,
    },
  },
} as const;

export const dashboardHomeCopy = {
  fr: {
    eyebrow: "Espace sécurisé",
    title: "Bonjour, que devez-vous faire maintenant ?",
    intro: "Suivi dynamique de vos priorités, diagrammes colorés et accès rapide aux outils de votre rôle.",
    trackingTitle: "Suivi dynamique",
    trackingDescription: "Compteurs calculés à partir des actions, messages et approbations réellement autorisés pour votre session.",
    scoreTitle: "Score de suivi",
    scoreHint: "Plus le score est élevé, moins la file contient d’urgences ou d’échéances dépassées.",
    priorityTitle: "Répartition par priorité",
    kindTitle: "Nature des actions",
    emptyChart: "Aucune donnée à visualiser pour le moment.",
    kpiCritical: "Critiques",
    kpiOverdue: "Échéances dépassées",
    kpiToday: "Échéances du jour",
    kpiReview: "Revues humaines",
    kpiTotal: "Actions ouvertes",
    kpiMandatory: "Obligatoires",
    feedTitle: "File à traiter",
    feedEmpty: "Rien d’urgent pour l’instant. Votre file est à jour.",
    feedError: "Le suivi dynamique est indisponible. Les espaces restent accessibles.",
    feedCta: "Ouvrir le centre d’actions",
    kindLabel: {
      NOTIFICATION: "Notification",
      MESSAGE: "Message",
      APPROVAL: "Approbation",
      EXCEPTION: "Exception",
      RISK_REVIEW: "Revue de risque",
      WORK_ITEM: "Action",
    },
    dueLabel: "Échéance",
    openItem: "Ouvrir",
    organizationsTitle: "Entreprise active",
    organizationsDescription: "Choisissez-la par son nom. L’adresse transmise est vérifiée contre vos adhésions actives; chaque destination revalide ensuite vos droits.",
    contextRejected: "Cette entreprise n’est pas autorisée pour votre compte. Le premier périmètre valide a été sélectionné.",
    contextLimit: "Cette sélection filtre cet accueil et sa navigation. Les écrans métier restent responsables de leur propre contexte serveur.",
    organizationError: "Impossible de charger les entreprises autorisées.",
    organizationEmpty: "Aucune entreprise active n’est encore associée à votre compte. Les modules plateforme restent disponibles si votre rôle le permet.",
    organizationCta: "Gérer l’organisation",
    selected: "Entreprise sélectionnée",
    select: "Travailler pour",
    accountTitle: "Compte et sécurité",
    signedInAs: "Session ouverte avec",
    sessionsCta: "Vérifier mes sessions",
    signOut: "Se déconnecter",
    signOutError: "La déconnexion n’a pas abouti. Réessayez.",
    language: "العربية",
    modulesTitle: "Espaces et modules",
    priority: { CRITICAL: "Urgent", HIGH: "Prioritaire", MEDIUM: "À prévoir", LOW: "Information" },
    status: { ACTIVE: "Active", TRIAL: "Essai", SUSPENDED: "Suspendue", CLOSED: "Fermée", unknown: "Statut à vérifier" },
  },
  ar: {
    eyebrow: "مساحة آمنة",
    title: "مرحباً، ما الذي يجب إنجازه الآن؟",
    intro: "متابعة ديناميكية لأولوياتك ومخططات ملونة ووصول سريع إلى أدوات دورك.",
    trackingTitle: "متابعة ديناميكية",
    trackingDescription: "عدادات محسوبة من الإجراءات والرسائل والموافقات المصرح بها فعلياً لجلستك.",
    scoreTitle: "درجة المتابعة",
    scoreHint: "كلما ارتفعت الدرجة قلّت الحالات العاجلة أو المواعيد المتجاوزة في القائمة.",
    priorityTitle: "التوزيع حسب الأولوية",
    kindTitle: "طبيعة الإجراءات",
    emptyChart: "لا توجد بيانات للعرض حالياً.",
    kpiCritical: "حرجة",
    kpiOverdue: "مواعيد متجاوزة",
    kpiToday: "مواعيد اليوم",
    kpiReview: "مراجعات بشرية",
    kpiTotal: "إجراءات مفتوحة",
    kpiMandatory: "إلزامية",
    feedTitle: "قائمة المعالجة",
    feedEmpty: "لا يوجد أمر عاجل حالياً. قائمتك محدّثة.",
    feedError: "المتابعة الديناميكية غير متاحة. تبقى المساحات متاحة.",
    feedCta: "فتح مركز الإجراءات",
    kindLabel: {
      NOTIFICATION: "إشعار",
      MESSAGE: "رسالة",
      APPROVAL: "موافقة",
      EXCEPTION: "استثناء",
      RISK_REVIEW: "مراجعة مخاطر",
      WORK_ITEM: "إجراء",
    },
    dueLabel: "الموعد",
    openItem: "فتح",
    organizationsTitle: "المؤسسة النشطة",
    organizationsDescription: "اخترها بالاسم. يتم التحقق من العنوان وفق عضوياتك النشطة، ثم تعيد كل وجهة التحقق من صلاحياتك.",
    contextRejected: "هذه المؤسسة غير مصرح بها لحسابك. تم اختيار أول نطاق صالح.",
    contextLimit: "تقوم هذه الخانة بتصفية صفحة الاستقبال والتنقل فقط. تبقى الشاشات المهنية مسؤولة عن سياقها الآمن.",
    organizationError: "تعذر تحميل المؤسسات المصرح بها.",
    organizationEmpty: "لا توجد مؤسسة نشطة مرتبطة بحسابك بعد. تبقى وحدات المنصة متاحة إذا سمح دورك بذلك.",
    organizationCta: "إدارة المؤسسة",
    selected: "المؤسسة المختارة",
    select: "العمل لصالح",
    accountTitle: "الحساب والأمان",
    signedInAs: "الجلسة مفتوحة بواسطة",
    sessionsCta: "التحقق من جلساتي",
    signOut: "تسجيل الخروج",
    signOutError: "تعذر تسجيل الخروج. حاول مجدداً.",
    language: "Français",
    modulesTitle: "المساحات والوحدات",
    priority: { CRITICAL: "عاجل", HIGH: "أولوية", MEDIUM: "للتخطيط", LOW: "معلومة" },
    status: { ACTIVE: "نشطة", TRIAL: "تجريبية", SUSPENDED: "موقوفة", CLOSED: "مغلقة", unknown: "الحالة تحتاج إلى تحقق" },
  },
} as const satisfies Record<Locale, Record<string, unknown>>;
