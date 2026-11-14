import type { AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { AdminDirectoryGroup } from "./directory";
import { normalizeOrgTypeCodes } from "./directory";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type HubKpi = {
  id: string;
  label: string;
  value: number;
  tone: "violet" | "peach" | "mint" | "amber" | "sky" | "plum";
};

export type HubMetrics = {
  kpis: HubKpi[];
};

type Dash = AdminSupervisionDashboard | null | undefined;

function t(locale: Locale, fr: string, ar: string) {
  return locale === "ar" ? ar : fr;
}

export function buildHubMetrics(
  groupId: "home" | AdminDirectoryGroup["id"],
  dash: Dash,
  locale: Locale,
): HubMetrics {
  const orgs = dash?.organizations ?? [];
  const requests = dash?.requests ?? [];
  const quotes = dash?.quotes ?? [];
  const missions = dash?.missions ?? [];
  const diagnostics = dash?.diagnostics ?? [];
  const contracts = dash?.contracts ?? [];
  const amendments = dash?.amendments ?? [];
  const documents = dash?.documents ?? [];
  const disputes = orgs.reduce((sum, org) => sum + org.open_disputes, 0);
  const openRequests = orgs.reduce((sum, org) => sum + org.open_requests, 0);
  const clients = orgs.filter((org) => normalizeOrgTypeCodes(org.role_codes ?? []).includes("CLIENT")).length;
  const providers = orgs.filter((org) => normalizeOrgTypeCodes(org.role_codes ?? []).includes("PROVIDER")).length;
  const franchises = orgs.filter((org) => normalizeOrgTypeCodes(org.role_codes ?? []).includes("FRANCHISE")).length;
  const pendingOrgs = orgs.filter((org) => /PENDING|SUSPENDED|ARCHIVED/i.test(org.status)).length;

  if (groupId === "home") {
    return {
      kpis: [
        { id: "orgs", label: t(locale, "Organisations", "المؤسسات"), value: orgs.length, tone: "violet" },
        { id: "requests", label: t(locale, "Demandes ouvertes", "طلبات مفتوحة"), value: openRequests, tone: "peach" },
        { id: "missions", label: t(locale, "Missions", "المهام"), value: missions.length, tone: "mint" },
        { id: "disputes", label: t(locale, "Litiges ouverts", "نزاعات مفتوحة"), value: disputes, tone: "amber" },
      ],
    };
  }

  if (groupId === "actors") {
    return {
      kpis: [
        { id: "clients", label: t(locale, "Clients", "العملاء"), value: clients, tone: "violet" },
        { id: "providers", label: t(locale, "Prestataires", "مقدمو الخدمات"), value: providers, tone: "sky" },
        { id: "franchises", label: t(locale, "Franchisés", "أصحاب الامتياز"), value: franchises, tone: "mint" },
        { id: "pending", label: t(locale, "À surveiller", "للمراقبة"), value: pendingOrgs, tone: "peach" },
      ],
    };
  }

  if (groupId === "parcours") {
    return {
      kpis: [
        { id: "diag", label: t(locale, "Diagnostics", "التشخيصات"), value: diagnostics.length, tone: "peach" },
        { id: "requests", label: t(locale, "Demandes", "الطلبات"), value: requests.length, tone: "violet" },
        { id: "quotes", label: t(locale, "Devis", "العروض"), value: quotes.length, tone: "amber" },
        { id: "missions", label: t(locale, "Missions", "المهام"), value: missions.length, tone: "mint" },
      ],
    };
  }

  if (groupId === "catalog") {
    return {
      kpis: [
        { id: "requests", label: t(locale, "Demandes liées", "طلبات مرتبطة"), value: requests.length, tone: "violet" },
        { id: "quotes", label: t(locale, "Offres liées", "عروض مرتبطة"), value: quotes.length, tone: "amber" },
        { id: "docs", label: t(locale, "Preuves", "الأدلة"), value: documents.length, tone: "sky" },
        { id: "diag", label: t(locale, "Diagnostics liés", "تشخيصات مرتبطة"), value: diagnostics.length, tone: "mint" },
      ],
    };
  }

  if (groupId === "finance") {
    return {
      kpis: [
        { id: "contracts", label: t(locale, "Contrats", "العقود"), value: contracts.length, tone: "amber" },
        { id: "amendments", label: t(locale, "Avenants", "الملاحق"), value: amendments.length, tone: "peach" },
        { id: "missions", label: t(locale, "Missions actives", "مهام نشطة"), value: missions.filter((item) => item.status === "ACTIVE").length, tone: "mint" },
        { id: "signed", label: t(locale, "Signatures", "التوقيعات"), value: contracts.reduce((sum, item) => sum + item.signature_count, 0), tone: "violet" },
      ],
    };
  }

  if (groupId === "growth") {
    return {
      kpis: [
        { id: "disputes", label: t(locale, "Litiges ouverts", "نزاعات مفتوحة"), value: disputes, tone: "peach" },
        { id: "pending", label: t(locale, "Orgs à surveiller", "مؤسسات للمراقبة"), value: pendingOrgs, tone: "amber" },
        { id: "requests", label: t(locale, "Demandes ouvertes", "طلبات مفتوحة"), value: openRequests, tone: "sky" },
        { id: "docs", label: t(locale, "Documents", "الوثائق"), value: documents.length, tone: "violet" },
      ],
    };
  }

  return {
    kpis: [
      { id: "orgs", label: t(locale, "Organisations", "المؤسسات"), value: orgs.length, tone: "plum" },
      { id: "docs", label: t(locale, "Documents", "الوثائق"), value: documents.length, tone: "sky" },
      { id: "missions", label: t(locale, "Missions", "المهام"), value: missions.length, tone: "mint" },
      { id: "pending", label: t(locale, "À surveiller", "للمراقبة"), value: pendingOrgs + disputes, tone: "peach" },
    ],
  };
}
