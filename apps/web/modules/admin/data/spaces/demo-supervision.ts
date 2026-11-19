import { createHash } from "node:crypto";
import { demoRegionalIds, demoRegionalUuid } from "@/app/[locale]/connexion/demo-regional-ensure";
import {
  listAllDemoRegionalActors,
  listDemoRegionalActors,
  listDemoRegionalTerritories,
  type DemoRegionalActor,
} from "@/app/[locale]/connexion/demo-regional-directory";
import { isDemoClientHomeEnabled } from "@/modules/client/data/home/demo-scenario";
import type {
  AdminOrganizationFiche,
  AdminSupervisionDashboard,
} from "@/modules/admin/data/supervision/types";
import { buildDemoFilmCollections } from "./demo-film";

function digits(seed: string, length: number) {
  return createHash("sha256").update(`DEMO_LEGAL_V1:${seed}`).digest("hex").replace(/\D/gu, "").padEnd(length, "0").slice(0, length);
}

function activityFor(kind: DemoRegionalActor["kind"]) {
  if (kind === "franchise") {
    return {
      activity: "Animation et supervision du réseau Matricia",
      sector: "Services aux entreprises — franchise",
      representative: "Karim Benjelloun",
    };
  }
  if (kind === "provider") {
    return {
      activity: "Prestations informatiques et conseil opérationnel",
      sector: "Technologies de l’information",
      representative: "Youssef Amrani",
    };
  }
  return {
    activity: "Exploitation commerciale et services locaux",
    sector: "Commerce et services",
    representative: "Sara Kadiri",
  };
}

function buildDemoLegalProfile(actor: DemoRegionalActor) {
  const seed = `${actor.kind}:${actor.territoryCode}:${actor.slot}`;
  const meta = activityFor(actor.kind);
  const registeredCity =
    listDemoRegionalTerritories().find((item) => item.code === actor.territoryCode)?.city
    ?? actor.territoryNameFr;
  const cityCode = registeredCity
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z]/gu, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  return {
    version: 1,
    legal_form: "SARL",
    incorporation_date: "2019-06-15",
    activity: meta.activity,
    sector: meta.sector,
    registered_city: registeredCity,
    registered_address: {
      line1: `${12 + Number(actor.slot.replace(/\D/gu, "") || "1")} Boulevard Mohammed V`,
      city: registeredCity,
      country_code: "MA",
      postal_code: digits(`${seed}:cp`, 5),
    },
    if_number: digits(`${seed}:if`, 8),
    rc_number: `${cityCode}${digits(`${seed}:rc`, 5)}`,
    representative_name: meta.representative,
  };
}

export function canApplyAdminDemoSupervision() {
  return isDemoClientHomeEnabled();
}

function roleCodesFor(kind: DemoRegionalActor["kind"]) {
  if (kind === "franchise") return ["FRANCHISE"];
  if (kind === "provider") return ["PROVIDER"];
  return ["CLIENT"];
}

function rolesForKind(kind: DemoRegionalActor["kind"]) {
  if (kind === "franchise") return ["FRANCHISE_OPERATOR"];
  if (kind === "provider") return ["PROVIDER_ADMIN"];
  return ["CLIENT_OWNER"];
}

/** Catalogue démo transversal pour Entreprises / supervision / espaces admin. */
export function buildDemoSupervisionOrganizations(): AdminSupervisionDashboard["organizations"] {
  const organizations: AdminSupervisionDashboard["organizations"] = [];
  for (const territory of listDemoRegionalTerritories()) {
    for (const actor of listDemoRegionalActors(territory.code)) {
      const ids = demoRegionalIds(actor);
      organizations.push({
        id: ids.organizationId,
        display_name: actor.labelFr,
        legal_name: `${actor.labelFr} SARL`,
        status: "ACTIVE",
        created_at: "2026-03-01T10:00:00.000Z",
        role_codes: roleCodesFor(actor.kind),
        client_compliance_status: actor.kind === "client" ? "VERIFIED" : null,
        provider_identity_verified: actor.kind === "provider" ? true : null,
        canonical_identity_verified: true,
        member_count: 1,
        open_requests: actor.kind === "client" ? 1 : 0,
        open_disputes: 0,
      });
    }
  }
  return organizations;
}

export function buildDemoSupervisionDashboard(): AdminSupervisionDashboard {
  const organizations = buildDemoSupervisionOrganizations();
  const film = buildDemoFilmCollections(organizations);
  return {
    as_of: new Date().toISOString(),
    read_only: true,
    organizations,
    ...film,
  };
}

/**
 * Mode démo ON = catalogue démo exclusif (remplace l’ancien volume DB résiduel).
 * Mode démo OFF = données DB inchangées (appelant ne doit pas invoquer ceci).
 */
export function replaceWithDemoSupervisionDashboard(
  _value?: AdminSupervisionDashboard,
): AdminSupervisionDashboard {
  return buildDemoSupervisionDashboard();
}

/** @deprecated Prefer replaceWithDemoSupervisionDashboard — plus de merge. */
export function mergeDemoSupervisionDashboard(
  value: AdminSupervisionDashboard,
): AdminSupervisionDashboard {
  return replaceWithDemoSupervisionDashboard(value);
}

export function isDemoRegionalOrganizationId(organizationId: string) {
  return listAllDemoRegionalActors().some(
    (item) => demoRegionalIds(item).organizationId === organizationId,
  );
}

