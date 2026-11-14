import{z}from"zod";
import{getSupabaseServerClient}from"@/modules/shared/lib/supabase/server";
import type{AdminHistoryPage}from"@/modules/admin/screens/history/model";
import type{ConversationPage}from"@/modules/admin/screens/conversations/model";
import { loadAdminGovernanceDashboard } from "@/modules/admin/data/governance-disputes/repository";
import { loadAdminProviders } from "@/modules/admin/data/providers/repository";
import type { AdminProviderDashboard, AdminProvider, AdminProviderService, AdminProviderDocument } from "@/modules/admin/data/providers/model";
import type { AdminGovernanceDashboard } from "@/modules/admin/data/governance-disputes/model";
import { loadAdminSupervisionDashboard, type AdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import type { AdminSpaceId } from "./admin-nav";
import { canApplyAdminDemo, buildDemoSpaceRows } from "./demo-overlay";
import { franchiseListTitle, franchiseTerritoryLabel } from "./franchise-presentation";
import { buildFranchisesRowsFromGovernance, presentAuthorizedFranchisesRows } from "./franchises-presentation";
import { actorOrganizationLabel, isAdminOrgDirectoryFixture } from "./actor-presentation";
import { formatAdminDateTime } from "@/modules/admin/data/command-center/view-model";
import {
  isOperationalFixtureName,
  presentChannel,
  presentDateOnly,
  presentDateTime,
  presentMinor,
  presentObligation,
  presentOrgName,
  presentPersonPair,
} from "./present-space-row";
import { spaceHref, statusTone, type SpaceTone } from "./screen-catalog";
import { normalizeSpecialQueueRow } from "./special-queue-normalize";
import { buildTerritoiresRowsFromGovernance, presentAuthorizedTerritoiresRows } from "./territoires-presentation";
import { formatDiagnosticProgress, localizeDiagnosticRating, localizeStatus } from "./view-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type SpaceRow = {
  id: string;
  href: string;
  title: string;
  cells: string[];
  status: string;
  tone: SpaceTone;
  organizationId?: string;
  treat?: boolean;
  fixture?: boolean;
  extras?: Record<string, string>;
  history?: Array<{ id: string; action: string; occurredAt: string; actorType: string; actorLabel?:string|null;reason?:string }>;
  conversation?:ConversationPage|null;
  historyPage?:AdminHistoryPage|null;
};

export type SpaceSnapshot = {
  reason: "OK" | "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "UNAVAILABLE" | "INVALID_RESPONSE" | null;
  detailsReason?: "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "UNAVAILABLE" | "INVALID_RESPONSE";
  rows: SpaceRow[];
  treat: SpaceRow[];
  supervision: AdminSupervisionDashboard | null;
  providers: AdminProviderDashboard | null;
  governance: AdminGovernanceDashboard | null;
};

