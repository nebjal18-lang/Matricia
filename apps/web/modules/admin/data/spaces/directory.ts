import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { adminActorLinks, adminParcoursLinks } from "./admin-nav";

export type AdminDirectoryTone = "violet" | "peach" | "mint" | "amber" | "sky" | "plum";

export type AdminDirectoryLink = {
  href: string;
  label: string;
  summary: string;
};

export type AdminDirectoryGroup = {
  id: "actors" | "parcours" | "catalog" | "finance" | "growth" | "ops";
  title: string;
  tone: AdminDirectoryTone;
  links: AdminDirectoryLink[];
};

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

function link(href: string, label: string, summary: string): AdminDirectoryLink {
  return { href, label, summary };
}

export function adminDirectoryGroups(locale: Locale, q: string): AdminDirectoryGroup[] {
  const p = `/${locale}`;
  const fr = locale === "fr";
  return [
    {
      id: "actors",
      title: fr ? "Acteurs & accès" : "الفاعلون والوصول",
      tone: "violet",
      links: [
        ...adminActorLinks(locale, q).map(({ href, label, summary }) => ({ href, label, summary })),
        link(
          `${p}/administration/fusion-organisations${q}`,
          fr ? "Fusion contrôlée des organisations" : "دمج المؤسسات الخاضع للضوابط",
          t(locale, "Fusionner deux passeports avec preuve et décision indépendante.", "دمج جوازين بقرار مستقل وإثبات موثّق."),
        ),
      ],
    },
    {
      id: "parcours",
      title: fr ? "Parcours & dossiers" : "المسارات والملفات",
      tone: "peach",
      links: adminParcoursLinks(locale, q).map(({ href, label, summary }) => ({ href, label, summary })),
    },
    {
      id: "catalog",
      title: fr ? "Catalogue & moteurs" : "الدليل والمحركات",
      tone: "mint",
      links: [
        link(`${p}/administration/catalogue${q}#domaines`, fr ? "Domaines, catégories & services" : "المجالات والفئات والخدمات", t(locale, "Structurer le référentiel interne domaines → services.", "هيكلة المرجع الداخلي من المجالات إلى الخدمات.")),
        link(`${p}/administration/catalogue${q}#questions`, fr ? "Questions" : "الأسئلة", t(locale, "Administrer la bibliothèque de questions versionnées.", "إدارة مكتبة الأسئلة ذات الإصدارات.")),
        link(`${p}/administration/catalogue${q}#questionnaires`, fr ? "Questionnaires" : "الاستبيانات", t(locale, "Composer et versionner les questionnaires métier.", "تركيب وإصدار الاستبيانات المهنية.")),
        link(`${p}/administration/catalogue/validation${q}#regles`, fr ? "Règles conditionnelles" : "قواعد شرطية", t(locale, "Éditer la logique conditionnelle et de scoring.", "تحرير المنطق الشرطي واحتساب الدرجات.")),
        link(`${p}/administration/catalogue/validation${q}#simulation`, fr ? "Simulations sandbox" : "محاكاة الصندوق الرملي", t(locale, "Simuler questionnaires et règles sans effet production.", "محاكاة الاستبيانات والقواعد دون أثر إنتاجي.")),
        link(`${p}/administration/catalogue/publications${q}`, fr ? "Publications & versions" : "المنشورات والنسخ", t(locale, "Publier et historiser les versions catalogue.", "نشر ونسخ سجل الدليل.")),
        link(`${p}/administration/clonage${q}`, fr ? "Clonage & provenance" : "الاستنساخ والمصدر", t(locale, "Cloner des artefacts en conservant la provenance.", "استنساخ العناصر مع حفظ المصدر.")),
        link(`${p}/administration/catalogue/revues${q}`, fr ? "Revue éditoriale centrale" : "المراجعة التحريرية المركزية", t(locale, "Approuver le contenu catalogue avant publication.", "اعتماد محتوى الدليل قبل النشر.")),
        link(`${p}/administration/catalogue/questionnaires/revues${q}`, fr ? "Revue centrale des questionnaires" : "المراجعة المركزية للاستبيانات", t(locale, "Revue indépendante des questionnaires avant activation.", "مراجعة مستقلة للاستبيانات قبل التفعيل.")),
        link(`${p}/administration/catalogue/validation${q}#revue`, fr ? "Suggestions IA & revue humaine" : "اقتراحات الذكاء ومراجعة بشرية", t(locale, "Contrôler les suggestions IA par revue humaine.", "ضبط اقتراحات الذكاء بمراجعة بشرية.")),
        link(`${p}/administration/fiscalite-maroc${q}`, fr ? "Fiscalité Maroc" : "الضرائب المغربية", t(locale, "Administrer le moteur fiscal marocain versionné.", "إدارة محرك الضريبة المغربية بإصدارات.")),
        link(`${p}/administration/questionnaires/analytique${q}`, fr ? "Benchmarks anonymisés" : "مراجع مجهولة", t(locale, "Consulter les benchmarks anonymisés des réponses.", "عرض المراجع المجهولة للإجابات.")),
      ],
    },
    {
      id: "finance",
      title: fr ? "Finance & monétisation" : "المالية والتسييل",
      tone: "amber",
      links: [
        link(`${p}/administration/finance${q}#plans`, fr ? "Plans, boxes & abonnements" : "الخطط والصناديق والاشتراكات", t(locale, "Piloter plans commerciaux, boxes et abonnements.", "قيادة الخطط والصناديق والاشتراكات.")),
        link(`${p}/administration/finance${q}#boxes`, fr ? "Boxes" : "الصناديق", t(locale, "Configurer les boxes et leurs droits d’accès.", "إعداد الصناديق وحقوق الوصول.")),
        link(`${p}/administration/avantages/livraisons${q}`, fr ? "Exécution et preuves des avantages" : "تنفيذ المزايا وأدلتها", t(locale, "Suivre livraisons d’avantages et preuves associées.", "متابعة تسليم المزايا وأدلتها.")),
        link(`${p}/administration/avantages/regles${q}`, fr ? "Admission, quotas et capacités des avantages" : "أهلية المزايا وحصصها وقدراتها", t(locale, "Définir éligibilité, quotas et capacités des avantages.", "تحديد أهلية المزايا وحصصها وقدراتها.")),
        link(`${p}/administration/finance${q}#credits`, fr ? "Crédits & ledger" : "الأرصدة والدفتر", t(locale, "Consulter le ledger immuable des crédits.", "عرض دفتر الأرصدة غير القابل للتعديل.")),
        link(`${p}/administration/politiques-contrats${q}`, fr ? "Clauses contractuelles & commissions" : "بنود العقود والعمولات", t(locale, "Versionner clauses et barèmes de commission.", "إصدار البنود وجداول العمولات.")),
        link(`${p}/administration/classification-fiscale${q}`, fr ? "Classification fiscale des services" : "التصنيف الضريبي للخدمات", t(locale, "Classer fiscalement chaque service du catalogue.", "تصنيف كل خدمة ضريبياً في الدليل.")),
        link(`${p}/administration/facturation-clients${q}`, fr ? "Factures Client & registre fiscal" : "فواتير العملاء والسجل الضريبي", t(locale, "Émettre et contrôler factures Client et TVA.", "إصدار ومراقبة فواتير العملاء والضريبة.")),
        link(`${p}/administration/finance${q}`, fr ? "Paiements & factures" : "المدفوعات والفواتير", t(locale, "Superviser paiements, captures et facturation.", "الإشراف على المدفوعات والفوترة.")),
        link(`${p}/administration/finance/prestataires${q}`, fr ? "Factures prestataires" : "فواتير مقدمي الخدمات", t(locale, "Suivre factures et règlements prestataires.", "متابعة فواتير وتسويات مقدمي الخدمات.")),
        link(`${p}/administration/approbations-finance${q}#rapprochements`, fr ? "Rapprochements & commissions" : "المطابقات والعمولات", t(locale, "Rapprocher flux financiers et commissions dues.", "مطابقة التدفقات المالية والعمولات.")),
        link(`${p}/administration/approbations-finance${q}#commissions`, fr ? "Commissions" : "العمولات", t(locale, "Calculer et approuver les commissions versionnées.", "احتساب واعتماد العمولات ذات الإصدارات.")),
        link(`${p}/administration/finance${q}#centres-couts`, fr ? "Centres de coûts" : "مراكز التكلفة", t(locale, "Affecter charges et coûts aux centres versionnés.", "تخصيص التكاليف لمراكز الإصدارات.")),
        link(`${p}/administration/achats-groupes${q}`, fr ? "Achats groupés" : "مشتريات مجمّعة", t(locale, "Piloter pools d’achat et allocations fournisseurs.", "قيادة مجمعات الشراء وتوزيع الموردين.")),
        link(`${p}/administration/incitations${q}`, fr ? "ROI & économies" : "العائد والوفورات", t(locale, "Mesurer ROI, économies et effets des incitations.", "قياس العائد والوفورات وأثر الحوافز.")),
        link(`${p}/administration/approbations-finance${q}`, fr ? "Approbations finance" : "مصادقات المالية", t(locale, "Double validation des opérations financières sensibles.", "التحقق المزدوج للعمليات المالية الحساسة.")),
      ],
    },
    {
      id: "growth",
      title: fr ? "Pilotage & croissance" : "القيادة والنمو",
      tone: "sky",
      links: [
        link(`${p}/administration/command-center${q}#command-today`, fr ? "Centre de commandement" : "مركز القيادة", t(locale, "Prioriser files SLA et actions humaines du jour.", "ترتيب طوابير SLA والإجراءات البشرية لليوم.")),
        link(`${p}/administration/marketing-autopilot${q}#gouvernance`, fr ? "Marketing Autopilot" : "التسويق الآلي", t(locale, "Orchestrer campagnes avec consentement et gouvernance.", "تنسيق الحملات بالموافقة والحوكمة.")),
        link(`${p}/administration/marketing-autopilot${q}#calendrier`, fr ? "Calendrier éditorial" : "التقويم التحريري", t(locale, "Planifier et valider le calendrier de contenus.", "تخطيط واعتماد تقويم المحتوى.")),
        link(`${p}/administration/marketing-autopilot${q}#connexions`, fr ? "Connexions sociales" : "الارتباطات الاجتماعية", t(locale, "Gérer les connexions aux canaux sociaux.", "إدارة ارتباطات القنوات الاجتماعية.")),
        link(`${p}/administration/catalogue/publications${q}`, fr ? "Publications & validation" : "المنشورات والمصادقة", t(locale, "Valider publications marketing et catalogue.", "اعتماد منشورات التسويق والدليل.")),
        link(`${p}/administration/marketing-autopilot${q}#attribution`, fr ? "Attribution CTA" : "إسناد الدعوة", t(locale, "Attribuer performances aux CTA et campagnes.", "إسناد الأداء إلى الدعوات والحملات.")),
        link(`${p}/administration/questionnaires/analytique${q}`, fr ? "Analytics & rapports" : "تحليلات وتقارير", t(locale, "Lire analytics anonymisées et rapports agrégés.", "قراءة التحليلات المجهولة والتقارير المجمّعة.")),
        link(`${p}/administration/incitations${q}`, fr ? "Incitations & récompenses" : "الحوافز والمكافآت", t(locale, "Configurer programmes d’incitation et récompenses.", "إعداد برامج الحوافز والمكافآت.")),
      ],
    },
    {
      id: "ops",
      title: fr ? "Opérations, sécurité & configuration" : "التشغيل والأمن والإعداد",
      tone: "plum",
      links: [
        link(`${p}/administration/configuration${q}`, fr ? "Configuration initiale & connexions" : "الإعداد الأولي والاتصالات", t(locale, "Configurer connexions plateforme et paramètres de base.", "إعداد ارتباطات المنصة والمعاملات الأساسية.")),
        link(`${p}/administration/preparation${q}`, fr ? "Préparation de la livraison" : "إعداد التسليم", t(locale, "Préparer checklists et livraisons contrôlées.", "تحضير قوائم التحقق والتسليمات المضبوطة.")),
        link(`${p}/administration/operations${q}#operations-summary`, fr ? "Opérations & files de traitement" : "التشغيل وطوابير المعالجة", t(locale, "Surveiller files opérationnelles et traitements.", "مراقبة طوابير التشغيل والمعالجات.")),
        link(`${p}/administration/operations${q}#outbox`, fr ? "Event Outbox & workers" : "صندوق الأحداث والعاملون", t(locale, "Contrôler outbox d’événements et workers.", "مراقبة صندوق الأحداث والعاملين.")),
        link(`${p}/administration/operations${q}#webhooks`, fr ? "Webhooks & intégrations" : "الويب هوك والتكاملات", t(locale, "Superviser webhooks et intégrations externes.", "الإشراف على الويب هوك والتكاملات الخارجية.")),
        link(`${p}/administration/signatures${q}`, fr ? "Signatures et politiques" : "التوقيعات والسياسات", t(locale, "Administrer politiques et enveloppes de signature.", "إدارة سياسات وأغلفة التوقيع.")),
        link(`${p}/administration/notifications/modeles${q}`, fr ? "Modèles de notifications FR/AR" : "قوالب الإشعارات بالفرنسية والعربية", t(locale, "Éditer et approuver modèles FR/AR avant envoi.", "تحرير واعتماد قوالب FR/AR قبل الإرسال.")),
        link(`${p}/administration/confidentialite${q}`, fr ? "Protection des données & rétention" : "حماية البيانات والاحتفاظ", t(locale, "Appliquer rétention et protection des données.", "تطبيق الاحتفاظ وحماية البيانات.")),
        link(`${p}/administration/confidentialite/inventaire${q}`, fr ? "Inventaire personnel et réponse exhaustive" : "جرد البيانات الشخصية والاستجابة الشاملة", t(locale, "Inventorier données perso et préparer réponses DSR.", "جرد البيانات الشخصية وإعداد ردود الطلبات.")),
        link(`${p}/administration/confidentialite/restrictions${q}`, fr ? "Restrictions de traitement effectives" : "قيود المعالجة الفعلية", t(locale, "Activer et suivre les restrictions de traitement.", "تفعيل ومتابعة قيود المعالجة.")),
        link(`${p}/administration/confidentialite/remise${q}`, fr ? "Périmètre DSR & remise privée" : "نطاق طلبات البيانات والتسليم الخاص", t(locale, "Délimiter et remettre les exports DSR privés.", "تحديد وتسليم صادرات طلبات البيانات الخاصة.")),
        link(`${p}/administration/anti-abus${q}`, fr ? "Anti-abus" : "مكافحة الإساءة", t(locale, "Détecter et traiter les abus plateforme.", "اكتشاف ومعالجة إساءات المنصة.")),
        link(`${p}/administration/operations${q}#latest-audit-events`, fr ? "Audit & traçabilité" : "التدقيق والتتبع", t(locale, "Lire le journal d’audit des actions sensibles.", "قراءة سجل تدقيق الإجراءات الحساسة.")),
        link(`${p}/securite/sessions${q}${q.includes("?") ? "&" : "?"}workspace=administration`, fr ? "Sessions & sécurité" : "الجلسات والأمن", t(locale, "Contrôler sessions actives et sécurité compte.", "مراقبة الجلسات النشطة وأمن الحساب.")),
        link(`${p}/administration/anti-abus${q}#rls`, fr ? "RLS & contrôle des accès" : "الصفوف والتحكم في الوصول", t(locale, "Vérifier isolation RLS et contrôles d’accès.", "التحقق من عزل الصفوف وضوابط الوصول.")),
        link(`${p}/administration/operations${q}#privacy-file-scans`, fr ? "Stockage & antivirus" : "التخزين ومضاد الفيروسات", t(locale, "Surveiller stockage fichiers et scans antivirus.", "مراقبة تخزين الملفات وفحوصات مضاد الفيروسات.")),
        link(`${p}/administration/operations${q}#sante`, fr ? "Santé des services" : "صحة الخدمات", t(locale, "Contrôler la santé des services critiques.", "مراقبة صحة الخدمات الحرجة.")),
        link(`${p}/administration/configuration${q}`, fr ? "Paramètres plateforme" : "إعدادات المنصة", t(locale, "Ajuster les paramètres globaux de la plateforme.", "ضبط إعدادات المنصة العامة.")),
        link(`${p}/administration/operations${q}#archives`, fr ? "Archives & restauration" : "الأرشيف والاستعادة", t(locale, "Archiver et restaurer sous politique de conservation.", "الأرشفة والاستعادة وفق سياسة الاحتفاظ.")),
      ],
    },
  ];
}

