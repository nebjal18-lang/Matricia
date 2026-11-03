import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ClientOfferDetail } from "./quote-detail-model";

export function isDemoOfferId(quoteId: string) {
  return /-(?:a|b)$/u.test(quoteId) || quoteId.startsWith("demo:");
}

export function canApplyDemoOffer(organizationName: string | null) {
  void organizationName;
  return false;
}

export function demoClientOfferDetail(input: {
  locale: Locale;
  requestId: string;
  quoteId: string;
  description: string | null;
  organizationQuery: string;
  rfqId?: string | null;
}): ClientOfferDetail {
  const fr = input.locale === "fr";
  const slot = /(?:-b|b)$/u.test(input.quoteId) ? "b" : "a";
  const q = input.organizationQuery;
  const comparisonHref = input.rfqId
    ? `/${input.locale}/client/demandes/${input.requestId}/offres?rfq=${input.rfqId}${q ? `&${q.slice(1)}` : ""}`
    : `/${input.locale}/client/demandes/${input.requestId}${q}`;
  const documentsHref = `/${input.locale}/client/documents${q}`;
  const days = slot === "a" ? 42 : 56;
  return {
    quoteId: input.quoteId,
    quoteVersionId: `${input.quoteId}-version`,
    requestId: input.requestId,
    rfqId: input.requestId,
    label: slot === "a" ? (fr ? "Offre A" : "العرض أ") : (fr ? "Offre B" : "العرض ب"),
    description: input.description ?? (fr ? "Stratégie, identité et support de lancement" : "استراتيجية، هوية ودعم الإطلاق"),
    currency: "MAD",
    inclusions: fr
      ? ["Cadrage stratégique", "Identité de marque", "Supports de lancement"]
      : ["تأطير استراتيجي", "هوية العلامة", "دعائم الإطلاق"],
    deliverables: fr
      ? slot === "a"
        ? ["Plateforme de marque", "Charte graphique", "Kit de lancement"]
        : ["Plateforme de marque", "Charte graphique"]
      : slot === "a"
        ? ["منصة العلامة", "الميثاق البصري", "حزمة الإطلاق"]
        : ["منصة العلامة", "الميثاق البصري"],
    delays: fr
      ? [`Début proposé le 6 octobre 2026`, `Durée de ${days} jours`, "Valable jusqu’au 30 novembre 2026"]
      : [`البداية المقترحة في 6 أكتوبر 2026`, `مدة ${days} أيام`, "صالح حتى 30 نوفمبر 2026"],
    conditions: fr
      ? ["Garantie 90 jours après livraison", "Deux cycles de correction inclus", "Paiement en trois jalons"]
      : ["ضمان 90 يوماً بعد التسليم", "دورتان للتصحيح مشمولتان", "الدفع على ثلاث مراحل"],
    exclusions: fr
      ? slot === "a"
        ? ["Production print industrielle", "Achat d’espaces media"]
        : ["Déplacements internationaux", "Achat d’espaces media"]
      : slot === "a"
        ? ["الإنتاج الطباعي الصناعي", "شراء المساحات الإعلانية"]
        : ["التنقل الدولي", "شراء المساحات الإعلانية"],
    lines: slot === "a"
      ? [
          { id: "l1", label: fr ? "Direction artistique" : "الإدارة الفنية", quantity: "1", unitCode: "FORFAIT", taxLabel: "20 %", totalMinor: "1800000" },
          { id: "l2", label: fr ? "Identité visuelle" : "الهوية البصرية", quantity: "1", unitCode: "FORFAIT", taxLabel: "20 %", totalMinor: "1500000" },
          { id: "l3", label: fr ? "Supports de lancement" : "دعائم الإطلاق", quantity: "1", unitCode: "FORFAIT", taxLabel: "20 %", totalMinor: "1200000" },
        ]
      : [
          { id: "l1", label: fr ? "Direction artistique" : "الإدارة الفنية", quantity: "1", unitCode: "FORFAIT", taxLabel: "20 %", totalMinor: "2000000" },
          { id: "l2", label: fr ? "Identité visuelle" : "الهوية البصرية", quantity: "1", unitCode: "FORFAIT", taxLabel: "20 %", totalMinor: "1800000" },
        ],
    documents: [
      { id: "d1", fileName: fr ? "Proposition.pdf" : "العرض.pdf", kind: "pdf", href: documentsHref },
      { id: "d2", fileName: fr ? "Planning.xlsx" : "الجدول.xlsx", kind: "xlsx", href: documentsHref },
      { id: "d3", fileName: fr ? "Conditions.docx" : "الشروط.docx", kind: "docx", href: documentsHref },
    ],
    points: [
      { id: "scope", hint: fr ? "Étendue de la prestation proposée" : "نطاق الخدمة المقترحة", action: "review" },
      { id: "timeline", hint: fr ? "Calendrier et jalons annoncés" : "الجدول والمراحل المعلنة", action: "compare" },
      { id: "exclusions", hint: fr ? "Éléments non inclus dans l’offre" : "عناصر غير مشمولة في العرض", action: "review" },
      { id: "terms", hint: fr ? "Garanties, conditions et modalités" : "الضمانات والشروط والآليات", action: "compare" },
    ],
    flags: [
      { id: "f1", text: fr ? (slot === "a" ? "Production print industrielle" : "Déplacements internationaux") : (slot === "a" ? "الإنتاج الطباعي الصناعي" : "التنقل الدولي"), tone: "clarify" },
      { id: "f2", text: fr ? "Achat d’espaces media" : "شراء المساحات الإعلانية", tone: "clarify" },
      { id: "f3", text: fr ? "Accès aux interlocuteurs internes dès le cadrage" : "إتاحة المخاطبين الداخليين منذ التأطير", tone: "confirm" },
    ],
    comparisonHref,
    askHref: `/${input.locale}/messagerie${q}`,
    documentsHref,
  };
}