const specialSnapshotSpaces=new Set(["providers","qualification","capacite","franchises","territoires","gouvernance","litiges"]);
const specialRowsSchema=z.object({rows:z.array(z.object({id:z.string().uuid(),title:z.string(),status:z.string(),organizationId:z.string().uuid(),cells:z.array(z.string()),extras:z.record(z.string(),z.string())})).max(20000),snapshotAt:z.string(),complete:z.literal(true)});
function unavailableSnapshot(reason: SpaceSnapshot["reason"]): SpaceSnapshot {
  return { reason, rows: [], treat: [], supervision: null, providers: null, governance: null };
}
function readReason(reason: string): NonNullable<SpaceSnapshot["detailsReason"]> {
  return ["UNAUTHENTICATED", "FORBIDDEN", "MFA_REQUIRED", "INVALID_RESPONSE"].includes(reason)
    ? reason as NonNullable<SpaceSnapshot["detailsReason"]> : "UNAVAILABLE";
}
export async function loadAdminSpaceSnapshot(locale: Locale, space: AdminSpaceId, query: string, consistent = false): Promise<SpaceSnapshot> {
  try {
    if (!specialSnapshotSpaces.has(space)) return await loadBaseAdminSpaceSnapshot(locale, space, query, consistent);
    // These actor/governance queues have their own authorized projection. A
    // failure in an unrelated supervision reader must not replace their rows.
    const client = await getSupabaseServerClient();
    const response = await client.rpc("get_admin_special_space_snapshot_v1", { p_space: space, p_locale: locale });
    if (response.error) {
      if (["PT401", "PGRST301", "PGRST302", "PGRST303"].includes(response.error.code)) return unavailableSnapshot("UNAUTHENTICATED");
      if (response.error.code === "42501") {
        return unavailableSnapshot(/MFA|AAL2/i.test(response.error.message ?? "") ? "MFA_REQUIRED" : "FORBIDDEN");
      }
      return unavailableSnapshot("UNAVAILABLE");
    }
    const parsed = specialRowsSchema.safeParse(response.data);
    if (!parsed.success) return unavailableSnapshot("INVALID_RESPONSE");
    const snapshot = unavailableSnapshot(null);
    snapshot.rows = parsed.data.rows.map(row => ({ ...row, href: spaceHref(locale, space, query, row.id), tone: statusTone(row.status), treat: /PENDING|SUBMITTED|UNDER_REVIEW|IN_REVIEW|EXPIRED|REJECTED|SUSPENDED/.test(row.status) }));
    snapshot.treat = snapshot.rows.filter(row => row.treat);
    try {
      if (["providers", "qualification", "capacite"].includes(space)) {
        const details = await loadAdminProviders();
        if (details.status === "success") snapshot.providers = details.dashboard;
        else snapshot.detailsReason = readReason(details.reason);
      } else {
        const details = await loadAdminGovernanceDashboard(locale);
        if (details.status === "success") snapshot.governance = details.value;
        else snapshot.detailsReason = readReason(details.reason);
      }
    } catch { snapshot.detailsReason = "UNAVAILABLE"; }
    if (space === "territoires") {
      snapshot.rows = presentAuthorizedTerritoiresRows(locale, query, snapshot.rows, snapshot.governance);
      snapshot.treat = snapshot.rows.filter((row) => row.treat);
    } else if (space === "franchises") {
      snapshot.rows = presentAuthorizedFranchisesRows(locale, query, snapshot.rows, snapshot.governance);
      snapshot.treat = snapshot.rows.filter((row) => row.treat);
    } else if (space === "capacite" || space === "providers" || space === "qualification" || space === "gouvernance" || space === "litiges") {
      snapshot.rows = snapshot.rows.map((row) => normalizeSpecialQueueRow(locale, space, query, row));
      snapshot.treat = snapshot.rows.filter((row) => row.treat ?? /PENDING|SUBMITTED|UNDER_REVIEW|IN_REVIEW|EXPIRED|REJECTED|SUSPENDED/.test(row.status));
    }
    return finalizeOperationalRows(locale, snapshot);
  } catch { return unavailableSnapshot("UNAVAILABLE"); }
}

function sliceId(id: string) {
  return id.slice(0, 8);
}

