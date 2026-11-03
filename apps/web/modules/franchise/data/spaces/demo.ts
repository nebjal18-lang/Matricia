import type { FranchiseSupervisionMetrics } from "./metrics";
import type { ProviderDossier } from "../network/provider-dossier";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export function canApplyFranchiseSpaceDemo() {
  return false;
}

export type Tone = "mint" | "peach" | "violet" | "sky";
export type FolderActivity = { id: string; type: string; occurredAt: string; summary: string; evidence: string[] };
export type FolderEvent = { id: string; from: string | null; to: string; reasonCode: string; occurredAt: string; evidence: string[] };
export type MatchingRow = { id: string; name: string; status: string; href: string; tone: Tone };
export type PersonRow = { id: string; linkedOrganizationId?:string|null;createdAt?:string;dossier?:ProviderDossier; name: string; services: string; status: string; next: string; tone: Tone; stage: string; email?: string; source?: string; rowVersion?: number; nextFollowupAt?: string | null; activities?: FolderActivity[]; pipelineEvents?: FolderEvent[] };
export type RequestRow = { id: string; title: string; stage: string; owner: string; flag: string; tone: Tone; stageCode?: string; email?: string; source?: string; rowVersion?: number; nextFollowupAt?: string | null; activities?: FolderActivity[]; pipelineEvents?: FolderEvent[]; matching?: MatchingRow[] };
export type DocumentRow = { id: string; title: string; owner: string; status: string; href: string; kind: "evidence" | "renewal"; due?: string };
export type MessageRow = { id: string; title: string; meta: string; href: string; tone: Tone };
export type NoticeRow = { id: string; title: string; meta: string; href: string };
export type SupervisionRow = { id: string; title: string; status: string; meta?: string; href: string; tone?: Tone; rowVersion?: number };
export type QualityRow = { id: string; title: string; type: string; status: string; next: string; tone: Tone; href?: string };
export type FinanceKind = "statement" | "entryFee" | "payout" | "preStatement";
export type FinanceRow = { id: string; title: string; object: string; status: string; auth: string; tone: Tone; amount?: string; kind?: FinanceKind;href?:string };

