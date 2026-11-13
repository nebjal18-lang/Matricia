import type { Locale } from "@/modules/shared/lib/i18n/locale";

type TerritoryVersion = { code: string; name: string; version: number };

/** Human franchise operator label — never dump raw HATIM_AHMITECH / E2E codes as the primary name. */
export function franchiseOperatorLabel(code: string, locale: Locale): string {
  const key = code.trim().toUpperCase();
  if (key === "HATIM_AHMITECH") return "Hatim Ahmitech";
  if (key === "FRANCHISEE") return locale === "ar" ? "صاحب امتياز" : "Franchisé";
  if (key === "NEOXA_JALIL") return "Jalil · NEOXA";
  if (key === "ASMA_MATRICIA") return "Asma · Matricia";
  return humanizeTechnicalCode(code, locale);
}

export function humanizeTechnicalCode(code: string, locale: Locale): string {
  const cleaned = code
    .replace(/(?:^|[_\s-])E2E(?=$|[_\s-])/giu, " ")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!cleaned) return "—";
  const loc = locale === "ar" ? "ar" : "fr-FR";
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toLocaleUpperCase(loc) + part.slice(1).toLocaleLowerCase(loc))
    .join(" ");
}

export function franchiseTerritoryLabel(
  item: { territoryCode: string; territoryVersions: readonly TerritoryVersion[] },
  locale: Locale,
): string {
  const match =
    item.territoryVersions.find((version) => version.code === item.territoryCode) ??
    [...item.territoryVersions].sort((left, right) => right.version - left.version)[0];
  const name = match?.name?.trim();
  if (name) return name;
  return humanizeTechnicalCode(item.territoryCode, locale);
}

export function franchiseListTitle(
  item: {
    operatorCode: string;
    libraryNameFr: string;
    libraryNameAr: string;
    territoryCode: string;
    territoryVersions: readonly TerritoryVersion[];
  },
  locale: Locale,
): string {
  const operator = franchiseOperatorLabel(item.operatorCode, locale);
  const territory = franchiseTerritoryLabel(item, locale);
  return `${operator} · ${territory}`;
}
