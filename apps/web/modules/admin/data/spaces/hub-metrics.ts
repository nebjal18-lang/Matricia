import type { AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";
import type { AdminSpaceId } from "./admin-nav";
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

/** KPIs métier par hub Parcours (pas seulement le strip groupé). */
export function buildSpaceHubMetrics(space: AdminSpaceId, dash: Dash, locale: Locale): HubMetrics {
  const diagnostics = dash?.diagnostics ?? [];
  const requests = dash?.requests ?? [];
  const matching = dash?.matching ?? [];
  const quotes = dash?.quotes ?? [];
  const contracts = dash?.contracts ?? [];
  const amendments = dash?.amendments ?? [];
  const missions = dash?.missions ?? [];
  const milestones = dash?.milestones ?? [];
  const documents = dash?.documents ?? [];
  const messages = dash?.messages ?? [];
  const notifications = dash?.notifications ?? [];
  const exceptions = dash?.exceptions ?? [];

  if (space === "diagnostics") {
    return {
      kpis: [
        { id: "total", label: t(locale, "Diagnostics", "تشخيصات"), value: diagnostics.length, tone: "violet" },
        { id: "review", label: t(locale, "À revoir", "للمراجعة"), value: diagnostics.filter((item) => /DRAFT|IN_PROGRESS|STALE|IN_REVIEW/i.test(item.status)).length, tone: "peach" },
        { id: "done", label: t(locale, "Terminés", "منتهية"), value: diagnostics.filter((item) => /COMPLETED|SUBMITTED/i.test(item.status)).length, tone: "mint" },
        { id: "requests", label: t(locale, "Demandes liées", "طلبات مرتبطة"), value: requests.length, tone: "sky" },
      ],
    };
  }
  if (space === "demandes") {
    return {
      kpis: [
        { id: "total", label: t(locale, "Demandes", "طلبات"), value: requests.length, tone: "violet" },
        { id: "incomplete", label: t(locale, "À compléter", "للاستكمال"), value: requests.filter((item) => /DRAFT|INCOMPLETE/i.test(item.status) || (item.completeness_percent ?? 100) < 80).length, tone: "peach" },
        { id: "open", label: t(locale, "Ouvertes", "مفتوحة"), value: requests.filter((item) => /OPEN|RFQ/i.test(item.status)).length, tone: "sky" },
        { id: "quotes", label: t(locale, "Avec offres", "بعروض"), value: requests.filter((item) => item.quote_count > 0).length, tone: "mint" },
      ],
    };
  }
  if (space === "matching") {
    return {
      kpis: [
        { id: "runs", label: t(locale, "Passages", "مرورات"), value: matching.length || requests.length, tone: "violet" },
        { id: "review", label: t(locale, "À revoir", "للمراجعة"), value: matching.filter((item) => item.eligible_count === 0 || item.excluded_count > 0 || item.rfq_count === 0).length, tone: "peach" },
        { id: "eligible", label: t(locale, "Éligibles", "مؤهلون"), value: matching.reduce((sum, item) => sum + item.eligible_count, 0), tone: "mint" },
        { id: "excluded", label: t(locale, "Exclus", "مستبعدون"), value: matching.reduce((sum, item) => sum + item.excluded_count, 0), tone: "amber" },
      ],
    };
  }
  if (space === "devis") {
    return {
      kpis: [
        { id: "total", label: t(locale, "Devis", "عروض"), value: quotes.length, tone: "violet" },
        { id: "review", label: t(locale, "À revoir", "للمراجعة"), value: quotes.filter((item) => /SUBMITTED|IN_REVIEW|RECEIVED/i.test(item.status)).length, tone: "peach" },
        { id: "selected", label: t(locale, "Sélectionnés", "مختارة"), value: quotes.filter((item) => /SELECTED|ACCEPTED/i.test(item.status)).length, tone: "mint" },
        { id: "expired", label: t(locale, "Expirés", "منتهية"), value: quotes.filter((item) => /EXPIRED|REJECTED/i.test(item.status)).length, tone: "amber" },
      ],
    };
  }
  if (space === "contrats") {
    return {
      kpis: [
        { id: "total", label: t(locale, "Contrats", "عقود"), value: contracts.length, tone: "violet" },
        { id: "signatures", label: t(locale, "Signatures en attente", "توقيعات معلّقة"), value: contracts.filter((item) => item.signature_count < 2 || /READY_FOR_SIGNATURE|SIGNING|DRAFT/i.test(item.status)).length, tone: "peach" },
        { id: "active", label: t(locale, "Actifs", "نشطة"), value: contracts.filter((item) => item.status === "ACTIVE").length, tone: "mint" },
        { id: "noMission", label: t(locale, "Sans mission", "بدون مهمة"), value: contracts.filter((item) => item.status === "ACTIVE" && !item.mission_id).length, tone: "amber" },
      ],
    };
  }
  if (space === "avenants") {
    return {
      kpis: [
        { id: "total", label: t(locale, "Avenants", "ملاحق"), value: amendments.length, tone: "violet" },
        { id: "draft", label: t(locale, "Brouillons", "مسودات"), value: amendments.filter((item) => /DRAFT|IN_REVIEW/i.test(item.status)).length, tone: "peach" },
        { id: "active", label: t(locale, "Activés", "مفعّلة"), value: amendments.filter((item) => /ACTIVE|ACTIV/i.test(item.status)).length, tone: "mint" },
        { id: "delta", label: t(locale, "Avec delta", "بفرق سعر"), value: amendments.filter((item) => Boolean(item.price_delta_minor && item.price_delta_minor !== "0")).length, tone: "sky" },
      ],
    };
  }
  if (space === "missions") {
    return {
      kpis: [
        { id: "total", label: t(locale, "Missions", "مهام"), value: missions.length, tone: "violet" },
        { id: "blocked", label: t(locale, "Bloquées", "محظورة"), value: missions.filter((item) => /BLOCKED|SUSPEND/i.test(item.status)).length, tone: "peach" },
        { id: "active", label: t(locale, "Actives", "نشطة"), value: missions.filter((item) => item.status === "ACTIVE").length, tone: "mint" },
        { id: "milestones", label: t(locale, "Jalons", "معالم"), value: milestones.length, tone: "sky" },
      ],
    };
  }
  if (space === "jalons") {
    return {
      kpis: [
        { id: "total", label: t(locale, "Jalons", "معالم"), value: milestones.length, tone: "violet" },
        { id: "submitted", label: t(locale, "SUBMITTED", "مقدَّمة"), value: milestones.filter((item) => item.status === "SUBMITTED").length, tone: "peach" },
        { id: "pending", label: t(locale, "En attente", "معلّقة"), value: milestones.filter((item) => item.status === "PENDING").length, tone: "sky" },
        { id: "rejected", label: t(locale, "Rejetés / retard", "مرفوضة / تأخير"), value: milestones.filter((item) => /REJECTED|OVERDUE/i.test(item.status)).length, tone: "amber" },
      ],
    };
  }
  if (space === "documents") {
    return {
      kpis: [
        { id: "total", label: t(locale, "Documents", "وثائق"), value: documents.length, tone: "violet" },
        { id: "review", label: t(locale, "À examiner", "للمعاينة"), value: documents.filter((item) => /PENDING|SUBMITTED|UNDER_REVIEW|EXPIRING|EXPIRED/i.test(item.status)).length, tone: "peach" },
        { id: "ok", label: t(locale, "Conformes", "مطابقة"), value: documents.filter((item) => /VERIFIED|CLEAN/i.test(item.status)).length, tone: "mint" },
        { id: "expiring", label: t(locale, "À renouveler", "للتجديد"), value: documents.filter((item) => /EXPIR/i.test(item.status)).length, tone: "amber" },
      ],
    };
  }
  if (space === "messagerie") {
    return {
      kpis: [
        { id: "threads", label: t(locale, "Conversations", "محادثات"), value: messages.length, tone: "violet" },
        { id: "open", label: t(locale, "Ouvertes", "مفتوحة"), value: messages.filter((item) => item.status === "OPEN").length, tone: "peach" },
        { id: "notif", label: t(locale, "Notifications", "إشعارات"), value: notifications.length, tone: "sky" },
        { id: "unread", label: t(locale, "Non lues", "غير مقروءة"), value: notifications.filter((item) => !item.read_at).length, tone: "amber" },
      ],
    };
  }
  if (space === "litiges") {
    return {
      kpis: [
        { id: "open", label: t(locale, "Ouverts", "مفتوحة"), value: exceptions.filter((item) => item.status === "OPEN").length, tone: "peach" },
        { id: "high", label: t(locale, "Priorité haute", "أولوية عالية"), value: exceptions.filter((item) => /HIGH|CRITICAL/i.test(item.priority)).length, tone: "amber" },
        { id: "missions", label: t(locale, "Missions liées", "مهام مرتبطة"), value: missions.length, tone: "violet" },
        { id: "total", label: t(locale, "Exceptions", "استثناءات"), value: exceptions.length, tone: "sky" },
      ],
    };
  }
  return { kpis: [] };
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