export function demoFranchiseSpaces(locale: Locale, query: string) {
  const fr = locale === "fr";
  const q = query;
  return {
    treat: [
      { id: "t1", title: fr ? "Examiner un dossier" : "مراجعة ملف", detail: fr ? "Un nouveau dossier attend votre analyse." : "ملف جديد ينتظر تحليللكم.", href: `/${locale}/franchise/demandes${q}`, tone: "sky" as const },
      { id: "t2", title: fr ? "Relancer un professionnel" : "متابعة مهني", detail: fr ? "Une relance est à effectuer prochainement." : "متابعة مطلوبة قريباً.", href: `/${locale}/franchise/relances${q}`, tone: "peach" as const },
      { id: "t3", title: fr ? "Répondre à une alerte qualité" : "الرد على تنبيه جودة", detail: fr ? "Une alerte nécessite votre retour." : "تنبيه يحتاج ردكم.", href: `/${locale}/franchise/qualite${q}`, tone: "mint" as const },
      { id: "t4", title: fr ? "Préparer le résumé opérationnel" : "تحضير الملخص التشغيلي", detail: fr ? "Les éléments du périmètre sont à consolider." : "عناصر النطاق تحتاج تجميعاً.", href: `/${locale}/franchise/accueil${q}`, tone: "violet" as const },
    ],
    pipeline: [
      { id: "p1", title: fr ? "Réseau" : "الشبكة", detail: fr ? "Professionnels de votre périmètre" : "مهنيو نطاقكم", status: fr ? "Actif" : "نشط", tone: "mint" as const },
      { id: "p2", title: fr ? "Demandes" : "الطلبات", detail: fr ? "Dossiers en cours de traitement" : "ملفات قيد المعالجة", status: fr ? "En instruction" : "قيد الدراسة", tone: "sky" as const },
      { id: "p3", title: fr ? "Missions" : "المهام", detail: fr ? "Missions autorisées et en suivi" : "مهام مصرّح بها ومتابَعة", status: fr ? "En réalisation" : "قيد الإنجاز", tone: "violet" as const },
      { id: "p4", title: fr ? "Qualité" : "الجودة", detail: fr ? "Contrôles et conformité" : "رقابة وامتثال", status: fr ? "Sous vigilance" : "تحت اليقظة", tone: "peach" as const },
      { id: "p5", title: fr ? "Performance" : "الأداء", detail: fr ? "Pilotage et développement" : "قيادة وتطوير", status: fr ? "En suivi" : "قيد المتابعة", tone: "mint" as const },
    ],
    attention: [
      { id: "a1", title: fr ? "Conformité à vérifier" : "امتثال للمراجعة", href: `/${locale}/franchise/qualite${q}` },
      { id: "a2", title: fr ? "Dossier en attente" : "ملف قيد الانتظار", href: `/${locale}/franchise/demandes${q}` },
      { id: "a3", title: fr ? "Relance à effectuer" : "متابعة مطلوبة", href: `/${locale}/franchise/relances${q}` },
      { id: "a4", title: fr ? "Élément de gouvernance" : "عنصر حوكمة", href: `/${locale}/franchise/gouvernance${q}` },
    ],
    homeRequests: [
      { id: "hr1", title: fr ? "Nouvelle demande" : "طلب جديد", detail: fr ? "Un dossier vient d’arriver à examiner." : "وصل ملف للمراجعة." },
      { id: "hr2", title: fr ? "Information complémentaire" : "معلومة تكميلية", detail: fr ? "Des éléments sont attendus." : "عناصر منتظرة." },
      { id: "hr3", title: fr ? "Dossier à finaliser" : "ملف للإنهاء", detail: fr ? "Une vérification est nécessaire." : "تحقق مطلوب." },
    ],
    homePros: [
      { id: "hp1", title: fr ? "Prise de contact" : "تواصل أولي", detail: fr ? "Un professionnel attend un retour." : "مهني ينتظر رداً." },
      { id: "hp2", title: fr ? "Suivi d’activité" : "متابعة النشاط", detail: fr ? "Un point d’activité à planifier." : "نقطة نشاط للجدولة." },
      { id: "hp3", title: fr ? "Accompagnement qualité" : "مواكبة جودة", detail: fr ? "Un appui est recommandé." : "دعم موصى به." },
    ],
    homeGov: [
      { id: "hg1", title: fr ? "Document à consulter" : "مستند للاطلاع", detail: fr ? "Un document est mis à disposition." : "مستند متاح." },
      { id: "hg2", title: fr ? "Validation à préparer" : "مصادقة للتحضير", detail: fr ? "Une action est à planifier." : "إجراء للجدولة." },
      { id: "hg3", title: fr ? "Réunion à organiser" : "اجتماع للتنظيم", detail: fr ? "Une réunion est à planifier." : "اجتماع للجدولة." },
    ],
    perimeter: {
      territory: fr ? "Casablanca-Settat" : "الدار البيضاء-سطات",
      domains: fr ? "Conseil, communication, organisation" : "استشارة، تواصل، تنظيم",
      mandate: fr ? "Mandat territorial 2026" : "تفويض ترابي 2026",
      status: fr ? "Actif" : "نشط",
    },
    canDo: [
      fr ? "Déployer les offres et supports autorisés" : "نشر العروض والدعائم المصرّح بها",
      fr ? "Accompagner les équipes de votre périmètre" : "مواكبة فرق نطاقكم",
      fr ? "Signer les documents de votre périmètre" : "توقيع وثائق نطاقكم",
      fr ? "Challenger et valider les initiatives locales" : "مناقشة المبادرات المحلية والمصادقة عليها",
      fr ? "Solliciter un accompagnement auprès des équipes siège" : "طلب مواكبة من فرق المقر",
      fr ? "Suivre la mise en œuvre des actions" : "متابعة تنفيذ الإجراءات",
    ],
    needsValidation: [
      fr ? "Toute extension de périmètre" : "أي توسيع للنطاق",
      fr ? "Le lancement de nouvelles offres" : "إطلاق عروض جديدة",
      fr ? "Les partenariats stratégiques" : "الشراكات الاستراتيجية",
      fr ? "Les actions de communication d’envergure" : "أعمال التواصل واسعة النطاق",
      fr ? "Les demandes impliquant d’autres périmètres" : "الطلبات التي تمس نطاقاً آخر",
      fr ? "Tout engagement inhabituel ou à fort impact" : "أي التزام غير معتاد أو عالي الأثر",
    ],
    rights: [
      { id: "r1", title: fr ? "Accès aux ressources" : "الوصول إلى الموارد", detail: fr ? "Supports et dossiers du périmètre Casablanca-Settat" : "دعائم وملفات نطاق الدار البيضاء-سطات" },
      { id: "r2", title: fr ? "Actions autorisées" : "إجراءات مصرّح بها", detail: fr ? "Accompagnement, relance et orientation locale" : "مواكبة ومتابعة وتوجيه محلي" },
      { id: "r3", title: fr ? "Validation de documents" : "المصادقة على الوثائق", detail: fr ? "Pièces du périmètre uniquement" : "وثائق النطاق فقط" },
      { id: "r4", title: fr ? "Gestion des équipes" : "إدارة الفرق", detail: fr ? "Professionnels rattachés à votre mandat" : "المهنيون المرتبطون بتفويضكم" },
    ],
    periHistory: [
      { id: "ph1", title: fr ? "Mise à jour du mandat" : "تحديث التفويض", detail: fr ? "Version 2026 activée" : "نسخة 2026 مفعّلة" },
      { id: "ph2", title: fr ? "Ajout d’un domaine autorisé" : "إضافة مجال مصرّح", detail: fr ? "Organisation ajoutée au mandat" : "أُضيف التنظيم إلى التفويض" },
      { id: "ph3", title: fr ? "Modification des droits d’accès" : "تعديل حقوق الوصول", detail: fr ? "Accès documents restreint au périmètre" : "الوصول للوثائق محصور بالنطاق" },
      { id: "ph4", title: fr ? "Validation d’une action" : "المصادقة على إجراء", detail: fr ? "Relance qualité validée" : "صودق على متابعة الجودة" },
    ],
    metrics:null as FranchiseSupervisionMetrics|null,
    unavailableSections:[] as string[],
    providerDossiers: [] as ProviderDossier[],
    canWrite: false,
    people: [
      { id: "pr1", name: fr ? "Studio Atlas" : "ستوديو أطلس", services: fr ? "Identité et supports" : "هوية ودعائم", status: fr ? "Qualifié" : "مؤهل", next: fr ? "Suivi trimestriel" : "متابعة فصلية", tone: "mint" as const, stage: "VERIFIED", email: "atlas@example.invalid", source: "NETWORK", nextFollowupAt: "2026-12-01T00:00:00.000Z", activities: [{ id: "pa1", type: "INVITATION", occurredAt: "2026-09-10T10:00:00.000Z", summary: fr ? "Invitation envoyée au professionnel." : "أُرسلت الدعوة للمهني.", evidence: ["invite://atlas"] }], pipelineEvents: [{ id: "pe1", from: "SENT", to: "VERIFIED", reasonCode: "ELIGIBILITY_CONFIRMED", occurredAt: "2026-09-12T10:00:00.000Z", evidence: [] }] },
      { id: "pr2", name: fr ? "Conseil Anfa" : "استشارة أنفا", services: fr ? "Organisation et process" : "تنظيم ومساطر", status: fr ? "À accompagner" : "للمواكبة", next: fr ? "Prise de contact" : "تواصل أولي", tone: "peach" as const, stage: "SENT", email: "anfa@example.invalid", source: "INVITE", nextFollowupAt: "2026-09-22T00:00:00.000Z", activities: [], pipelineEvents: [] },
      { id: "pr3", name: fr ? "Digital Maarif" : "رقمي المعاريف", services: fr ? "Parcours et outils" : "مسارات وأدوات", status: fr ? "Dossier incomplet" : "ملف ناقص", next: fr ? "Pièces à déposer" : "وثائق للإيداع", tone: "violet" as const, stage: "PROFILE_STARTED", email: "maarif@example.invalid", source: "NETWORK", nextFollowupAt: null, activities: [{ id: "pa3", type: "NOTE", occurredAt: "2026-09-14T10:00:00.000Z", summary: fr ? "Pièces manquantes demandées." : "طُلبت وثائق ناقصة.", evidence: [] }], pipelineEvents: [] },
      { id: "pr4", name: fr ? "Formation Casa" : "تكوين الدار البيضاء", services: fr ? "Transfert d’équipe" : "نقل للفريق", status: fr ? "Inactif" : "غير نشط", next: fr ? "Relance de disponibilité" : "متابعة التوفر", tone: "sky" as const, stage: "INACTIVE", email: "casa@example.invalid", source: "NETWORK", nextFollowupAt: null, activities: [], pipelineEvents: [] },
      { id: "pr5", name: fr ? "Appui Ain Sebaa" : "دعم عين السبع", services: fr ? "Conseil stratégique" : "استشارة استراتيجية", status: fr ? "À accompagner" : "للمواكبة", next: fr ? "Point qualité" : "نقطة جودة", tone: "peach" as const, stage: "OPENED", email: "sebaa@example.invalid", source: "DIRECT", nextFollowupAt: null, activities: [], pipelineEvents: [] },
    ] as PersonRow[],
    requests: [
      { id: "d1", title: fr ? "Conseil stratégique" : "استشارة استراتيجية", stage: fr ? "À examiner" : "للمراجعة", owner: fr ? "Équipe territoire" : "فريق النطاق", flag: fr ? "Documents à vérifier" : "وثائق للمراجعة", tone: "violet" as const, stageCode: "REGISTERED", email: "client@example.invalid", source: "RFQ", nextFollowupAt: "2026-09-25T00:00:00.000Z", activities: [{ id: "da1", type: "NOTE", occurredAt: "2026-09-15T09:00:00.000Z", summary: fr ? "Besoin cadré, pièces à vérifier." : "حُددت الحاجة، وثائق للمراجعة.", evidence: ["rfq://d1"] }], pipelineEvents: [{ id: "de1", from: "OPENED", to: "REGISTERED", reasonCode: "INFORMATION_COMPLETED", occurredAt: "2026-09-15T09:00:00.000Z", evidence: [] }], matching: [{ id: "pr1", name: fr ? "Studio Atlas" : "ستوديو أطلس", status: fr ? "Qualifié" : "مؤهل", href: `/${locale}/franchise/fournisseurs/pr1${q}`, tone: "mint" as const }] },
      { id: "d2", title: fr ? "Identité de marque" : "هوية العلامة", stage: fr ? "En attente d’information" : "بانتظار معلومة", owner: fr ? "Partenaire local" : "شريك محلي", flag: fr ? "Compléments attendus" : "تكملات منتظرة", tone: "peach" as const, stageCode: "OPENED", matching: [] },
      { id: "d3", title: fr ? "Organisation et process" : "تنظيم ومساطر", stage: fr ? "En consultation" : "في الاستشارة", owner: fr ? "Équipe projet" : "فريق المشروع", flag: fr ? "Avis en cours" : "رأي جارٍ", tone: "sky" as const, stageCode: "RFQ_STARTED", matching: [{ id: "pr1", name: fr ? "Studio Atlas" : "ستوديو أطلس", status: fr ? "Qualifié" : "مؤهل", href: `/${locale}/franchise/fournisseurs/pr1${q}`, tone: "mint" as const }] },
      { id: "d4", title: fr ? "Formation équipe" : "تكوين الفريق", stage: fr ? "En suivi" : "قيد المتابعة", owner: fr ? "Pôle expertise" : "قطب الخبرة", flag: fr ? "Suivi planifié" : "متابعة مجدولة", tone: "mint" as const, stageCode: "CONTRACT_SIGNED", matching: [] },
      { id: "d5", title: fr ? "Support de lancement" : "دعم الإطلاق", stage: fr ? "À examiner" : "للمراجعة", owner: fr ? "Équipe territoire" : "فريق النطاق", flag: fr ? "Analyse initiale" : "تحليل أولي", tone: "violet" as const, stageCode: "SENT", matching: [] },
      { id: "d6", title: fr ? "Mise en conformité" : "وضع في حالة امتثال", stage: fr ? "En attente d’information" : "بانتظار معلومة", owner: fr ? "Partenaire local" : "شريك محلي", flag: fr ? "Informations manquantes" : "معلومات ناقصة", tone: "peach" as const, stageCode: "PROFILE_STARTED", matching: [] },
    ] as RequestRow[],
    documents: [
      { id: "doc1", title: fr ? "Contrat de prestation Studio Atlas" : "عقد خدمة ستوديو أطلس", owner: fr ? "Studio Atlas" : "ستوديو أطلس", status: fr ? "Valide" : "ساري", href: `/${locale}/franchise/fournisseurs/pr1/documents${q}`, kind: "evidence" as const },
      { id: "doc2", title: fr ? "Attestation fiscale 2026" : "شهادة ضريبية 2026", owner: fr ? "Studio Atlas" : "ستوديو أطلس", status: fr ? "Expire bientôt" : "ينتهي قريباً", href: `/${locale}/franchise/fournisseurs/pr1/documents${q}`, kind: "evidence" as const },
      { id: "doc3", title: fr ? "Références clients anonymisées" : "مراجع زبائن مجهولة", owner: fr ? "Conseil stratégique" : "استشارة استراتيجية", status: fr ? "À vérifier" : "للمراجعة", href: `/${locale}/franchise/demandes/d1/consultation${q}`, kind: "evidence" as const },
    ] as DocumentRow[],
    renewals: [
      { id: "rn1", title: fr ? "Attestation fiscale Studio Atlas" : "شهادة ضريبية ستوديو أطلس", owner: fr ? "Studio Atlas" : "ستوديو أطلس", status: fr ? "Expire bientôt" : "ينتهي قريباً", href: `/${locale}/franchise/fournisseurs/pr1/capacite${q}`, kind: "renewal" as const, due: "2026-12-01" },
      { id: "rn2", title: fr ? "Assurance RC professionnelle" : "تأمين المسؤولية المهنية", owner: fr ? "Conseil Anfa" : "استشارة أنفا", status: fr ? "À vérifier" : "للمراجعة", href: `/${locale}/franchise/fournisseurs/pr2/documents${q}`, kind: "renewal" as const, due: "2026-10-15" },
    ] as DocumentRow[],
    messages: [
      { id: "m1", title: fr ? "Sofiane Lahbabi" : "سفيان لهبابي", meta: fr ? "REQ-2026-031 · Fournisseur Studio Atlas" : "REQ-2026-031 · مزود ستوديو أطلس", href: `/${locale}/franchise/fournisseurs/pr1${q}`, tone: "mint" as const },
      { id: "m2", title: fr ? "Marie Colin" : "ماري كولين", meta: fr ? "Validation · Questionnaire Diagnostic SI" : "اعتماد · استبيان تشخيص نظم المعلومات", href: `/${locale}/franchise/validations${q}`, tone: "violet" as const },
      { id: "m3", title: fr ? "Nadia Farouk" : "نادية فاروق", meta: fr ? "Qualité · Plan correctif ouvert" : "جودة · خطة تصحيحية مفتوحة", href: `/${locale}/franchise/qualite${q}`, tone: "peach" as const },
    ] as MessageRow[],
    notifications: [
      { id: "n1", title: fr ? "Conformité à vérifier" : "امتثال للمراجعة", meta: "WARNING", href: `/${locale}/franchise/qualite${q}` },
      { id: "n2", title: fr ? "Conseil Anfa" : "استشارة أنفا", meta: fr ? "Aujourd’hui" : "اليوم", href: `/${locale}/franchise/relances${q}` },
    ] as NoticeRow[],
    quality: [
      { id: "q1", title: fr ? "Dossier — Conseil stratégique" : "ملف — استشارة استراتيجية", type: fr ? "Pièce" : "وثيقة", status: fr ? "À vérifier" : "للتحقق", next: fr ? "Consulter le dossier" : "عرض الملف", tone: "peach" as const, href: `/${locale}/franchise/documents${q}` },
      { id: "q2", title: fr ? "Qualification — Digital Maarif" : "تأهيل — رقمي المعاريف", type: fr ? "Qualification" : "تأهيل", status: fr ? "Complément demandé" : "تكملة مطلوبة", next: fr ? "Relancer le professionnel" : "متابعة المهني", tone: "sky" as const, href: `/${locale}/franchise/fournisseurs${q}` },
      { id: "q3", title: fr ? "Preuve de mission — Studio Atlas" : "دليل مهمة — ستوديو أطلس", type: fr ? "Preuve" : "دليل", status: fr ? "En revue" : "قيد المراجعة", next: fr ? "Motiver la décision" : "تعليل القرار", tone: "violet" as const, href: `/${locale}/franchise/qualite${q}` },
      { id: "q4", title: fr ? "Incident signalé — Anfa" : "حادثة مبلغ عنها — أنفا", type: fr ? "Incident" : "حادثة", status: fr ? "Décision communiquée" : "قرار مبلَّغ", next: fr ? "Consulter la traçabilité" : "عرض التتبع", tone: "mint" as const, href: `/${locale}/franchise/qualite/incidents${q}` },
    ] as QualityRow[],
    obligations: [
      { id: "o1", title: fr ? "Documents" : "وثائق", detail: fr ? "Suivi des documents attendus et de leur disponibilité." : "متابعة الوثائق المنتظرة وتوفرها." },
      { id: "o2", title: fr ? "Qualifications" : "التأهيلات", detail: fr ? "Suivi des qualifications et habilitations requises." : "متابعة التأهيلات والصلاحيات المطلوبة." },
      { id: "o3", title: fr ? "Preuves de mission" : "أدلة المهام", detail: fr ? "Suivi des éléments attestant d’une bonne exécution." : "متابعة عناصر حسن التنفيذ." },
      { id: "o4", title: fr ? "Incidents" : "الحوادث", detail: fr ? "Suivi des signalements et actions associées." : "متابعة البلاغات والإجراءات المرتبطة." },
    ],
    performance: [
      { id: "pf1", title: fr ? "Couverture du réseau" : "تغطية الشبكة", status: fr ? "En suivi" : "قيد المتابعة", next: fr ? "Actualiser le point mensuel" : "تحديث النقطة الشهرية" },
      { id: "pf2", title: fr ? "Délai moyen d’instruction" : "متوسط أجل الدراسة", status: fr ? "Sous vigilance" : "تحت اليقظة", next: fr ? "Relancer les dossiers ouverts" : "متابعة الملفات المفتوحة" },
      { id: "pf3", title: fr ? "Taux de dossiers complets" : "نسبة الملفات المكتملة", status: fr ? "En suivi" : "قيد المتابعة", next: fr ? "Accompagner les dossiers incomplets" : "مواكبة الملفات الناقصة" },
    ],
    followups: [
      { id: "f1", title: fr ? "Conseil Anfa" : "استشارة أنفا", due: fr ? "Aujourd’hui" : "اليوم", action: fr ? "Appel de suivi" : "مكالمة متابعة", tone: "peach" as const, href: `/${locale}/franchise/fournisseurs/pr2${q}` },
      { id: "f2", title: fr ? "Digital Maarif" : "رقمي المعاريف", due: fr ? "Sous 2 jours" : "خلال يومين", action: fr ? "Relance pièces" : "متابعة الوثائق", tone: "violet" as const, href: `/${locale}/franchise/fournisseurs/pr3${q}` },
      { id: "f3", title: fr ? "Formation Casa" : "تكوين الدار البيضاء", due: fr ? "Cette semaine" : "هذا الأسبوع", action: fr ? "Disponibilité" : "التوفر", tone: "sky" as const, href: `/${locale}/franchise/fournisseurs/pr4${q}` },
    ],
    quotes: [] as SupervisionRow[],
    missions: [] as SupervisionRow[],
    users: [] as SupervisionRow[],
    volume: [] as SupervisionRow[],
    anomalies: [] as SupervisionRow[],
    recommendations: [] as SupervisionRow[],
    opportunities: [] as SupervisionRow[],
    qualifications: [] as SupervisionRow[],
    definitions: [] as SupervisionRow[],
    risks: [] as SupervisionRow[],
    incidents: [] as SupervisionRow[],
    decisions: [
      { id: "g1", title: fr ? "Extension de couverture locale" : "توسيع التغطية المحلية", type: fr ? "Stratégie" : "استراتيجية", status: fr ? "À préparer" : "للتحضير" },
      { id: "g2", title: fr ? "Organisation des relances" : "تنظيم المتابعات", type: fr ? "Organisation" : "تنظيم", status: fr ? "À préparer" : "للتحضير" },
      { id: "g3", title: fr ? "Contrôle qualité Anfa" : "رقابة جودة أنفا", type: fr ? "Qualité" : "جودة", status: fr ? "À préparer" : "للتحضير" },
      { id: "g4", title: fr ? "Invitation d’un professionnel" : "دعوة مهني", type: fr ? "Réseau" : "شبكة", status: fr ? "À préparer" : "للتحضير" },
      { id: "g5", title: fr ? "Revue de pièces manquantes" : "مراجعة وثائق ناقصة", type: fr ? "Conformité" : "امتثال", status: fr ? "À préparer" : "للتحضير" },
    ],
    mandates: [
      { id: "md1", title: fr ? "Mandat territorial 2026" : "التفويض الترابي 2026", type: fr ? "Mandat" : "تفويض", status: fr ? "En vigueur" : "ساري" },
      { id: "md2", title: fr ? "Charte d’accompagnement" : "ميثاق المواكبة", type: fr ? "Charte" : "ميثاق", status: fr ? "En vigueur" : "ساري" },
      { id: "md3", title: fr ? "Politique de confidentialité du réseau" : "سياسة سرية الشبكة", type: fr ? "Politique" : "سياسة", status: fr ? "En vigueur" : "ساري" },
      { id: "md4", title: fr ? "Référentiel de contrôle" : "مرجع الرقابة", type: fr ? "Référentiel" : "مرجع", status: fr ? "En vigueur" : "ساري" },
    ],
    govHistory: [
      { id: "gh1", title: fr ? "Soumission du point qualité" : "إرسال نقطة الجودة", actor: fr ? "Équipe territoire" : "فريق النطاق" },
      { id: "gh2", title: fr ? "Validation du mandat 2026" : "المصادقة على تفويض 2026", actor: fr ? "Gouvernance" : "الحوكمة" },
      { id: "gh3", title: fr ? "Communication aux professionnels" : "تبليغ المهنيين", actor: fr ? "Réseau" : "الشبكة" },
    ],
    corrective: [] as Array<{ id: string; title: string; status: string; due: string }>,
    finance: [
      { id: "fi1", title: fr ? "Relevé de répartition" : "كشف التوزيع", object: fr ? "Période septembre 2026" : "فترة سبتمبر 2026", status: fr ? "À examiner" : "للمراجعة", auth: fr ? "Oui" : "نعم", tone: "peach" as const, amount: undefined },
      { id: "fi2", title: fr ? "Note d’allocation" : "مذكرة التخصيص", object: fr ? "Règle versionnée en vigueur" : "قاعدة بنسخة سارية", status: fr ? "En validation" : "قيد المصادقة", auth: fr ? "Oui" : "نعم", tone: "peach" as const, amount: undefined },
      { id: "fi3", title: fr ? "Document de synthèse" : "وثيقة تلخيص", object: fr ? "Périmètre Casablanca-Settat" : "نطاق الدار البيضاء-سطات", status: fr ? "Disponible" : "متاح", auth: fr ? "Non" : "لا", tone: "mint" as const, amount: undefined },
      { id: "fi4", title: fr ? "Relevé périodique" : "كشف دوري", object: fr ? "Suivi du mandat" : "متابعة التفويض", status: fr ? "À examiner" : "للمراجعة", auth: fr ? "Oui" : "نعم", tone: "peach" as const, amount: undefined },
      { id: "fi5", title: fr ? "Justificatif" : "إثبات", object: fr ? "Pièce de gouvernance" : "وثيقة حوكمة", status: fr ? "En validation" : "قيد المصادقة", auth: fr ? "Oui" : "نعم", tone: "peach" as const, amount: undefined },
    ] as FinanceRow[],
    journal: [
      { id: "j1", date: fr ? "16 sept. 2026" : "16 سبتمبر 2026", event: fr ? "Document déposé" : "إيداع مستند", doc: fr ? "Relevé de répartition" : "كشف التوزيع" },
      { id: "j2", date: fr ? "17 sept. 2026" : "17 سبتمبر 2026", event: fr ? "Passage en validation" : "مرور للمصادقة", doc: fr ? "Note d’allocation" : "مذكرة التخصيص" },
      { id: "j3", date: fr ? "18 sept. 2026" : "18 سبتمبر 2026", event: fr ? "Document mis à disposition" : "إتاحة مستند", doc: fr ? "Document de synthèse" : "وثيقة تلخيص" },
    ],
  };
}

export type FranchiseSpaceBoardData = ReturnType<typeof demoFranchiseSpaces>;