export function adminDirectoryGroup(locale: Locale, q: string, id: AdminDirectoryGroup["id"]) {
  return adminDirectoryGroups(locale, q).find((group) => group.id === id) ?? null;
}

export const ORG_TYPE_CODES = ["CLIENT", "PROVIDER", "FRANCHISE", "INTERNAL"] as const;
export type OrgTypeCode = (typeof ORG_TYPE_CODES)[number];
export const ORG_TYPE_NONE = "NONE";

export function normalizeOrgTypeCodes(roleCodes: readonly string[] = []): OrgTypeCode[] {
  const labels = new Set<string>(ORG_TYPE_CODES);
  return [...new Set(roleCodes.map((code) => (code.split("_")[0] ?? code).toUpperCase()))].filter((code): code is OrgTypeCode => labels.has(code));
}

export function orgTypeFilterCodes(roleCodes: readonly string[] = []): string[] {
  const codes = normalizeOrgTypeCodes(roleCodes);
  return codes.length ? codes : [ORG_TYPE_NONE];
}

export function inferOrgType(name: string, locale: Locale, roleCodes: readonly string[] = []) {
  void name;
  const labels: Record<string, string> = locale === "ar"
    ? { CLIENT: "عميل", PROVIDER: "مقدّم خدمات", FRANCHISE: "امتياز", INTERNAL: "داخلي", NONE: "غير محدد" }
    : { CLIENT: "Client", PROVIDER: "Prestataire", FRANCHISE: "Franchisé", INTERNAL: "Interne", NONE: "Non renseigné" };
  const roles = normalizeOrgTypeCodes(roleCodes);
  return roles.length ? roles.map((code) => labels[code]!).join(" · ") : labels.NONE!;
}

export function orgTypeOptionLabel(code: string, locale: Locale) {
  return inferOrgType("", locale, code === ORG_TYPE_NONE ? [] : [code]);
}
