import { demoRegionalIds, demoRegionalUuid } from "@/app/[locale]/connexion/demo-regional-ensure";
import {
  listDemoRegionalActors,
  listDemoRegionalTerritories,
} from "@/app/[locale]/connexion/demo-regional-directory";
import { isDemoClientHomeEnabled } from "@/modules/client/data/home/demo-scenario";
import type { FranchiseApplicationListRow } from "@/modules/admin/screens/franchise-applications/model";

export function canApplyAdminDemoFranchiseApplications() {
  return isDemoClientHomeEnabled();
}

type DemoApplicationSpec = {
  territoryCode: string;
  status: "REGISTERED" | "COMPANY_REVIEW" | "DOCUMENT_REVIEW" | "CONTRACT_PENDING";
  domainLabel: string;
  applicantLabel: string;
  daysAgo: number;
  linkOrganization: boolean;
  linkFranchise: boolean;
};

/** File d’instruction démo : dossiers ouverts (pas ACTIVE — ceux-là sont dans l’annuaire). */
const DEMO_APPLICATION_SPECS: readonly DemoApplicationSpec[] = [
  {
    territoryCode: "TANGER_TETOUAN_AL_HOCEIMA",
    status: "REGISTERED",
    domainLabel: "COM — Communication & marketing",
    applicantLabel: "Sara El Idrissi",
    daysAgo: 2,
    linkOrganization: false,
    linkFranchise: false,
  },
  {
    territoryCode: "ORIENTAL",
    status: "COMPANY_REVIEW",
    domainLabel: "ACC — Comptabilité & fiscalité",
    applicantLabel: "Youssef Benkirane",
    daysAgo: 5,
    linkOrganization: false,
    linkFranchise: false,
  },
  {
    territoryCode: "FES_MEKNES",
    status: "COMPANY_REVIEW",
    domainLabel: "LEGAL — Juridique",
    applicantLabel: "Nadia Chraibi",
    daysAgo: 8,
    linkOrganization: true,
    linkFranchise: false,
  },
  {
    territoryCode: "RABAT_SALE_KENITRA",
    status: "DOCUMENT_REVIEW",
    domainLabel: "HR — Ressources humaines",
    applicantLabel: "Amine Bouazza",
    daysAgo: 11,
    linkOrganization: true,
    linkFranchise: false,
  },
  {
    territoryCode: "CASABLANCA_SETTAT",
    status: "DOCUMENT_REVIEW",
    domainLabel: "IT — Informatique, cybersécurité et data",
    applicantLabel: "Leila Mansouri",
    daysAgo: 14,
    linkOrganization: true,
    linkFranchise: false,
  },
  {
    territoryCode: "MARRAKECH_SAFI",
    status: "CONTRACT_PENDING",
    domainLabel: "BTP — BTP & immobilier",
    applicantLabel: "Karim Alaoui",
    daysAgo: 18,
    linkOrganization: true,
    linkFranchise: true,
  },
] as const;

function franchiseActor(territoryCode: string) {
  return listDemoRegionalActors(territoryCode).find((actor) => actor.kind === "franchise") ?? null;
}

function createdAtIso(daysAgo: number) {
  return new Date(Date.UTC(2026, 10, 18 - daysAgo, 9, 30, 0)).toISOString();
}

function candidatureEmail(territoryCode: string) {
  return `demo.candidature.${territoryCode.toLowerCase().replace(/_/gu, "-")}@matricia.test`;
}

export function buildDemoFranchiseApplications(): FranchiseApplicationListRow[] {
  const territories = new Map(listDemoRegionalTerritories().map((item) => [item.code, item]));
  const rows: FranchiseApplicationListRow[] = [];
  for (const spec of DEMO_APPLICATION_SPECS) {
    if (!territories.has(spec.territoryCode)) continue;
    const actor = franchiseActor(spec.territoryCode);
    const orgId = actor && spec.linkOrganization ? demoRegionalIds(actor).organizationId : null;
    const franchiseId = spec.linkFranchise
      ? demoRegionalUuid(`application:${spec.territoryCode}:franchise`)
      : null;
    const brand = actor?.labelFr ?? spec.applicantLabel;
    rows.push({
      id: demoRegionalUuid(`application:${spec.territoryCode}:${spec.status}`),
      applicant_name: spec.linkOrganization ? brand : spec.applicantLabel,
      reply_email: candidatureEmail(spec.territoryCode),
      territory_code: spec.territoryCode,
      domain_label: spec.domainLabel,
      status: spec.status,
      organization_id: orgId,
      franchise_id: franchiseId,
      row_version: 1,
      created_at: createdAtIso(spec.daysAgo),
    });
  }
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

/** Noms d’org pour les dossiers liés (évite « Nom indisponible » hors DB). */
export function buildDemoFranchiseApplicationOrganizationNames(): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of buildDemoFranchiseApplications()) {
    if (!row.organization_id) continue;
    const actor = franchiseActor(row.territory_code);
    if (actor) names.set(row.organization_id, actor.labelFr);
  }
  return names;
}
