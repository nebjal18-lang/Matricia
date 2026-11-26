import { createHash } from "node:crypto";
import { demoRegionalIds } from "@/app/[locale]/connexion/demo-regional-ensure";
import {
  listDemoRegionalActors,
  listDemoRegionalTerritories,
} from "@/app/[locale]/connexion/demo-regional-directory";
import type { AdminSupervisionDashboard } from "@/modules/admin/data/supervision/types";

function demoId(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_FILM_V1:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const LIBRARY_ID = demoId("library:COM");
const SERVICE_ID = demoId("service:COM_STRATEGY");
const QUESTIONNAIRE_VERSION_ID = demoId("questionnaire:v1");

/**
 * Film métier démo par région : client1 ↔ ST A → demande → matching → devis → contrat → mission → jalons.
 * États hétérogènes pour alimenter les files « à revoir » et les écrans de préparation.
 */
export function buildDemoFilmCollections(
  organizations: AdminSupervisionDashboard["organizations"],
): Pick<
  AdminSupervisionDashboard,
  | "requests"
  | "quotes"
  | "missions"
  | "diagnostics"
  | "matching"
  | "contracts"
  | "amendments"
  | "milestones"
  | "documents"
  | "messages"
  | "notifications"
  | "exceptions"
  | "templates"
  | "work_enrichment"
> {
  const requests: AdminSupervisionDashboard["requests"] = [];
  const quotes: AdminSupervisionDashboard["quotes"] = [];
  const missions: AdminSupervisionDashboard["missions"] = [];
  const diagnostics: AdminSupervisionDashboard["diagnostics"] = [];
  const matching: AdminSupervisionDashboard["matching"] = [];
  const contracts: AdminSupervisionDashboard["contracts"] = [];
  const amendments: AdminSupervisionDashboard["amendments"] = [];
  const milestones: NonNullable<AdminSupervisionDashboard["milestones"]> = [];
  const documents: AdminSupervisionDashboard["documents"] = [];
  const messages: AdminSupervisionDashboard["messages"] = [];
  const notifications: NonNullable<AdminSupervisionDashboard["notifications"]> = [];
  const exceptions: AdminSupervisionDashboard["exceptions"] = [];
  const templates: AdminSupervisionDashboard["templates"] = [
    {
      id: demoId("template:quote.submitted"),
      template_code: "QUOTE_SUBMITTED",
      event_type: "quote.submitted",
      category_code: "COMMERCE",
      locale: "fr-MA",
      version: 1,
      status: "ACTIVE",
      mandatory: true,
      channels: ["IN_APP", "EMAIL"],
    },
    {
      id: demoId("template:mission.milestone"),
      template_code: "MISSION_MILESTONE",
      event_type: "mission.milestone.submitted",
      category_code: "OPERATIONS",
      locale: "ar-MA",
      version: 1,
      status: "ACTIVE",
      mandatory: false,
      channels: ["IN_APP"],
    },
  ];
  const work_enrichment: AdminSupervisionDashboard["work_enrichment"] = {};

  listDemoRegionalTerritories().forEach((territory, index) => {
    const actors = listDemoRegionalActors(territory.code);
    const client = actors.find((item) => item.kind === "client" && item.slot === "1");
    const provider = actors.find((item) => item.kind === "provider" && item.slot === "A");
    const franchise = actors.find((item) => item.kind === "franchise");
    if (!client || !provider) return;

    const clientIds = demoRegionalIds(client);
    const providerIds = demoRegionalIds(provider);
    const franchiseIds = franchise ? demoRegionalIds(franchise) : null;
    const code = territory.code;
    const variant = index % 6;

    const requestId = demoId(`request:${code}`);
    const matchingId = demoId(`matching:${code}`);
    const rfqId = demoId(`rfq:${code}`);
    const quoteId = demoId(`quote:${code}`);
    const contractId = demoId(`contract:${code}`);
    const amendmentId = demoId(`amendment:${code}`);
    const missionId = demoId(`mission:${code}`);
    const milestoneId = demoId(`milestone:${code}:1`);
    const diagnosticId = demoId(`diagnostic:${code}`);
    const messageId = demoId(`message:${code}`);
    const notificationId = demoId(`notification:${code}`);
    const exceptionId = demoId(`exception:${code}`);
    const docClientId = demoId(`doc:client:${code}`);
    const docProviderId = demoId(`doc:provider:${code}`);

    const requestStatus = variant === 2 ? "INCOMPLETE" : variant === 4 ? "DRAFT" : "OPEN";
    const completeness = variant === 2 ? 55 : variant === 4 ? 30 : 92;
    const quoteStatus = variant === 0 || variant === 1 ? "SELECTED" : variant === 3 ? "IN_REVIEW" : "SUBMITTED";
    const contractStatus = variant === 3 ? "READY_FOR_SIGNATURE" : variant === 5 ? "SIGNED" : "ACTIVE";
    const createMission = variant !== 1; // ≥1 contrat ACTIVE sans mission (prep missions)
    const missionStatus = variant === 5 ? "BLOCKED" : "ACTIVE";
    const diagnosticStatus = variant === 4 ? "IN_PROGRESS" : variant === 2 ? "STALE" : "COMPLETED";
    const matchingExcluded = variant === 3;

    requests.push({
      id: requestId,
      organization_id: clientIds.organizationId,
      organization_name: client.labelFr,
      status: requestStatus,
      library_id: LIBRARY_ID,
      service_id: SERVICE_ID,
      created_at: "2026-09-10T09:00:00.000Z",
      matching_runs: 1,
      rfq_count: 1,
      quote_count: 1,
      title_fr: `Stratégie commerciale · ${territory.nameFr}`,
      title_ar: `استراتيجية تجارية · ${territory.nameAr}`,
      domain_label_fr: "Communication · Stratégie",
      domain_label_ar: "تواصل · استراتيجية",
      completeness_percent: completeness,
      source_code: "DIAGNOSTIC",
    });

    matching.push({
      id: matchingId,
      request_id: requestId,
      organization_id: clientIds.organizationId,
      organization_name: client.labelFr,
      status: requestStatus === "DRAFT" ? "PENDING" : "COMPLETED",
      policy_version: "MATCH_V1",
      started_at: "2026-09-10T09:15:00.000Z",
      eligible_count: matchingExcluded ? 0 : 1,
      excluded_count: matchingExcluded ? 1 : 0,
      rfq_count: 1,
      candidates: matchingExcluded
        ? [{
          provider_organization_id: providerIds.organizationId,
          provider_name: provider.labelFr,
          eligible: false,
          score_basis_points: 4200 + (variant % 3) * 350,
          exclusion_reasons: ["CAPACITY_INSUFFICIENT"],
        }]
        : [{
          provider_organization_id: providerIds.organizationId,
          provider_name: provider.labelFr,
          eligible: true,
          // Varier les scores démo (éviter 87,5 % / 88 % identiques sur toutes les lignes).
          score_basis_points: 6200 + (variant % 5) * 650 + (code.charCodeAt(0) % 7) * 40,
          exclusion_reasons: [],
        }],
    });

    quotes.push({
      id: quoteId,
      rfq_id: rfqId,
      request_id: requestId,
      provider_organization_id: providerIds.organizationId,
      provider_name: provider.labelFr,
      client_name: client.labelFr,
      status: quoteStatus,
      version_number: variant === 3 ? 2 : 1,
      currency: "MAD",
      subtotal_minor: "1200000",
      tax_minor: "240000",
      total_minor: "1440000",
      duration_days: 30,
      valid_until: "2026-10-31",
      line_count: 4,
      compliance_label: quoteStatus === "SELECTED" ? "CONFORME" : "A_VERIFIER",
      updated_at: "2026-09-12T11:00:00.000Z",
    });

    contracts.push({
      id: contractId,
      status: contractStatus,
      current_version: 1,
      client_organization_id: clientIds.organizationId,
      provider_organization_id: providerIds.organizationId,
      client_name: client.labelFr,
      provider_name: provider.labelFr,
      signature_count: contractStatus === "READY_FOR_SIGNATURE" ? 0 : contractStatus === "SIGNED" ? 1 : 2,
      mission_id: createMission ? missionId : null,
    });

    amendments.push({
      id: amendmentId,
      contract_id: contractId,
      status: variant === 0 ? "IN_REVIEW" : "DRAFT",
      amendment_number: 1,
      price_delta_minor: variant % 2 === 0 ? "50000" : "-25000",
      client_name: client.labelFr,
      provider_name: provider.labelFr,
      client_organization_id: clientIds.organizationId,
      object_fr: `Extension périmètre · ${territory.nameFr}`,
      object_ar: `توسيع النطاق · ${territory.nameAr}`,
      currency: "MAD",
    });

    if (createMission) {
      missions.push({
        id: missionId,
        contract_id: contractId,
        status: missionStatus,
        client_organization_id: clientIds.organizationId,
        provider_organization_id: providerIds.organizationId,
        client_name: client.labelFr,
        provider_name: provider.labelFr,
        updated_at: "2026-09-18T10:00:00.000Z",
        milestone_count: 2,
        deliverable_count: 1,
      });

      milestones.push({
        id: milestoneId,
        mission_id: missionId,
        milestone_key: "KICKOFF",
        title_fr: `Kick-off · ${territory.nameFr}`,
        title_ar: `انطلاقة · ${territory.nameAr}`,
        status: variant === 5 ? "REJECTED" : "SUBMITTED",
        organization_id: providerIds.organizationId,
        owner_name: provider.labelFr,
        due_at: "2026-09-25T18:00:00.000Z",
        deliverable_count: 1,
        proof_count: 1,
      });
      milestones.push({
        id: demoId(`milestone:${code}:2`),
        mission_id: missionId,
        milestone_key: "DELIVERY",
        title_fr: `Livraison · ${territory.nameFr}`,
        title_ar: `تسليم · ${territory.nameAr}`,
        status: variant === 5 ? "OVERDUE" : "PENDING",
        organization_id: providerIds.organizationId,
        owner_name: provider.labelFr,
        due_at: variant === 5 ? "2026-09-01T18:00:00.000Z" : "2026-10-15T18:00:00.000Z",
        deliverable_count: 0,
        proof_count: 0,
      });
    }

    diagnostics.push({
      id: diagnosticId,
      organization_id: clientIds.organizationId,
      organization_name: client.labelFr,
      status: diagnosticStatus,
      rating: diagnosticStatus === "COMPLETED" ? "IMPORTANT" : "WATCH",
      overall_score: diagnosticStatus === "COMPLETED" ? 78 : 42,
      completed_at: diagnosticStatus === "COMPLETED" ? "2026-09-08T16:00:00.000Z" : null,
      questionnaire_version_id: QUESTIONNAIRE_VERSION_ID,
      questionnaire_version: 1,
      questionnaire_title_fr: "Diagnostic entreprise",
      questionnaire_title_ar: "تشخيص مؤسسي",
    });

    documents.push(
      {
        id: docClientId,
        kind: "REGISTRATION",
        code: "RC",
        status: "VERIFIED",
        organization_id: clientIds.organizationId,
        organization_name: client.labelFr,
        expires_on: null,
        version: 1,
        folder_label: "KYC_CLIENT",
        sensitivity_label: "RESTREINT",
        scan_status: "CLEAN",
        access_label: "ORG_MEMBERS",
      },
      {
        id: docProviderId,
        kind: "INSURANCE",
        code: "RC_PRO",
        status: variant === 2 ? "EXPIRED" : "EXPIRING",
        organization_id: providerIds.organizationId,
        organization_name: provider.labelFr,
        expires_on: variant === 2 ? "2026-08-01" : "2026-12-01",
        version: 2,
        folder_label: "CAPACITE_ST",
        sensitivity_label: "CONFIDENTIEL",
        scan_status: variant === 2 ? "EXPIRED" : "CLEAN",
        access_label: "ORG_MEMBERS",
      },
    );

    messages.push({
      id: messageId,
      subject: `Consultation · ${territory.nameFr}`,
      status: variant === 4 ? "LOCKED" : "OPEN",
      object_id: rfqId,
      service_request_id: requestId,
      client_organization_id: clientIds.organizationId,
      provider_organization_id: providerIds.organizationId,
      client_name: client.labelFr,
      provider_name: provider.labelFr,
      created_at: "2026-09-11T14:00:00.000Z",
    });

    notifications.push({
      id: notificationId,
      organization_id: clientIds.organizationId,
      organization_name: client.labelFr,
      event_type: "quote.submitted",
      channel: "IN_APP",
      status: "DELIVERED",
      priority: variant === 5 ? "CRITICAL" : "HIGH",
      read_at: variant === 0 ? "2026-09-12T12:00:00.000Z" : null,
      updated_at: "2026-09-12T11:05:00.000Z",
      error_code: null,
      attempt_count: 1,
    });

    exceptions.push({
      id: exceptionId,
      source_kind: "DISPUTE_PREVENTION",
      priority: variant === 5 ? "HIGH" : "MEDIUM",
      status: "OPEN",
      due_at: "2026-09-30T18:00:00.000Z",
      title_fr: `Suivi jalon · ${territory.nameFr}`,
      title_ar: `متابعة معلم · ${territory.nameAr}`,
      resource_type: "mission_milestone",
      resource_id: createMission ? milestoneId : contractId,
      organization_id: providerIds.organizationId,
    });

    work_enrichment[exceptionId] = {
      organization_name: provider.labelFr,
      assignee_label: franchise && franchiseIds ? franchise.labelFr : null,
    };
  });

  for (const org of organizations) {
    if (documents.some((item) => item.organization_id === org.id)) continue;
    documents.push({
      id: demoId(`doc:org:${org.id}`),
      kind: (org.role_codes ?? []).includes("PROVIDER") ? "CAPACITY" : "IDENTITY",
      code: (org.role_codes ?? []).includes("PROVIDER") ? "CAP_PROOF" : "ICE",
      status: "VERIFIED",
      organization_id: org.id,
      organization_name: org.display_name,
      expires_on: null,
      version: 1,
      folder_label: "COFFRE",
      sensitivity_label: "RESTREINT",
      scan_status: "CLEAN",
      access_label: "ORG_MEMBERS",
    });
  }

  return {
    requests,
    quotes,
    missions,
    diagnostics,
    matching,
    contracts,
    amendments,
    milestones,
    documents,
    messages,
    notifications,
    exceptions,
    templates,
    work_enrichment,
  };
}