function filmUuid(seed: string): string {
  const hex = createHash("sha256").update(`DEMO_FILM_V1:${seed}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function buildDemoFicheParcours(actor: DemoRegionalActor) {
  const code = actor.territoryCode;
  const missionId = filmUuid(`mission:${code}:${actor.slot}`);
  const requestId = filmUuid(`request:${code}:${actor.slot}`);
  const diagnosticId = filmUuid(`diagnostic:${code}:${actor.slot}`);
  const serviceId = filmUuid("service:COM_STRATEGY");

  if (actor.kind === "franchise") {
    return {
      requests: [] as AdminOrganizationFiche["requests"],
      missions: [] as AdminOrganizationFiche["missions"],
      diagnostics: [] as AdminOrganizationFiche["diagnostics"],
      timelineExtra: [
        { at: "2026-03-01T10:00:00.000Z", kind: "FRANCHISE", label: "Mandat territoire actif", ref: code },
      ],
    };
  }

  if (actor.kind === "provider") {
    return {
      requests: [] as AdminOrganizationFiche["requests"],
      missions: [{
        id: missionId,
        status: "ACTIVE",
        updated_at: "2026-09-18T10:00:00.000Z",
        as_client: false,
        as_provider: true,
      }],
      diagnostics: [] as AdminOrganizationFiche["diagnostics"],
      timelineExtra: [
        { at: "2026-09-12T11:00:00.000Z", kind: "QUOTE", label: "Devis soumis", ref: filmUuid(`quote:${code}:${actor.slot}`) },
        { at: "2026-09-18T10:00:00.000Z", kind: "MISSION", label: "Mission active", ref: missionId },
      ],
    };
  }

  return {
    requests: [{
      id: requestId,
      status: "OPEN",
      created_at: "2026-09-10T09:00:00.000Z",
      service_id: serviceId,
    }],
    missions: [{
      id: missionId,
      status: "ACTIVE",
      updated_at: "2026-09-18T10:00:00.000Z",
      as_client: true,
      as_provider: false,
    }],
    diagnostics: [{
      id: diagnosticId,
      status: "COMPLETED",
      rating: "IMPORTANT",
      overall_score: 78,
      completed_at: "2026-09-08T16:00:00.000Z",
    }],
    timelineExtra: [
      { at: "2026-09-08T16:00:00.000Z", kind: "DIAGNOSTIC", label: "Diagnostic complété", ref: diagnosticId },
      { at: "2026-09-10T09:00:00.000Z", kind: "REQUEST", label: "Demande ouverte", ref: requestId },
      { at: "2026-09-18T10:00:00.000Z", kind: "MISSION", label: "Mission active", ref: missionId },
    ],
  };
}

export function buildDemoOrganizationFiche(organizationId: string): AdminOrganizationFiche | null {
  const actor = listAllDemoRegionalActors().find(
    (item) => demoRegionalIds(item).organizationId === organizationId,
  );
  if (!actor) return null;
  const ids = demoRegionalIds(actor);
  const legal = buildDemoLegalProfile(actor);
  const ice = digits(`${actor.kind}:${actor.territoryCode}:${actor.slot}:ice`, 15);
  const parcours = buildDemoFicheParcours(actor);
  return {
    organization: {
      id: ids.organizationId,
      display_name: actor.labelFr,
      legal_name: `${actor.labelFr} SARL`,
      status: "ACTIVE",
      role_codes: roleCodesFor(actor.kind),
      client_compliance_status: actor.kind === "client" ? "VERIFIED" : null,
      provider_identity_verified: actor.kind === "provider" || actor.kind === "franchise" ? true : null,
      canonical_identity_verified: true,
      client_legal_profile: legal,
      client_compliance_snapshot: actor.kind === "client"
        ? {
            case_id: ids.membershipId,
            status: "VERIFIED",
            profile_version: 1,
            document_count: 4,
            verified_document_count: 4,
            currently_verified: true,
            required_actions: [],
          }
        : null,
      administration_details: {
        ice,
        if: legal.if_number,
        rc: legal.rc_number,
        phone: `+2126${digits(`${actor.email}:tel`, 8)}`,
        email: actor.email,
      },
      row_version: 1,
      country_code: "MA",
      created_at: "2019-06-15T10:00:00.000Z",
      updated_at: "2026-03-01T10:00:00.000Z",
    },
    memberships: [
      {
        id: ids.membershipId,
        user_id: ids.userIdSeed,
        status: "ACTIVE",
        roles: rolesForKind(actor.kind),
        display_name: legal.representative_name,
        email: actor.email,
      },
      {
        id: demoRegionalUuid(`${actor.kind}:${actor.territoryCode}:${actor.slot}:membership:invite`),
        user_id: demoRegionalUuid(`${actor.kind}:${actor.territoryCode}:${actor.slot}:user:invite`),
        status: "INVITED",
        roles: [],
        display_name: actor.kind === "provider"
          ? "Nada El Fassi"
          : actor.kind === "franchise"
            ? "Imane Chraibi"
            : "Omar Bennani",
        email: `invite.${actor.email}`,
      },
    ],
    requests: parcours.requests,
    missions: parcours.missions,
    disputes: [],
    diagnostics: parcours.diagnostics,
    subscriptions: [{ id: "f0000005-0000-4000-8000-000000000005", status: "ACTIVE", plan_version_id: null, current_period_end: "2026-12-31T00:00:00.000Z" }],
    timeline: [
      { at: "2019-06-15T10:00:00.000Z", kind: "ORG", label: "Création société", ref: legal.rc_number },
      ...parcours.timelineExtra,
      { at: "2026-03-01T10:00:00.000Z", kind: "ORG", label: actor.labelFr, ref: actor.email },
    ],
  };
}
