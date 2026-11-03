import { formatHundredths, type EvolutionDashboard } from "@/modules/shared/lib/diagnostics-evolution/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export const SOLUTION_LEVEL_LABELS = {
  fr: { GUIDANCE: "Conseil", ASSISTED: "Accompagné", MANAGED: "Piloté" },
  ar: { GUIDANCE: "إرشاد", ASSISTED: "مرافقة", MANAGED: "تسيير" },
} as const;

export type ContinuitySnapshot = {
  evolution: Array<{ libraryCode: string; score: string; delta: string | null; href: string }>;
  expiredAnswerCount: number;
  expiringAnswerCount: number;
  questionnaireHref: string;
  proposedCount: number;
  reassessmentCount: number;
  assistanceHref: string;
  solutionsHref: string;
};

export function clientHref(path: string, query: string, extra?: Record<string, string>) {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
  }
  const encoded = params.toString();
  return encoded ? `${path}?${encoded}` : path;
}

export function labelSolutionLevel(locale: Locale, level: string|null) {
  const labels = SOLUTION_LEVEL_LABELS[locale];
  return (level?labels[level as keyof typeof labels]:null) ?? (locale==="fr"?"Niveau non renseigné":"المستوى غير محدد");
}

export function formatDimensionKey(key: string) {
  return key.replaceAll("_", " ");
}

export function latestEvolutionHighlights(
  dashboard: EvolutionDashboard,
  locale: Locale,
  selectedQuery: string,
): ContinuitySnapshot["evolution"] {
  return dashboard.series.flatMap((series) => {
    const current = series.points.find((point) => point.status === "COMPLETED") ?? series.points[0];
    if (!current) return [];
    return [{
      libraryCode: series.libraryCode,
      score: current.score,
      delta: current.deltaHundredths === null ? null : formatHundredths(current.deltaHundredths),
      href: clientHref(`/${locale}/client/diagnostics/${current.id}`, selectedQuery),
    }];
  });
}

export function opportunityRequestHref(locale: Locale, opportunityId: string, selectedQuery: string) {
  return clientHref(`/${locale}/client/demandes/nouvelle`, selectedQuery, { opportunityId });
}

export function labelDiagnosticSeverity(locale:Locale,severity:string){const labels:Record<string,readonly[string,string]>={INFO:["Information","معلومة"],LOW:["Faible","منخفضة"],WARNING:["À surveiller","تتطلب المتابعة"],HIGH:["Élevée","عالية"],CRITICAL:["Critique","حرجة"]};return labels[severity]?.[locale==="fr"?0:1]??(locale==="fr"?"Gravité non renseignée":"الخطورة غير محددة");}
export function labelDiagnosticPriority(locale:Locale,priority:number|null){return priority===null?(locale==="fr"?"Priorité non renseignée":"الأولوية غير محددة"):`${new Intl.NumberFormat(locale==="fr"?"fr-MA":"ar-MA",{maximumFractionDigits:2}).format(priority)}/100`;}
