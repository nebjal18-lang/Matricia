import { createHash } from "node:crypto";
import { demoRegionalIds } from "@/app/[locale]/connexion/demo-regional-ensure";
import {
  listDemoRegionalActors,
  listDemoRegionalTerritories,
} from "@/app/[locale]/connexion/demo-regional-directory";
import { isDemoClientHomeEnabled } from "@/modules/client/data/home/demo-scenario";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminSpaceId } from "./admin-nav";
import { spaceHref, statusTone } from "./screen-catalog";
import type { SpaceRow } from "./space-data";

export function canApplyAdminDemoSpecialSpaces() {
  return isDemoClientHomeEnabled();
}

function demoId(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_SPECIAL_SPACE_V1:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function territoryLabel(code: string, nameFr: string, nameAr: string, locale: Locale) {
  return locale === "ar" ? nameAr : nameFr.replace(/_/gu, "-") || code;
}

function territoiresRows(locale: Locale, query: string): SpaceRow[] {
  return listDemoRegionalTerritories().flatMap((territory) => {
    const franchise = listDemoRegionalActors(territory.code).find((item) => item.kind === "franchise");
    if (!franchise) return [];
    const orgId = demoRegionalIds(franchise).organizationId;
    const mandateId = demoId(`mandate:${territory.code}`);
    const title = `${franchise.labelFr} · ${territory.nameFr}`;
    const library = locale === "ar" ? "مكتبة الإقليم" : "Bibliothèque régionale";
    const status = territory.code === "ORIENTAL" || territory.code === "DRAA_TAFILALET" ? "CONTRACT_PENDING" : "ACTIVE";
    return [
      {
        id: mandateId,
        href: spaceHref(locale, "territoires", query, mandateId),
        title,
        cells: [
          title,
          territoryLabel(territory.code, territory.nameFr, territory.nameAr, locale),
          library,
          "v1",
          "2026-01-01",
          status === "ACTIVE" ? "—" : "2026-12-31",
          status,
        ],
        status,
        tone: statusTone(status),
        organizationId: orgId,
        treat: status !== "ACTIVE",
        extras: {
          franchiseId: demoId(`franchise:${territory.code}`),
          territoryCode: territory.code,
          libraryCode: "REGIONAL",
          type: territory.code.includes("CASABLANCA") ? "IT" : "STANDARD",
        },
      },
    ];
  });
}

function gouvernanceRows(locale: Locale, query: string): SpaceRow[] {
  const statuses = ["PENDING", "PENDING", "APPROVED", "REJECTED", "PENDING"] as const;
  return listDemoRegionalTerritories().slice(0, 8).flatMap((territory, index) => {
    const franchise = listDemoRegionalActors(territory.code).find((item) => item.kind === "franchise");
    if (!franchise) return [];
    const orgId = demoRegionalIds(franchise).organizationId;
    const id = demoId(`approval:${territory.code}`);
    const status = statuses[index % statuses.length]!;
    const objectLabel = locale === "ar" ? "اعتماد التفويض" : "Approbation de mandat";
    const risk = index % 3 === 0 ? (locale === "ar" ? "مرتفع" : "Élevé") : locale === "ar" ? "متوسط" : "Moyen";
    return [
      {
        id,
        href: spaceHref(locale, "gouvernance", query, id),
        title: objectLabel,
        cells: [
          id.slice(0, 8),
          franchise.labelFr,
          objectLabel,
          territoryLabel(territory.code, territory.nameFr, territory.nameAr, locale),
          "v1",
          risk,
          status,
          status === "PENDING" ? (locale === "ar" ? "مراجع مستقل" : "Revue indépendante") : "—",
        ],
        status,
        tone: statusTone(status),
        organizationId: orgId,
        treat: status === "PENDING",
        extras: {
          franchiseId: demoId(`franchise:${territory.code}`),
          territoryCode: territory.code,
          requestType: "MANDATE_APPROVAL",
        },
      },
    ];
  });
}

function litigesRows(locale: Locale, query: string): SpaceRow[] {
  return listDemoRegionalTerritories().slice(0, 6).flatMap((territory, index) => {
    const actors = listDemoRegionalActors(territory.code);
    const client = actors.find((item) => item.kind === "client" && item.slot === "1");
    const provider = actors.find((item) => item.kind === "provider" && item.slot === "A");
    if (!client || !provider) return [];
    const id = demoId(`dispute:${territory.code}`);
    const missionId = demoId(`mission:${territory.code}`);
    const status = index % 2 === 0 ? "OPEN" : "IN_REVIEW";
    const motif = locale === "ar" ? "تأخير التسليم" : "Retard de livrable";
    const parties = `${client.labelFr} · ${provider.labelFr}`;
    return [
      {
        id,
        href: spaceHref(locale, "litiges", query, id),
        title: motif,
        cells: [
          id.slice(0, 8),
          missionId.slice(0, 8),
          parties,
          motif,
          String(1 + (index % 3)),
          "—",
          index % 3 === 0 ? (locale === "ar" ? "جارية" : "En cours") : "—",
          status === "IN_REVIEW" ? (locale === "ar" ? "مراجعة" : "Revue") : "—",
          status,
        ],
        status,
        tone: statusTone(status),
        organizationId: demoRegionalIds(client).organizationId,
        treat: status === "OPEN",
        extras: {
          missionId,
          policy: "v1",
          providerId: demoRegionalIds(provider).organizationId,
        },
      },
    ];
  });
}

/** Overlay pour le chemin RPC `specialSnapshotSpaces` (territoires / gouvernance / litiges). */
export function buildDemoSpecialSpaceRows(
  locale: Locale,
  space: AdminSpaceId,
  query: string,
): SpaceRow[] | null {
  if (!canApplyAdminDemoSpecialSpaces()) return null;
  if (space === "territoires") return territoiresRows(locale, query);
  if (space === "gouvernance") return gouvernanceRows(locale, query);
  if (space === "litiges") return litigesRows(locale, query);
  return null;
}
