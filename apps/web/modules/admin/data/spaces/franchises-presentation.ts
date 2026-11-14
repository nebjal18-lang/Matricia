import type { AdminGovernanceDashboard } from "@/modules/admin/data/governance-disputes/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import {
  franchiseListTitle,
  franchiseOperatorLabel,
  franchiseTerritoryLabel,
  humanizeTechnicalCode,
} from "./franchise-presentation";
import { spaceHref, statusTone, type SpaceTone } from "./screen-catalog";

export type FranchiseSpaceRow = {
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

function typeLabel(type: string, locale: Locale) {
  if (type === "IT") return "IT";
  return locale === "ar" ? "قياسي" : "Standard";
}

function alertLabel(status: string, locale: Locale) {
  if (status === "ACTIVE") return "—";
  return locale === "ar" ? "متابعة مطلوبة" : "Suivi requis";
}

/** Legacy SQL: library, raw operator, raw territory, vN, type, status, mandateStatus, status */
export function isLegacyFranchisesCells(cells: readonly string[]): boolean {
  return cells.length >= 8 && /^v?\d+$|^—$/u.test(cells[3] ?? "") && (cells[4] === "IT" || cells[4] === "STANDARD" || cells[4] === "Standard" || cells[4] === "قياسي");
}

export function normalizeFranchisesRpcRow(locale: Locale, query: string, row: FranchiseSpaceRow): FranchiseSpaceRow {
  const cells = row.cells;
  if (!isLegacyFranchisesCells(cells)) {
    const title = row.title.includes("·") || row.title.includes("-")
      ? row.title
      : franchiseOperatorLabel(row.title, locale);
    return {
      ...row,
      href: spaceHref(locale, "franchises", query, row.id),
      title,
      tone: statusTone(row.status),
      treat: row.status !== "ACTIVE",
    };
  }
  const operator = franchiseOperatorLabel(cells[1] ?? "", locale);
  const territory = humanizeTechnicalCode(cells[2] ?? "", locale);
  const library = cells[0] || "—";
  const title = `${operator} · ${territory}`;
  const mandate = cells[3]?.startsWith("v") ? cells[3]! : cells[3] ? `v${cells[3]}` : "—";
  const type = typeLabel(cells[4] === "STANDARD" ? "STANDARD" : cells[4] ?? "STANDARD", locale);
  const mandateStatus = cells[6] ?? "—";
  return {
    ...row,
    href: spaceHref(locale, "franchises", query, row.id),
    title,
    cells: [title, library, territory, mandate, mandateStatus, type, alertLabel(row.status, locale), row.status],
    tone: statusTone(row.status),
    treat: row.status !== "ACTIVE",
  };
}

export function buildFranchisesRowsFromGovernance(
  locale: Locale,
  query: string,
  governance: AdminGovernanceDashboard,
): FranchiseSpaceRow[] {
  const franchise = governance.franchise;
  if (!franchise) return [];
  return franchise.franchises.map((item) => {
    const libraryName = locale === "ar" ? item.libraryNameAr : item.libraryNameFr;
    const territoryName = franchiseTerritoryLabel(item, locale);
    const title = franchiseListTitle(item, locale);
    return {
      id: item.id,
      href: spaceHref(locale, "franchises", query, item.id),
      title,
      cells: [
        title,
        libraryName,
        territoryName,
        item.mandate ? `v${item.mandate.version}` : "—",
        item.mandate?.status ?? "—",
        typeLabel(item.type, locale),
        alertLabel(item.status, locale),
        item.status,
      ],
      status: item.status,
      tone: statusTone(item.status),
      organizationId: item.organizationId,
      treat: item.status !== "ACTIVE",
      extras: { mandateId: item.mandate?.id ?? "", type: item.type },
    };
  });
}

export function presentAuthorizedFranchisesRows(
  locale: Locale,
  query: string,
  authorized: FranchiseSpaceRow[],
  governance: AdminGovernanceDashboard | null,
): FranchiseSpaceRow[] {
  if (!authorized.length) return [];
  if (!governance?.franchise) {
    return authorized.map((row) => normalizeFranchisesRpcRow(locale, query, row));
  }
  const byId = new Map(buildFranchisesRowsFromGovernance(locale, query, governance).map((row) => [row.id, row]));
  return authorized.map((row) => byId.get(row.id) ?? normalizeFranchisesRpcRow(locale, query, row));
}
