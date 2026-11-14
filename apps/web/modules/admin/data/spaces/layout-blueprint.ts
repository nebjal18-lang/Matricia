import type { AdminSpaceId } from "./admin-nav";
import { spaceSpec, type SpaceTone } from "./screen-catalog";
import type { SpaceRow } from "./space-data";
import { localizeStatus } from "./view-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}
function statusOf(value: string | undefined, locale: Locale) {
  return localizeStatus(value ?? "", locale) || "—";
}

export type ListFamily = "actor-pipeline" | "parcours-cycle" | "plain";
export type DetailFamily = "kpi-fiche" | "thread" | "document";
export type DecisionFamily = "qualification" | "dispute" | "activation" | "standard";

export function spaceLayoutFamily(space: AdminSpaceId): {
  list: ListFamily;
  detail: DetailFamily;
  decision: DecisionFamily;
} {
  if (space === "messagerie") return { list: "parcours-cycle", detail: "thread", decision: "standard" };
  if (space === "documents" || space === "capacite") return { list: space === "capacite" ? "plain" : "parcours-cycle", detail: "document", decision: "standard" };
  if (space === "qualification") return { list: "parcours-cycle", detail: "kpi-fiche", decision: "qualification" };
  if (space === "litiges") return { list: "parcours-cycle", detail: "kpi-fiche", decision: "dispute" };
  if (space === "contrats" || space === "avenants" || space === "missions") return { list: "parcours-cycle", detail: "kpi-fiche", decision: "activation" };
  if (space === "providers" || space === "franchises") return { list: "actor-pipeline", detail: "kpi-fiche", decision: "standard" };
  if (space === "territoires") return { list: "plain", detail: "kpi-fiche", decision: "standard" };
  if (space === "gouvernance") return { list: "parcours-cycle", detail: "kpi-fiche", decision: "qualification" };
  return { list: "parcours-cycle", detail: "kpi-fiche", decision: "standard" };
}

export type BlueprintCard = { title: string; tone: SpaceTone; items: Array<{ label: string; value: string }> };

