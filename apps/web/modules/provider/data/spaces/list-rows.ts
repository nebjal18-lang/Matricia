import type { ProviderMissionDashboard } from "@/modules/provider/data/missions/model";
import type { ProviderQuoteDashboard, ProviderQuoteInvitation } from "@/modules/provider/data/quotes/model";
import { quoteStatusLabel } from "@/modules/provider/screens/devis/status-labels";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type ProviderListRow = {
  id: string;
  title: string;
  scope: string;
  deadline?: string;
  status: string;
  next?: string;
  action: string;
  tone: "peach" | "sky" | "mint" | "violet";
  href: string;
};

function formatDeadline(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium" }).format(new Date(iso));
}

function invitationTone(status: string, quoteStatus: string | null): "peach" | "sky" | "mint" | "violet" {
  if (["DECLINED", "WITHDRAWN", "SUSPENDED"].includes(status)) return "mint";
  if (quoteStatus === "SUBMITTED") return "sky";
  if (quoteStatus === "DRAFT" || quoteStatus === "REVISED") return "violet";
  if (status === "ACCEPTED") return "sky";
  return "peach";
}

export function consultationRowsFromInvitations(
  invitations: readonly ProviderQuoteInvitation[],
  locale: Locale,
  query: string,
): ProviderListRow[] {
  const ar = locale === "ar";
  return invitations.map((item) => {
    const quoteStatus = item.quote?.status ?? null;
    const status = quoteStatus
      ? quoteStatusLabel(quoteStatus, locale)
      : quoteStatusLabel(item.status, locale);
    return {
      id: item.id,
      title: item.description,
      scope: item.regionCode,
      deadline: formatDeadline(item.deadline, locale),
      status,
      action: ar ? "فتح الملف" : "Ouvrir le dossier",
      tone: invitationTone(item.status, quoteStatus),
      href: `/${locale}/sous-traitant/consultations/${item.id}${query}`,
    };
  });
}

export function quoteRowsFromInvitations(
  invitations: readonly ProviderQuoteInvitation[],
  locale: Locale,
  query: string,
): ProviderListRow[] {
  const ar = locale === "ar";
  return invitations.flatMap((item) => {
    if (!item.quote) return [];
    const status = item.quote.status;
    const href = status === "REVISED"
      ? `/${locale}/sous-traitant/devis/${item.quote.id}/revision${query}`
      : status === "DRAFT"
        ? `/${locale}/sous-traitant/devis/${item.quote.id}${query}`
        : `/${locale}/sous-traitant/devis/${item.quote.id}/apercu${query}`;
    const action = status === "DRAFT" ? (ar ? "استئناف" : "Reprendre") : status === "REVISED" ? (ar ? "فتح" : "Ouvrir") : (ar ? "عرض النسخة" : "Voir la version");
    const next = status === "DRAFT"
      ? (ar ? "إكمال البنود" : "Compléter les lignes")
      : status === "REVISED"
        ? (ar ? "مراجعة قبل الإرسال" : "Relire avant envoi")
        : status === "SUBMITTED"
          ? (ar ? "انتظار الرد" : "Attendre le retour")
          : "—";
    return [{
      id: item.quote.id,
      title: item.description,
      scope: item.regionCode,
      status: quoteStatusLabel(status, locale),
      next,
      action,
      tone: invitationTone(item.status, status),
      href,
    }];
  });
}

export function missionRowsFromDashboard(
  dashboard: ProviderMissionDashboard,
  locale: Locale,
  query: string,
): ProviderListRow[] {
  const ar = locale === "ar";
  return dashboard.missions.map((mission) => {
    const open = mission.milestones.find((item) => !["DONE", "COMPLETED"].includes(item.status));
    const title = open?.title || mission.deliverables[0]?.label || mission.id.slice(0, 8);
    return {
      id: mission.id,
      title,
      scope: mission.status,
      status: mission.status,
      next: open?.title ?? (ar ? "متابعة" : "Suivre"),
      action: ar ? "فتح" : "Ouvrir",
      tone: mission.status === "COMPLETED" ? "mint" : open ? "violet" : "sky",
      href: `/${locale}/sous-traitant/missions/${mission.id}${query}`,
    };
  });
}

export function filterListRows(rows: readonly ProviderListRow[], search: string): ProviderListRow[] {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) => `${row.title} ${row.scope} ${row.status}`.toLocaleLowerCase().includes(needle));
}

export function providerSearchQuery(query: string, patch: Record<string, string | undefined>): string {
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  if (["q", "tab", "domain"].some(key => Object.hasOwn(patch, key) && (patch[key] ?? "") !== (params.get(key) ?? ""))) params.delete("page");
  for (const [key, value] of Object.entries(patch)) {
    if (!value) params.delete(key);
    else params.set(key, value);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export function filterInvitationsByConsultTab(
  invitations: readonly ProviderQuoteInvitation[],
  tab: string | undefined,
): readonly ProviderQuoteInvitation[] {
  if (!tab || tab === "all") return invitations;
  if (tab === "answer") {
    return invitations.filter((item) => ["INVITED", "VIEWED"].includes(item.status) && (!item.quote || ["DRAFT", "IN_PROGRESS"].includes(item.quote.status)));
  }
  if (tab === "preparing") {
    return invitations.filter((item) => item.quote && ["DRAFT", "IN_PROGRESS", "CLARIFICATION_REQUESTED"].includes(item.quote.status));
  }
  if (tab === "done") {
    return invitations.filter((item) => ["DECLINED", "WITHDRAWN", "SUSPENDED"].includes(item.status) || Boolean(item.quote && ["SUBMITTED", "SELECTED", "REJECTED"].includes(item.quote.status)));
  }
  return invitations;
}

export function filterInvitationsByQuoteTab(
  invitations: readonly ProviderQuoteInvitation[],
  tab: string | undefined,
): readonly ProviderQuoteInvitation[] {
  const withQuote = invitations.filter((item) => item.quote);
  if (!tab || tab === "all") return withQuote;
  if (tab === "drafts") return withQuote.filter((item) => item.quote?.status === "DRAFT");
  if (tab === "submit") return withQuote.filter((item) => item.quote && ["DRAFT", "IN_PROGRESS"].includes(item.quote.status));
  if (tab === "submitted") return withQuote.filter((item) => item.quote?.status === "SUBMITTED");
  if (tab === "revise") return withQuote.filter((item) => item.quote && ["REVISED", "CLARIFICATION_REQUESTED"].includes(item.quote.status));
  if (tab === "finished") return withQuote.filter((item) => item.quote && ["SELECTED", "REJECTED", "WITHDRAWN"].includes(item.quote.status));
  return withQuote;
}

export type { ProviderQuoteDashboard };
