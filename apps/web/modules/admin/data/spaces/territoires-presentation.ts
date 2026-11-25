import type { AdminGovernanceDashboard } from "@/modules/admin/data/governance-disputes/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import {
  franchiseListTitle,
  franchiseTerritoryLabel,
  humanizeTechnicalCode,
  franchiseOperatorLabel,
} from "./franchise-presentation";
import { spaceHref, statusTone, type SpaceTone } from "./screen-catalog";

export type TerritoiresSpaceRow = {
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

/** Legacy RPC packed an extra version cell and shifted Fin into État. */
export function isLegacyShiftedTerritoiresCells(cells: readonly string[], status: string): boolean {
  const mandate = cells[3] ?? "";
  return (
    cells.length >= 8 &&
    /^v\d+$/u.test(mandate) &&
    cells[4] === mandate.slice(1) &&
    cells[7] === status
  );
}

export function presentTerritoiresListTitle(rawTitle: string, locale: Locale): string {
  const parts = rawTitle.split(/\s*[·\-]\s*/u).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const operator = franchiseOperatorLabel(parts[0]!, locale);
    const territory = humanizeTechnicalCode(parts.slice(1).join(" "), locale);
    return `${operator} · ${territory}`;
  }
  return franchiseOperatorLabel(rawTitle, locale);
}

export function normalizeTerritoiresRpcRow(locale: Locale, query: string, row: TerritoiresSpaceRow): TerritoiresSpaceRow {
  const title = presentTerritoiresListTitle(row.title, locale);
  if (!isLegacyShiftedTerritoiresCells(row.cells, row.status)) {
    const territory = humanizeTechnicalCode(row.cells[1] ?? "", locale);
    const library = row.cells[2] ?? "—";
    return {
      ...row,
      href: spaceHref(locale, "territoires", query, row.id),
      title,
      cells: [
        title,
        territory || "—",
        library,
        row.cells[3] ?? "—",
        row.cells[4] ?? "—",
        row.cells[5] ?? "—",
        row.cells[6] ?? row.status,
      ],
      tone: statusTone(row.status),
      treat: row.status !== "ACTIVE",
    };
  }
  return {
    ...row,
    href: spaceHref(locale, "territoires", query, row.id),
    title,
    cells: [
      title,
      humanizeTechnicalCode(row.cells[1] ?? "", locale) || "—",
      row.cells[0] || row.cells[2] || "—",
      row.cells[3] ?? "—",
      row.cells[5] ?? "—",
      row.cells[6] ?? "—",
      row.cells[7] ?? row.status,
    ],
    tone: statusTone(row.status),
    treat: row.status !== "ACTIVE",
  };
}

export function buildTerritoiresRowsFromGovernance(
  locale: Locale,
  query: string,
  governance: AdminGovernanceDashboard,
): TerritoiresSpaceRow[] {
  const franchise = governance.franchise;
  if (!franchise) return [];
  return franchise.franchises.flatMap((item) => {
    const versions = item.mandateVersions.length ? item.mandateVersions : item.mandate ? [item.mandate] : [];
    const libraryName = locale === "ar" ? item.libraryNameAr : item.libraryNameFr;
    const territoryName = franchiseTerritoryLabel(item, locale);
    const title = franchiseListTitle(item, locale);
    return versions.map((mandate) => ({
      id: mandate.id,
      href: spaceHref(locale, "territoires", query, mandate.id),
      title,
      cells: [
        title,
        territoryName,
        libraryName,
        `v${mandate.version}`,
        mandate.effectiveFrom.slice(0, 10),
        "effectiveUntil" in mandate && mandate.effectiveUntil ? String(mandate.effectiveUntil).slice(0, 10) : "—",
        mandate.status,
      ],
      status: mandate.status,
      tone: statusTone(mandate.status),
      organizationId: item.organizationId,
      treat: mandate.status !== "ACTIVE",
      extras: {
        franchiseId: item.id,
        type: item.type,
        libraryCode: item.libraryCode,
        territoryCode: item.territoryCode,
      },
    }));
  });
}

/** Keep the authorized RPC id set; prefer governance presentation when available. */
export function presentAuthorizedTerritoiresRows(
  locale: Locale,
  query: string,
  authorized: TerritoiresSpaceRow[],
  governance: AdminGovernanceDashboard | null,
): TerritoiresSpaceRow[] {
  if (!authorized.length) return [];
  if (!governance?.franchise) {
    return authorized.map((row) => normalizeTerritoiresRpcRow(locale, query, row));
  }
  const byId = new Map(buildTerritoiresRowsFromGovernance(locale, query, governance).map((row) => [row.id, row]));
  return authorized.map((row) => byId.get(row.id) ?? normalizeTerritoiresRpcRow(locale, query, row));
}