export function spaceDetailCards(locale: Locale, space: AdminSpaceId, row: SpaceRow): BlueprintCard[] {
  const spec = spaceSpec(space);
  const columns = dataColumns(spec.columns(locale));
  const tones: SpaceTone[] = ["violet", "sky", "mint", "peach", "violet", "sky", "mint", "peach"];
  if (space === "providers") {
    return [
      card(t(locale, "État du dossier", "حالة الملف"), statusOf(row.cells[2] ?? row.status, locale), t(locale, "Informations clés du prestataire.", "المعلومات الأساسية لمقدم الخدمة."), "mint"),
      card(t(locale, "Activité", "النشاط"), row.cells[1] ?? "—", t(locale, "Prestataire opérationnel sur la plateforme.", "مقدم خدمة عامل على المنصة."), "sky"),
      card(t(locale, "Qualification", "التأهيل"), row.cells[2] ?? "—", t(locale, "La qualification atteste d’une évaluation humaine.", "التأهيل يشهد تقييماً بشرياً."), "violet"),
      card(t(locale, "Capacité & disponibilité", "القدرة والتوفر"), row.cells[3] ?? "—", t(locale, "Capacité à répondre aux sollicitations.", "القدرة على الاستجابة للطلبات."), "mint"),
      card(t(locale, "Actions requises", "إجراءات مطلوبة"), row.treat ? t(locale, "À traiter", "للمعالجة") : t(locale, "Aucune en attente", "لا شيء معلّق"), t(locale, "File d’action du dossier.", "طابور إجراء الملف."), "peach"),
    ];
  }
  if (space === "diagnostics") {
    return [
      card(t(locale, "Contexte entreprise", "سياق المؤسسة"), row.cells[0] ?? row.title, columns[1] ? `${columns[1]} · ${row.cells[1] ?? "—"}` : statusOf(row.status, locale), "sky"),
      card(t(locale, "Questionnaire et version", "الاستبيان والنسخة"), row.cells[2] ?? "—", t(locale, "Version du questionnaire utilisée.", "نسخة الاستبيان المستخدمة."), "violet"),
      card(t(locale, "Progression", "التقدم"), row.cells[3] ?? "—", t(locale, "Avancement de la collecte.", "تقدم الجمع."), "mint"),
      card(t(locale, "Priorités identifiées", "الأولويات المحددة"), row.cells[4] ?? "—", t(locale, "Priorités détectées par le moteur.", "أولويات اكتشفها المحرك."), "peach"),
      card(t(locale, "Validation humaine", "المصادقة البشرية"), statusOf(row.status, locale), t(locale, "Aucune décision contractuelle automatique.", "لا قرار تعاقدي تلقائي."), "violet"),
    ];
  }
  if (space === "demandes") {
    return [
      card(t(locale, "Organisation et demandeur", "المؤسسة ومقدم الطلب"), row.cells[1] ?? row.title, `${columns[0] ?? ""} · ${row.cells[0] ?? "—"}`, "violet"),
      card(t(locale, "Objet de la demande", "موضوع الطلب"), row.cells[2] ?? "—", t(locale, "Description cadrée du besoin.", "وصف مؤطر للحاجة."), "mint"),
      card(t(locale, "Domaine / service", "المجال / الخدمة"), row.cells[3] ?? "—", t(locale, "Classification catalogue.", "تصنيف الدليل."), "sky"),
      card(t(locale, "Complétude", "الاكتمال"), row.cells[5] ?? "—", t(locale, "Points manquants à compléter.", "نقاط ناقصة للاستكمال."), "peach"),
      card(t(locale, "Consultation et offres", "الاستشارة والعروض"), `${row.cells[6] ?? "—"} · ${row.cells[7] ?? "—"}`, statusOf(row.status, locale), "violet"),
    ];
  }
  if (space === "matching") {
    return [
      card(t(locale, "Demande", "الطلب"), row.cells[0] ?? row.title, t(locale, "Critères de matching explicables.", "معايير مطابقة قابلة للتفسير."), "violet"),
      card(t(locale, "Prestataires éligibles", "المؤهلون"), row.cells[2] ?? "—", t(locale, "Filtrage par qualification et capacité.", "تصفية حسب التأهيل والقدرة."), "mint"),
      card(t(locale, "Exclusions", "الاستبعادات"), row.cells[3] ?? "—", t(locale, "Conflits et règles d’exclusion.", "تعارضات وقواعد الاستبعاد."), "peach"),
      card(t(locale, "Revue humaine", "مراجعة بشرية"), row.cells[4] ?? "—", t(locale, "Validation avant invitation.", "مصادقة قبل الدعوة."), "sky"),
      card(t(locale, "Consultation", "الاستشارة"), statusOf(row.cells[6] ?? row.status, locale), t(locale, "Suivi des réponses.", "متابعة الردود."), "violet"),
    ];
  }
  if (space === "litiges") {
    return [
      card(t(locale, "Parties", "الأطراف"), row.cells[2] ?? row.title, t(locale, "Client et prestataire concernés.", "العميل ومقدم الخدمة المعنيان."), "violet"),
      card(t(locale, "Motif", "السبب"), row.cells[3] ?? "—", t(locale, "Réclamation ouverte.", "شكوى مفتوحة."), "peach"),
      card(t(locale, "Preuves", "الأدلة"), row.cells[4] ?? "—", t(locale, "Pièces du contradictoire.", "وثائق الحضوري."), "sky"),
      card(t(locale, "Médiation", "الوساطة"), row.cells[6] ?? "—", t(locale, "Tentative d’accord.", "محاولة اتفاق."), "mint"),
      card(t(locale, "Décision", "القرار"), statusOf(row.cells[7] ?? row.status, locale), t(locale, "Arbitrage et réaffectation contrôlée.", "تحكيم وإعادة تعيين مراقبة."), "violet"),
    ];
  }
  return columns.slice(0, 5).map((label, index) => (
    card(label, row.cells[index] ?? "—", spec.lead(locale), tones[index] ?? "sky")
  ));
}

function card(title: string, value: string, hint: string, tone: SpaceTone): BlueprintCard {
  return { title, tone, items: [{ label: title, value }, { label: hint, value: hint }] };
}

