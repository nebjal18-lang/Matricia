import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { adminActorLinks, adminParcoursLinks } from "./admin-nav";

export type AdminDirectoryTone = "violet" | "peach" | "mint" | "amber" | "sky" | "plum";

export type AdminDirectoryGroup = {
  id: "actors" | "parcours" | "catalog" | "finance" | "growth" | "ops";
  title: string;
  tone: AdminDirectoryTone;
  links: Array<{ href: string; label: string }>;
};

export function adminDirectoryGroups(locale: Locale, q: string): AdminDirectoryGroup[] {
  const p = `/${locale}`;
  const fr = locale === "fr";
  return [
    {
      id: "actors",
      title: fr ? "Acteurs & accès" : "الفاعلون والوصول",
      tone: "violet",
      links: [...adminActorLinks(locale, q).map(({ href, label }) => ({ href, label })), {href: `${p}/administration/fusion-organisations${q}`, label: fr ? "Fusion contrôlée des organisations" : "دمج المؤسسات الخاضع للضوابط"}],
    },
    {
      id: "parcours",
      title: fr ? "Parcours & dossiers" : "المسارات والملفات",
      tone: "peach",
      links: adminParcoursLinks(locale, q).map(({ href, label }) => ({ href, label })),
    },
    {
      id: "catalog",
      title: fr ? "Catalogue & moteurs" : "الدليل والمحركات",
      tone: "mint",
      links: [
        { href: `${p}/administration/catalogue${q}#domaines`, label: fr ? "Domaines, catégories & services" : "المجالات والفئات والخدمات" },
        { href: `${p}/administration/catalogue${q}#questions`, label: fr ? "Questions" : "الأسئلة" },
        { href: `${p}/administration/catalogue${q}#questionnaires`, label: fr ? "Questionnaires" : "الاستبيانات" },
        { href: `${p}/administration/catalogue/validation${q}#regles`, label: fr ? "Règles conditionnelles" : "قواعد شرطية" },
        { href: `${p}/administration/catalogue/validation${q}#simulation`, label: fr ? "Simulations sandbox" : "محاكاة الصندوق الرملي" },
        { href: `${p}/administration/catalogue/publications${q}`, label: fr ? "Publications & versions" : "المنشورات والنسخ" },
        { href: `${p}/administration/clonage${q}`, label: fr ? "Clonage & provenance" : "الاستنساخ والمصدر" },
        { href: `${p}/administration/catalogue/revues${q}`, label: fr ? "Revue éditoriale centrale" : "المراجعة التحريرية المركزية" },
        { href: `${p}/administration/catalogue/questionnaires/revues${q}`, label: fr ? "Revue centrale des questionnaires" : "المراجعة المركزية للاستبيانات" },
        { href: `${p}/administration/catalogue/validation${q}#revue`, label: fr ? "Suggestions IA & revue humaine" : "اقتراحات الذكاء ومراجعة بشرية" },
        { href: `${p}/administration/fiscalite-maroc${q}`, label: fr ? "Fiscalité Maroc" : "الضرائب المغربية" },
        { href: `${p}/administration/questionnaires/analytique${q}`, label: fr ? "Benchmarks anonymisés" : "مراجع مجهولة" },
      ],
    },
    {
      id: "finance",
      title: fr ? "Finance & monétisation" : "المالية والتسييل",
      tone: "amber",
      links: [
        { href: `${p}/administration/finance${q}#boxes`, label: fr ? "Plans, boxes & abonnements" : "الخطط والصناديق والاشتراكات" },
        { href: `${p}/administration/finance${q}#boxes`, label: fr ? "Boxes" : "الصناديق" },
        { href: `${p}/administration/avantages/livraisons${q}`, label: fr ? "Exécution et preuves des avantages" : "تنفيذ المزايا وأدلتها" },
        { href: `${p}/administration/avantages/regles${q}`, label: fr ? "Admission, quotas et capacités des avantages" : "أهلية المزايا وحصصها وقدراتها" },
        { href: `${p}/administration/finance${q}#credits`, label: fr ? "Crédits & ledger" : "الأرصدة والدفتر" },
        { href: `${p}/administration/politiques-contrats${q}`, label: fr ? "Clauses contractuelles & commissions" : "بنود العقود والعمولات" },
        { href: `${p}/administration/classification-fiscale${q}`, label: fr ? "Classification fiscale des services" : "التصنيف الضريبي للخدمات" },
        { href: `${p}/administration/facturation-clients${q}`, label: fr ? "Factures Client & registre fiscal" : "فواتير العملاء والسجل الضريبي" },
        { href: `${p}/administration/finance${q}`, label: fr ? "Paiements & factures" : "المدفوعات والفواتير" },
        { href: `${p}/administration/providers${q}`, label: fr ? "Factures prestataires" : "فواتير مقدمي الخدمات" },
        { href: `${p}/administration/approbations-finance${q}`, label: fr ? "Rapprochements & commissions" : "المطابقات والعمولات" },
        { href: `${p}/administration/approbations-finance${q}`, label: fr ? "Commissions" : "العمولات" },
        { href: `${p}/administration/finance${q}#centres-couts`, label: fr ? "Centres de coûts" : "مراكز التكلفة" },
        { href: `${p}/administration/achats-groupes${q}`, label: fr ? "Achats groupés" : "مشتريات مجمّعة" },
        { href: `${p}/administration/incitations${q}`, label: fr ? "ROI & économies" : "العائد والوفورات" },
        { href: `${p}/administration/approbations-finance${q}`, label: fr ? "Approbations finance" : "مصادقات المالية" },
      ],
    },
    {
      id: "growth",
      title: fr ? "Pilotage & croissance" : "القيادة والنمو",
      tone: "sky",
      links: [
        { href: `${p}/administration/command-center${q}#command-today`, label: fr ? "Centre de commandement" : "مركز القيادة" },
        { href: `${p}/administration/marketing-autopilot${q}#gouvernance`, label: fr ? "Marketing Autopilot" : "التسويق الآلي" },
        { href: `${p}/administration/marketing-autopilot${q}#calendrier`, label: fr ? "Calendrier éditorial" : "التقويم التحريري" },
        { href: `${p}/administration/marketing-autopilot${q}#connexions`, label: fr ? "Connexions sociales" : "الارتباطات الاجتماعية" },
        { href: `${p}/administration/catalogue/publications${q}`, label: fr ? "Publications & validation" : "المنشورات والمصادقة" },
        { href: `${p}/administration/marketing-autopilot${q}#attribution`, label: fr ? "Attribution CTA" : "إسناد الدعوة" },
        { href: `${p}/administration/questionnaires/analytique${q}`, label: fr ? "Analytics & rapports" : "تحليلات وتقارير" },
        { href: `${p}/administration/incitations${q}`, label: fr ? "Incitations & récompenses" : "الحوافز والمكافآت" },
      ],
    },
    {
      id: "ops",
      title: fr ? "Opérations, sécurité & configuration" : "التشغيل والأمن والإعداد",
      tone: "plum",
      links: [
        { href: `${p}/administration/operations${q}#operations-summary`, label: fr ? "Opérations & files de traitement" : "التشغيل وطوابير المعالجة" },
        { href: `${p}/administration/operations${q}#outbox`, label: fr ? "Event Outbox & workers" : "صندوق الأحداث والعاملون" },
        { href: `${p}/administration/operations${q}#webhooks`, label: fr ? "Webhooks & intégrations" : "الويب هوك والتكاملات" },
        { href: `${p}/administration/signatures${q}`, label: fr ? "Signatures et politiques" : "التوقيعات والسياسات" },
        { href: `${p}/administration/notifications/modeles${q}`, label: fr ? "Modèles de notifications FR/AR" : "قوالب الإشعارات بالفرنسية والعربية" },
        { href: `${p}/administration/confidentialite${q}`, label: fr ? "Protection des données & rétention" : "حماية البيانات والاحتفاظ" },
        { href: `${p}/administration/confidentialite/inventaire${q}`, label: fr ? "Inventaire personnel et réponse exhaustive" : "جرد البيانات الشخصية والاستجابة الشاملة" },
        { href: `${p}/administration/confidentialite/restrictions${q}`, label: fr ? "Restrictions de traitement effectives" : "قيود المعالجة الفعلية" },
        { href: `${p}/administration/confidentialite/remise${q}`, label: fr ? "Périmètre DSR & remise privée" : "نطاق طلبات البيانات والتسليم الخاص" },
        { href: `${p}/administration/anti-abus${q}`, label: fr ? "Anti-abus" : "مكافحة الإساءة" },
        { href: `${p}/administration/operations${q}#latest-audit-events`, label: fr ? "Audit & traçabilité" : "التدقيق والتتبع" },
        { href: `${p}/securite/sessions${q}`, label: fr ? "Sessions & sécurité" : "الجلسات والأمن" },
        { href: `${p}/administration/anti-abus${q}`, label: fr ? "RLS & contrôle des accès" : "الصفوف والتحكم في الوصول" },
        { href: `${p}/administration/operations${q}#stockage`, label: fr ? "Stockage & antivirus" : "التخزين ومضاد الفيروسات" },
        { href: `${p}/administration/operations${q}#sante`, label: fr ? "Santé des services" : "صحة الخدمات" },
        { href: `${p}/administration/operations${q}#parametres`, label: fr ? "Paramètres plateforme" : "إعدادات المنصة" },
        { href: `${p}/administration/operations${q}#archives`, label: fr ? "Archives & restauration" : "الأرشيف والاستعادة" },
      ],
    },
  ];
}

export function adminDirectoryGroup(locale: Locale, q: string, id: AdminDirectoryGroup["id"]) {
  return adminDirectoryGroups(locale, q).find((group) => group.id === id) ?? null;
}

export function inferOrgType(name: string, locale: Locale, roleCodes: readonly string[] = []) {
  void name;
  const labels: Record<string, string> = locale === "ar"
    ? { CLIENT: "عميل", PROVIDER: "مقدّم خدمات", FRANCHISE: "امتياز", INTERNAL: "داخلي" }
    : { CLIENT: "Client", PROVIDER: "Prestataire", FRANCHISE: "Franchisé", INTERNAL: "Interne" };
  const roles = [...new Set(roleCodes.map((code) => code.split("_")[0] ?? code))].filter((code) => labels[code]);
  return roles.length ? roles.map((code) => labels[code]).join(" · ") : locale === "ar" ? "غير محدد" : "Non renseigné";
}