async function loadBaseAdminSpaceSnapshot(locale: Locale, space: AdminSpaceId, query: string,consistent=false): Promise<SpaceSnapshot> {
  const [supervision, providers, governance] = await Promise.all([
    loadAdminSupervisionDashboard(120,consistent),
    ["providers", "qualification", "capacite", "documents"].includes(space) ? loadAdminProviders() : Promise.resolve(null),
    ["franchises", "territoires", "gouvernance", "litiges"].includes(space) ? loadAdminGovernanceDashboard(locale) : Promise.resolve(null),
  ]);

  const snapshot: SpaceSnapshot = {
    reason: null,
    rows: [],
    treat: [],
    supervision: supervision.status === "success" ? supervision.value : null,
    providers: providers && providers.status === "success" ? providers.dashboard : null,
    governance: governance && governance.status === "success" ? governance.value : null,
  };

  if (supervision.status === "error") snapshot.reason = readReason(supervision.reason);
  if (supervision.status === "error" && (supervision.reason === "UNAVAILABLE" || supervision.reason === "INVALID_RESPONSE")) snapshot.reason = supervision.reason;
  if (providers && providers.status === "error") { if (space === "documents") snapshot.detailsReason = readReason(providers.reason); else snapshot.reason = readReason(providers.reason); }
  if (governance && governance.status === "error") snapshot.reason = governance.reason === "MFA_REQUIRED" ? "MFA_REQUIRED" : governance.reason === "FORBIDDEN" ? "FORBIDDEN" : governance.reason === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : "UNAVAILABLE";

  const dash = snapshot.supervision;
  const providerDash = snapshot.providers;
  const gov = snapshot.governance;

  if (space === "providers" && providerDash) {
    snapshot.rows = providerDash.providers.map((item) => providerRow(locale, query, item, providerDash));
    snapshot.treat = snapshot.rows.filter((row) => /UNDER_REVIEW|REJECTED|SUSPENDED|PENDING/.test(row.status));
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "qualification" && providerDash) {
    snapshot.rows = providerDash.services.map((item) => qualificationRow(locale, query, item, providerDash));
    snapshot.treat = snapshot.rows.filter((row) => !/APPROVED/.test(row.status));
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "capacite" && providerDash) {
    snapshot.rows = providerDash.documents.map((item) => capacityRow(locale, query, item));
    snapshot.treat = snapshot.rows.filter((row) => /SUBMITTED|UNDER_REVIEW|EXPIRED|REJECTED/.test(row.status));
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "franchises" && gov?.franchise) {
    snapshot.rows = buildFranchisesRowsFromGovernance(locale, query, gov);
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "territoires" && gov?.franchise) {
    snapshot.rows = buildTerritoiresRowsFromGovernance(locale, query, gov);
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "gouvernance" && gov?.franchise) {
    snapshot.rows = gov.franchise.approvals.map((item) => {
      const franchise = gov.franchise?.franchises.find((entry) => entry.id === item.franchiseId);
      const name = franchise ? franchiseListTitle(franchise, locale) : sliceId(item.franchiseId);
      const territory = franchise ? franchiseTerritoryLabel(franchise, locale) : "—";
      const requestLabel = localizeTechnicalCode(item.requestType, locale);
      return {
        id: item.id,
        href: spaceHref(locale, "gouvernance", query, item.id, "decision"),
        title: requestLabel,
        cells: [sliceId(item.id), name, requestLabel, territory, String(item.rowVersion), "—", item.status, item.decision ? localizeTechnicalCode(item.decision.decision, locale) : "—"],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: franchise?.organizationId,
        treat: !item.decision,
        extras: { rowVersion: String(item.rowVersion), reason: item.reason },
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "matching" && dash) {
    snapshot.rows = (dash.matching ?? []).map((item) => {
      const orgName = presentOrgName(item.organization_name, locale);
      const fixture = isOperationalFixtureName(item.organization_name);
      return {
        id: item.id,
        href: spaceHref(locale, "matching", query, item.id),
        title: orgName,
        cells: [
          orgName,
          sliceId(item.request_id),
          String(item.eligible_count),
          String(item.excluded_count),
          item.eligible_count > 0 ? (locale === "ar" ? "مراجعة" : "Revue") : (locale === "ar" ? "بانتظار" : "En attente"),
          String(item.rfq_count),
          String(item.candidates.length || item.rfq_count),
          item.status,
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.organization_id,
        fixture,
        treat: !fixture && (item.rfq_count === 0 || item.eligible_count === 0),
        extras: {
          requestId: item.request_id,
          policy: item.policy_version,
          candidates: JSON.stringify(item.candidates),
          organizationName: orgName,
        },
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "contrats" && dash) {
    snapshot.rows = dash.contracts.map((item) => {
      const title = presentPersonPair(item.client_name, item.provider_name, locale);
      const fixture = isOperationalFixtureName(item.client_name, item.provider_name);
      return {
        id: item.id,
        href: spaceHref(locale, "contrats", query, item.id),
        title,
        cells: [
          sliceId(item.id),
          item.mission_id ? sliceId(item.mission_id) : "—",
          presentOrgName(item.client_name, locale),
          presentOrgName(item.provider_name, locale),
          String(item.current_version),
          String(item.signature_count),
          item.signature_count > 0 ? (locale === "ar" ? "موقّع جزئياً/كلياً" : "Signatures en cours") : (locale === "ar" ? "بانتظار التوقيع" : "En attente de signature"),
          item.status === "ACTIVE" ? (locale === "ar" ? "مفعّل" : "Activé") : "—",
          item.status,
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.client_organization_id,
        fixture,
        extras: { missionId: item.mission_id ?? "", signatures: String(item.signature_count) },
        treat: !fixture && /PENDING|DRAFT|SIGNATURE/i.test(item.status),
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "avenants" && dash) {
    snapshot.rows = dash.amendments.map((item) => {
      const title = presentPersonPair(item.client_name, item.provider_name, locale);
      const fixture = isOperationalFixtureName(item.client_name, item.provider_name);
      return {
        id: item.id,
        href: spaceHref(locale, "avenants", query, item.id),
        title,
        cells: [
          sliceId(item.id),
          sliceId(item.contract_id),
          locale === "ar" ? "تعديل تعاقدي" : "Modification contractuelle",
          String(item.amendment_number),
          "—",
          "—",
          /ACTIVE|ACTIV/i.test(item.status) ? (locale === "ar" ? "مفعّل" : "Activé") : (locale === "ar" ? "بانتظار التفعيل" : "En attente d’activation"),
          item.status,
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.client_organization_id,
        fixture,
        extras: { contractId: item.contract_id, amendment: String(item.amendment_number) },
        treat: !fixture && /DRAFT|PENDING/i.test(item.status),
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "documents" && dash) {
    snapshot.rows = dash.documents.map((item) => {
      const orgName = presentOrgName(item.organization_name, locale);
      const fixture = isOperationalFixtureName(item.organization_name);
      const kind = localizeTechnicalCode(item.kind, locale);
      return {
        id: item.id,
        href: spaceHref(locale, "documents", query, item.id),
        title: `${kind} · ${item.code}`,
        cells: [item.code, orgName, kind, "—", "—", `v${item.version}`, "—", "—", presentDateOnly(item.expires_on, locale), item.status],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.organization_id,
        fixture,
        extras: {
          kind: item.kind,
          version: String(item.version),
          statusCodes: item.expires_on && item.expires_on < new Date().toISOString().slice(0, 10) ? "EXPIRED" : item.expires_on && item.expires_on <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) ? "EXPIRING" : "",
        },
        treat: !fixture && /PENDING|SUBMITTED|UNDER_REVIEW|EXPIRED|REJECTED|QUARANTINED/i.test(item.status),
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "messagerie" && dash?.messages) {
    snapshot.rows = dash.messages.map((item) => {
      const fixture = isOperationalFixtureName(item.client_name, item.provider_name);
      return {
        id: item.id,
        href: spaceHref(locale, "messagerie", query, item.id),
        title: item.subject,
        cells: [
          `${presentOrgName(item.client_name, locale)} · ${presentOrgName(item.provider_name, locale)}`,
          `${presentOrgName(item.client_name, locale)} / ${presentOrgName(item.provider_name, locale)}`,
          sliceId(item.service_request_id),
          presentChannel("in-app", locale),
          presentDateTime(item.created_at, locale),
          "—",
          item.status,
          "—",
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.client_organization_id,
        fixture,
        treat: !fixture && item.status === "OPEN",
        extras: { rfqId: item.object_id, requestId: item.service_request_id, providerId: item.provider_organization_id },
      };
    });
    snapshot.rows.push(...(dash.notifications ?? []).map((item) => {
      const orgName = presentOrgName(item.organization_name, locale);
      const fixture = isOperationalFixtureName(item.organization_name);
      return {
        id: item.id,
        href: spaceHref(locale, "messagerie", query, item.id),
        title: localizeTechnicalCode(item.event_type, locale),
        cells: [
          localizeTechnicalCode(item.event_type, locale),
          orgName,
          locale === "ar" ? "إشعار" : "Notification",
          presentChannel(item.channel, locale),
          presentDateTime(item.updated_at, locale),
          item.read_at ? "0" : "1",
          item.status,
          localizeStatus(item.priority, locale),
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.organization_id,
        fixture,
        treat: !fixture && !item.read_at,
        extras: { kind: "NOTIFICATION", statusCodes: item.read_at ? "" : "UNREAD", errorCode: item.error_code ?? "", attemptCount: String(item.attempt_count) },
      };
    }));
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "diagnostics" && dash) {
    snapshot.rows = dash.diagnostics.map((item) => {
      const orgName = actorOrganizationLabel(item.organization_name, locale);
      const score = formatDiagnosticProgress(item.overall_score, locale);
      const fixture = isAdminOrgDirectoryFixture(item.organization_name);
      const activity = item.completed_at ? formatAdminDateTime(item.completed_at, locale) : (locale === "ar" ? "بدون نشاط مسجّل" : "Aucune activité enregistrée");
      const diagnosticTitle = locale === "ar"
        ? (item.questionnaire_title_ar?.trim() || item.questionnaire_title_fr?.trim() || "تشخيص مؤسسي")
        : (item.questionnaire_title_fr?.trim() || item.questionnaire_title_ar?.trim() || "Diagnostic entreprise");
      const versionValue = item.questionnaire_version == null || item.questionnaire_version === ""
        ? null
        : Number(item.questionnaire_version);
      const versionLabel = versionValue != null && Number.isFinite(versionValue)
        ? `v${versionValue}`
        : (locale === "ar" ? "—" : "—");
      return {
        id: item.id,
        href: spaceHref(locale, "diagnostics", query, item.id),
        title: orgName,
        cells: [
          orgName,
          diagnosticTitle,
          versionLabel,
          score.label,
          localizeDiagnosticRating(item.rating, locale),
          activity,
          item.status,
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.organization_id,
        fixture,
        treat: !fixture && /DRAFT|IN_PROGRESS|STARTED|RUNNING|IN_REVIEW|STALE|SUBMITTED/i.test(item.status),
        extras: { scorePercent: String(Math.round(score.percent)), progressPercent: String(Math.round(score.percent)) },
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if ((space === "demandes" || space === "matching") && dash) {
    snapshot.rows = dash.requests.map((item) => {
      const orgName = presentOrgName(item.organization_name, locale);
      const fixture = isOperationalFixtureName(item.organization_name);
      return {
        id: item.id,
        href: spaceHref(locale, space, query, item.id),
        title: orgName,
        cells: space === "matching"
          ? [
              orgName,
              sliceId(item.service_id),
              String(item.matching_runs),
              String(item.rfq_count),
              item.matching_runs > 0 ? (locale === "ar" ? "مراجعة" : "Revue") : (locale === "ar" ? "بانتظار" : "En attente"),
              String(item.rfq_count),
              String(item.quote_count),
              localizeStatus(item.status, locale),
            ]
          : [
              orgName,
              locale === "ar" ? "طلب خدمة" : "Demande de service",
              "—",
              locale === "ar" ? "طلب عروض" : "Consultation RFQ",
              item.rfq_count > 0 ? `${item.rfq_count}` : "0",
              String(item.matching_runs),
              String(item.quote_count),
              localizeStatus(item.status, locale),
            ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.organization_id,
        fixture,
        treat: !fixture && (item.matching_runs === 0 || /DRAFT|BLOCKED/i.test(item.status)),
        extras: { serviceId: item.service_id, libraryId: item.library_id },
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "devis" && dash) {
    snapshot.rows = dash.quotes.map((item) => {
      const provider = presentOrgName(item.provider_name, locale);
      const client = presentOrgName(item.client_name, locale);
      const fixture = isOperationalFixtureName(item.provider_name, item.client_name);
      const currency = item.currency ?? "MAD";
      return {
        id: item.id,
        href: spaceHref(locale, "devis", query, item.id),
        title: `${client} · ${provider}`,
        cells: [
          sliceId(item.id),
          sliceId(item.request_id),
          provider,
          item.version_number?.toString() ?? "—",
          "—",
          presentMinor(item.subtotal_minor, currency, locale),
          presentMinor(item.tax_minor, currency, locale),
          presentMinor(item.total_minor, currency, locale),
          presentDateOnly(item.valid_until, locale),
          "—",
          item.status,
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.provider_organization_id,
        fixture,
        treat: !fixture && /REVIEW|PENDING|RECEIVED/i.test(item.status),
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "jalons" && dash) {
    snapshot.rows = (dash.milestones ?? []).map((item) => {
      const title = locale === "ar" ? item.title_ar : item.title_fr;
      const fixture = isOperationalFixtureName(item.owner_name, title);
      return {
        id: item.id,
        href: spaceHref(locale, space, query, item.id),
        title,
        cells: [
          sliceId(item.mission_id),
          title,
          item.deliverable_count > 0 ? (locale === "ar" ? `${item.deliverable_count} تسليم` : `${item.deliverable_count} livrable(s)`) : "—",
          presentOrgName(item.owner_name, locale),
          presentDateTime(item.due_at, locale),
          String(item.proof_count),
          localizeStatus(item.status, locale),
          "—",
          localizeStatus(item.status, locale),
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.organization_id,
        fixture,
        extras: {
          missionId: item.mission_id,
          statusCodes: item.due_at && new Date(item.due_at) < new Date() && !["ACCEPTED", "REJECTED"].includes(item.status) ? "OVERDUE" : "",
        },
        treat: !fixture && (item.status === "SUBMITTED" || item.status === "REJECTED"),
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "missions" && dash) {
    snapshot.rows = dash.missions.map((item) => {
      const title = presentPersonPair(item.client_name, item.provider_name, locale);
      const fixture = isOperationalFixtureName(item.client_name, item.provider_name);
      return {
        id: item.id,
        href: spaceHref(locale, space, query, item.id),
        title,
        cells: [
          sliceId(item.id),
          sliceId(item.contract_id),
          presentOrgName(item.client_name, locale),
          presentOrgName(item.provider_name, locale),
          `${item.milestone_count}`,
          item.milestone_count > 0 ? (locale === "ar" ? `التالي ضمن ${item.milestone_count}` : `Prochain parmi ${item.milestone_count}`) : "—",
          String(item.deliverable_count),
          "—",
          item.status,
        ],
        status: item.status,
        tone: statusTone(item.status),
        organizationId: item.client_organization_id,
        fixture,
        extras: { contractId: item.contract_id, providerId: item.provider_organization_id },
        treat: !fixture && /BLOCKED|PENDING|START|CLOSUR/.test(item.status),
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "documents" && providerDash) {
    snapshot.rows = providerDash.documents.map((item) => documentRow(locale, query, item));
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "messagerie") {
    return overlayDemo(locale, space, query, snapshot);
  }
  if (space === "litiges" && gov) {
    snapshot.rows = gov.disputes.map((item) => {
      const obligation = presentObligation(item.obligationKey, locale);
      return {
        id: item.id,
        href: spaceHref(locale, "litiges", query, item.id),
        title: obligation,
        cells: [
          sliceId(item.id),
          sliceId(item.missionId),
          "—",
          obligation,
          item.latestDecision ? String(item.latestDecision.evidenceCount) : "—",
          "—",
          item.reassignment?.status ? localizeStatus(item.reassignment.status, locale) : "—",
          item.latestDecision?.outcome ? localizeTechnicalCode(item.latestDecision.outcome, locale) : "—",
          item.status,
        ],
        status: item.status,
        tone: item.urgency === "URGENT" ? "peach" : statusTone(item.status),
        treat: item.urgency === "URGENT" || !item.latestDecision,
        extras: { missionId: item.missionId, policy: item.policyVersion },
      };
    });
    snapshot.treat = snapshot.rows.filter((row) => row.treat);
    return overlayDemo(locale, space, query, snapshot);
  }

  return overlayDemo(locale, space, query, snapshot);
}

function finalizeOperationalRows(locale: Locale, snapshot: SpaceSnapshot): SpaceSnapshot {
  snapshot.rows = snapshot.rows.map((row) => {
    const cleanedTitle = presentOrgName(row.title, locale);
    const cleanedCells = row.cells.map((cell) => {
      if (isOperationalFixtureName(cell) || /e2e|uuid|[0-9a-f]{8}-[0-9a-f]{4}/iu.test(cell)) {
        return presentOrgName(cell, locale);
      }
      return cell;
    });
    const fixture = row.fixture || isOperationalFixtureName(row.title, ...row.cells);
    return {
      ...row,
      title: cleanedTitle === (locale === "ar" ? "بدون مؤسسة" : "Sans organisation") && row.title.trim() ? row.title : (isOperationalFixtureName(row.title) ? cleanedTitle : row.title),
      cells: cleanedCells,
      fixture,
      treat: fixture ? false : row.treat,
    };
  });
  snapshot.treat = snapshot.rows.filter((row) => row.treat && !row.fixture);
  return snapshot;
}

function overlayDemo(locale: Locale, space: AdminSpaceId, query: string, snapshot: SpaceSnapshot) {
  if (snapshot.reason && snapshot.reason !== "OK") {
    return snapshot;
  }
  if (snapshot.rows.length === 0 && canApplyAdminDemo()) {
    snapshot.rows = buildDemoSpaceRows(locale, space, query);
  }
  return finalizeOperationalRows(locale, snapshot);
}

function providerRow(locale: Locale, query: string, item: AdminProvider, dashboard: AdminProviderDashboard): SpaceRow {
  const services = dashboard.services.filter((row) => row.providerOrganizationId === item.organizationId);
  const docs = dashboard.documents.filter((row) => row.providerOrganizationId === item.organizationId);
  const quals = services.filter((row) => row.qualificationStatus && row.qualificationStatus !== "NONE");
  const approved = quals.filter((row) => row.qualificationStatus === "APPROVED" || row.eligible).length;
  const serviceLabel = [...new Set(services.map((row) => row.serviceCode).filter(Boolean))].slice(0, 3).join(", ") || "—";
  const qualificationLabel = quals.length
    ? `${approved}/${quals.length}`
    : (locale === "ar" ? "بلا تأهيل" : "Sans qualification");
  const capacityLabel = docs.length
    ? `${docs.filter((row) => /VERIFIED|APPROVED|VALID/i.test(row.status)).length}/${docs.length}`
    : (locale === "ar" ? "بلا وثائق" : "Sans documents");
  const name = presentOrgName(item.organizationName, locale);
  const fixture = isOperationalFixtureName(item.organizationName);
  return {
    id: item.organizationId,
    href: `/${locale}/administration/providers/${item.organizationId}${query}`,
    title: name,
    cells: [name, serviceLabel, qualificationLabel, capacityLabel, String(docs.length), localizeStatus(item.partnerContractStatus, locale)],
    status: item.overallStatus,
    tone: statusTone(item.companyStatus),
    organizationId: item.organizationId,
    fixture,
    extras: { rowVersion: String(item.rowVersion), partner: item.partnerContractStatus },
    treat: !fixture && item.companyStatus !== "VERIFIED",
  };
}

function localizeTechnicalCode(code: string, locale: Locale) {
  const known: Record<string, [string, string]> = {
    CAPACITY_NOT_DECLARED: ["Capacité non déclarée", "القدرة غير مصرّح بها"],
    DOCUMENT_MISSING: ["Document manquant", "وثيقة ناقصة"],
    DOCUMENT_EXPIRED: ["Document expiré", "وثيقة منتهية"],
    IDENTITY_UNVERIFIED: ["Identité non vérifiée", "الهوية غير متحققة"],
    SERVICE_NOT_REQUESTED: ["Service non demandé", "الخدمة غير مطلوبة"],
    MANDATE_CREATE: ["Création de mandat", "إنشاء تفويض"],
    MANDATE_RENEW: ["Renouvellement de mandat", "تجديد تفويض"],
    MANDATE_SUSPEND: ["Suspension de mandat", "تعليق تفويض"],
    APPROVE: ["Approuver", "اعتماد"],
    REJECT: ["Refuser", "رفض"],
  };
  const hit = known[code];
  if (hit) return locale === "ar" ? hit[1] : hit[0];
  return code.replaceAll("_", " ").toLowerCase().replace(/^\w/u, (char) => char.toUpperCase());
}

function qualificationRow(locale: Locale, query: string, item: AdminProviderService, dashboard: AdminProviderDashboard): SpaceRow {
  const docs = dashboard.documents.filter((row) => row.providerOrganizationId === item.providerOrganizationId);
  const name = presentOrgName(item.providerName, locale);
  const fixture = isOperationalFixtureName(item.providerName);
  return {
    id: item.qualificationId ?? item.id,
    href: spaceHref(locale, "qualification", query, item.qualificationId ?? item.id, "decision"),
    title: name,
    cells: [
      name,
      item.serviceCode,
      String(docs.length),
      item.eligible ? (locale === "ar" ? "مؤهل" : "Éligible") : (locale === "ar" ? "غير مؤهل" : "Non éligible"),
      localizeStatus(item.qualificationStatus, locale),
      item.eligibilityReasons[0] ? localizeTechnicalCode(item.eligibilityReasons[0], locale) : "—",
    ],
    status: item.qualificationStatus,
    tone: statusTone(item.qualificationStatus),
    organizationId: item.providerOrganizationId,
    fixture,
    extras: { serviceId: item.id, rowVersion: String(item.qualificationRowVersion ?? 1) },
    treat: !fixture && item.qualificationStatus !== "APPROVED",
  };
}

function capacityRow(locale: Locale, query: string, item: AdminProviderDocument): SpaceRow {
  const name = presentOrgName(item.providerName, locale);
  const kind = localizeTechnicalCode(item.kind, locale);
  const fixture = isOperationalFixtureName(item.providerName);
  return {
    id: item.id,
    href: spaceHref(locale, "capacite", query, item.id),
    title: `${name} · ${item.code}`,
    cells: [
      name,
      item.code,
      localizeStatus(item.status, locale),
      kind,
      `v${item.version}`,
      `${kind} · ${item.code}`,
      presentDateOnly(item.expiresOn, locale),
    ],
    status: item.status,
    tone: statusTone(item.status),
    organizationId: item.providerOrganizationId,
    fixture,
    extras: { kind: item.kind, version: String(item.version), rowVersion: "1" },
    treat: !fixture && /SUBMITTED|UNDER_REVIEW|EXPIRED/.test(item.status),
  };
}

function documentRow(locale: Locale, query: string, item: AdminProviderDocument): SpaceRow {
  const name = presentOrgName(item.providerName, locale);
  const kind = localizeTechnicalCode(item.kind, locale);
  const fixture = isOperationalFixtureName(item.providerName);
  return {
    id: item.id,
    href: spaceHref(locale, "documents", query, item.id),
    title: `${kind} · ${item.code}`,
    cells: [item.code, name, kind, "—", "—", `v${item.version}`, "—", "—", presentDateOnly(item.expiresOn, locale), item.status],
    status: item.status,
    tone: statusTone(item.status),
    organizationId: item.providerOrganizationId,
    fixture,
    extras: { kind: item.kind, version: String(item.version) },
    treat: !fixture && /SUBMITTED|UNDER_REVIEW|EXPIRED/.test(item.status),
  };
}

export function findSpaceRow(snapshot: SpaceSnapshot, itemId: string) {
  return snapshot.rows.find((row) => row.id === itemId) ?? snapshot.treat.find((row) => row.id === itemId) ?? null;
}