export function spaceSectionCards(locale: Locale, space: AdminSpaceId, row: SpaceRow): BlueprintCard[] {
  const spec = spaceSpec(space);
  const columns = dataColumns(spec.columns(locale));
  const rest = columns.slice(5).map((label, index) => ({
    title: label,
    tone: "sky" as const,
    items: [{ label, value: row.cells[index + 5] ?? "—" }],
  }));
  if (space === "providers") {
    return [
      { title: t(locale, "Documents", "الوثائق"), tone: "violet", items: [{ label: t(locale, "Coffre", "الخزينة"), value: row.cells[4] ?? "—" }] },
      { title: t(locale, "Services proposés", "الخدمات المقترحة"), tone: "mint", items: [{ label: t(locale, "Déclaration", "التصريح"), value: row.cells[1] ?? "—" }] },
      { title: t(locale, "Missions", "المهام"), tone: "sky", items: [{ label: t(locale, "Activité", "النشاط"), value: row.cells[5] ?? "—" }] },
      { title: t(locale, "Facturation", "الفوترة"), tone: "peach", items: [{ label: t(locale, "État", "الحالة"), value: statusOf(row.status, locale) }] },
      { title: t(locale, "Réputation", "السمعة"), tone: "violet", items: [{ label: t(locale, "Suivi", "المتابعة"), value: row.extras?.partner ?? "—" }] },
      { title: t(locale, "Audit", "التدقيق"), tone: "mint", items: [{ label: t(locale, "Traçabilité", "التتبع"), value: row.extras?.rowVersion ?? "—" }] },
    ];
  }
  if (rest.length > 0) return rest;
  return spec.tabs(locale).slice(1, 5).map((tab) => ({
    title: tab,
    tone: "sky" as const,
    items: [{ label: tab, value: statusOf(row.status, locale) }],
  }));
}

export function decisionChoices(locale: Locale, space: AdminSpaceId): Array<{ value: string; label: string; hint: string; tone: SpaceTone }> {
  if (space === "litiges") {
    return [
      { value: "REJECT", label: t(locale, "Rejeter le litige", "رفض النزاع"), hint: t(locale, "Clôturer sans suite", "إغلاق دون متابعة"), tone: "peach" },
      { value: "PARTIAL", label: t(locale, "Accueillir partiellement", "قبول جزئي"), hint: t(locale, "Décision mixte", "قرار مختلط"), tone: "violet" },
      { value: "APPROVE", label: t(locale, "Accueillir", "قبول"), hint: t(locale, "Donner raison", "الإنصاف"), tone: "mint" },
      { value: "INFO", label: t(locale, "Demander complément", "طلب تكميل"), hint: t(locale, "Instruction", "تحقيق"), tone: "sky" },
      { value: "MEDIATE", label: t(locale, "Médiation", "وساطة"), hint: t(locale, "Accord amiable", "اتفاق ودي"), tone: "peach" },
    ];
  }
  if (space === "missions") {
    return [
      { value: "START", label: t(locale, "Démarrer", "الانطلاق"), hint: t(locale, "Kickoff", "الانطلاقة"), tone: "mint" },
      { value: "HOLD", label: t(locale, "Mettre en attente", "تعليق"), hint: t(locale, "Blocage contrôlé", "حظر مراقب"), tone: "sky" },
      { value: "CLOSE", label: t(locale, "Clôturer", "إغلاق"), hint: t(locale, "Fin de mission", "نهاية المهمة"), tone: "violet" },
    ];
  }
  if (space === "contrats" || space === "avenants") {
    return [
      { value: "APPROVE", label: t(locale, "Activer", "تفعيل"), hint: t(locale, "Version opposable", "نسخة ملزمة"), tone: "mint" },
      { value: "INFO", label: t(locale, "Demander un complément", "طلب تكميل"), hint: t(locale, "Clauses à revoir", "بنود للمراجعة"), tone: "sky" },
      { value: "REJECT", label: t(locale, "Refuser l’activation", "رفض التفعيل"), hint: t(locale, "Bloquer", "حظر"), tone: "peach" },
    ];
  }
  return [
    { value: "APPROVE", label: t(locale, "Approuver", "موافقة"), hint: t(locale, "Conforme aux exigences", "مطابق للمتطلبات"), tone: "mint" },
    { value: "CONDITIONAL", label: t(locale, "Approuver sous conditions", "موافقة بشروط"), hint: t(locale, "Réserves à lever", "تحفظات للرفع"), tone: "violet" },
    { value: "INFO", label: t(locale, "Demander un complément", "طلب تكميل"), hint: t(locale, "Pièces supplémentaires", "وثائق إضافية"), tone: "sky" },
    { value: "REJECT", label: t(locale, "Refuser", "رفض"), hint: t(locale, "Non conforme", "غير مطابق"), tone: "peach" },
  ];
}

