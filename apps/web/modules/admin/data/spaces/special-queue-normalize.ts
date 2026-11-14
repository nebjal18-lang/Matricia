import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminSpaceId } from "./admin-nav";
import { humanizeTechnicalCode } from "./franchise-presentation";
import { spaceHref, statusTone, type SpaceTone } from "./screen-catalog";

export type QueueSpaceRow = {
  id: string;
  href: string;
  title: string;
  cells: string[];
  status: string;
  tone: SpaceTone;
  organizationId?: string;
  treat?: boolean;
  extras?: Record<string, string>;
};

function base(locale: Locale, space: AdminSpaceId, query: string, row: QueueSpaceRow, cells: string[]): QueueSpaceRow {
  return {
    ...row,
    href: spaceHref(locale, space, query, row.id),
    cells,
    tone: statusTone(row.status),
  };
}

/** Drop trailing duplicate status cells and repair known special-queue shifts. */
export function normalizeSpecialQueueRow(locale: Locale, space: AdminSpaceId, query: string, row: QueueSpaceRow): QueueSpaceRow {
  const cells = [...row.cells];
  if (space === "capacite") {
    // legacy: name, code, status, —, —, docs, expires, status
    if (cells.length >= 8 && cells[7] === row.status) {
      return base(locale, space, query, row, cells.slice(0, 7));
    }
    return base(locale, space, query, { ...row, treat: /SUBMITTED|UNDER_REVIEW|EXPIRED|REJECTED/.test(row.status) }, cells.slice(0, 7));
  }
  if (space === "providers") {
    // legacy 7th duplicate overall_status
    if (cells.length >= 7 && cells[6] === row.status) {
      return base(locale, space, query, row, [
        cells[0] ?? row.title,
        cells[1] ?? "—",
        cells[2] ?? row.status,
        cells[3] ?? "—",
        cells[4] ?? "—",
        cells[5] && cells[5] !== row.status ? cells[5] : "—",
      ]);
    }
    return base(locale, space, query, row, cells.slice(0, 6));
  }
  if (space === "qualification") {
    // legacy: name, service, request, eligibility, decision, reason, decision
    if (cells.length >= 7 && cells[6] === (cells[4] ?? row.status)) {
      return base(locale, space, query, row, [
        cells[0] ?? row.title,
        cells[1] ?? "—",
        "—",
        cells[3] ?? "—",
        cells[4] ?? row.status,
        cells[5] ?? "—",
      ]);
    }
    return base(locale, space, query, row, cells.slice(0, 6));
  }
  if (space === "gouvernance") {
    // legacy: id, franchise/library, requestType, territory, version, status, status, decision
    const territory = humanizeTechnicalCode(cells[3] ?? "", locale) || (cells[3] ?? "—");
    return base(locale, space, query, row, [
      cells[0] ?? row.id.slice(0, 8),
      cells[1] ?? "—",
      cells[2] ?? row.title,
      territory,
      cells[4] ?? "—",
      "—",
      row.status,
      cells[7] && cells[7] !== row.status ? cells[7] : cells[7] ?? "—",
    ]);
  }
  if (space === "litiges") {
    // legacy SQL put case status into Contradictoire [5]
    if (cells.length >= 9 && cells[5] === row.status) {
      return base(locale, space, query, { ...row, title: humanizeTechnicalCode(row.title, locale) || row.title }, [
        cells[0] ?? row.id.slice(0, 8),
        cells[1] ?? "—",
        cells[2] && cells[2] !== cells[3] ? cells[2]! : "—",
        humanizeTechnicalCode(cells[3] ?? row.title, locale) || cells[3] || "—",
        cells[4] ?? "—",
        "—",
        cells[6] ?? "—",
        cells[7] ?? "—",
        row.status,
      ]);
    }
    return base(locale, space, query, row, cells.slice(0, 9));
  }
  return row;
}