export function decisionGuards(locale: Locale, space: AdminSpaceId): Array<{ title: string; body: string; tone: "warn" | "danger" | "ok" }> {
  const four = {
    title: t(locale, "Contrôle à quatre yeux", "تحقق بأربعة أعين"),
    body: t(locale, "Vous ne pouvez pas valider votre propre dossier.", "لا يمكنكم المصادقة على ملفكم."),
    tone: "warn" as const,
  };
  const audit = {
    title: t(locale, "Journal d’audit", "سجل التدقيق"),
    body: t(locale, "Le journal d’audit et l’Event Outbox enregistrent l’action.", "يسجَّل الإجراء في سجل التدقيق وصندوق الأحداث."),
    tone: "ok" as const,
  };
  if (space === "qualification" || space === "gouvernance" || space === "litiges") {
    return [
      four,
      { title: t(locale, "Auto-approbation non autorisée", "المصادقة الذاتية غير مسموحة"), body: t(locale, "Un second validateur indépendant est requis.", "يلزم مصادق ثانٍ مستقل."), tone: "danger" },
      audit,
    ];
  }
  return [four, audit];
}

export function wizardFields(locale: Locale, space: AdminSpaceId): Array<{ id: string; name: string; label: string; required?: boolean; multiline?: boolean; value?: string }> {
  if (space === "demandes") {
    return [
      { id: "demandes-object", name: "note", label: t(locale, "Objet de la demande", "موضوع الطلب"), required: true },
      { id: "demandes-context", name: "context", label: t(locale, "Contexte et livrables", "السياق والتسليمات"), required: true, multiline: true },
    ];
  }
  if (space === "avenants") {
    return [
      { id: "avenant-object", name: "note", label: t(locale, "Objet de l’avenant", "موضوع الملحق"), required: true },
      { id: "avenant-impact", name: "context", label: t(locale, "Impacts financiers et jalons", "الآثار المالية والمعالم"), required: true, multiline: true },
    ];
  }
  if (space === "documents") {
    return [
      { id: "doc-target", name: "note", label: t(locale, "Destinataire du partage", "مستلم المشاركة"), required: true },
      { id: "doc-reason", name: "context", label: t(locale, "Motif du partage", "سبب المشاركة"), required: true, multiline: true },
    ];
  }
  if (space === "messagerie") {
    return [
      { id: "msg-channel", name: "note", label: t(locale, "Canal préféré", "القناة المفضلة"), required: true, value: "in-app" },
      { id: "msg-reason", name: "context", label: t(locale, "Règle de notification", "قاعدة الإشعار"), required: true, multiline: true },
    ];
  }
  return [
    { id: `${space}-note`, name: "note", label: t(locale, "Objet", "الموضوع"), required: true },
  ];
}

export function dataColumns(columns: string[]) {
  return columns.filter((column) => !/action|إجراء/i.test(column));
}

export function detailNote(locale: Locale, space: AdminSpaceId) {
  if (space === "diagnostics") {
    return t(locale, "Aucune décision contractuelle ou financière n’est prise automatiquement sur la base de ce diagnostic.", "لا يُتخذ أي قرار تعاقدي أو مالي تلقائياً على أساس هذا التشخيص.");
  }
  if (space === "demandes") {
    return t(locale, "Aucune valeur financière n’est affichée à ce stade.", "لا تُعرض أي قيمة مالية في هذه المرحلة.");
  }
  if (space === "matching") {
    return t(locale, "Le classement est explicable et soumis à revue humaine avant invitation.", "الترتيب قابل للتفسير ويخضع لمراجعة بشرية قبل الدعوة.");
  }
  if (space === "litiges") {
    return t(locale, "La réaffectation n’est possible qu’après décision motivée, auditée et à quatre yeux.", "إعادة التعيين ممكنة فقط بعد قرار معلل ومُدقق وبأربعة أعين.");
  }
  return t(locale, "Chaque page applique le périmètre, les permissions et la traçabilité correspondant à l’utilisateur connecté.", "تطبّق كل صفحة النطاق والصلاحيات والتتبع الخاص بالمستخدم المتصل.");
}
