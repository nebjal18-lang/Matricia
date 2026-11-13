import type { FranchiseNavKey } from "@/modules/franchise/ui/franchise-nav";

export type FranchiseNestedKind =
  | "home"
  | "library"
  | "services"
  | "questionnaires"
  | "rules"
  | "validations"
  | "network"
  | "requests"
  | "quality"
  | "performance"
  | "followups"
  | "documents"
  | "messages"
  | "governance"
  | "perimeter"
  | "finance";

export type FranchiseNestedView = {
  kind: FranchiseNestedKind;
  active: FranchiseNavKey;
  itemId: string | null;
  tool: string | null;
  view: string | null;
  create: boolean;
};

const tools = new Set(["versions", "simulation", "validation", "apercu", "qualification", "services", "historique", "capacite", "documents", "matching", "consultation", "suivi"]);

/** Placeholders for nested nav smoke paths (not demo mutation ids). */
export const FRANCHISE_NAV_SAMPLE_PROVIDER_ID = "f1000000-0000-4000-8000-000000000001";
export const FRANCHISE_NAV_SAMPLE_REQUEST_ID = "d1000000-0000-4000-8000-000000000001";

const spaceViews: Record<string, { kind: FranchiseNestedKind; active: FranchiseNavKey; views?: string[] }> = {
  actions: { kind: "home", active: "home" },
  activite: { kind: "home", active: "home" },
  accueil: { kind: "home", active: "home" },
  bibliotheque: { kind: "library", active: "library", views: ["categories", "version", "historique"] },
  services: { kind: "services", active: "services" },
  questionnaires: { kind: "questionnaires", active: "questionnaires" },
  questions: { kind: "questionnaires", active: "questionnaires" },
  regles: { kind: "rules", active: "rules" },
  validations: { kind: "validations", active: "validations" },
  fournisseurs: { kind: "network", active: "network", views: ["accompagnement", "incomplets", "qualifies", "inactifs", "inviter"] },
  clients: { kind: "network", active: "network", views: ["inviter"] },
  reseau: { kind: "network", active: "network", views: ["accompagnement", "incomplets", "qualifies", "inactifs"] },
  demandes: { kind: "requests", active: "requests", views: ["devis", "missions"] },
  qualite: { kind: "quality", active: "quality", views: ["revues", "non-conformites", "actions", "anomalies", "recommandations", "opportunites", "definitions", "risques", "incidents"] },
  performance: { kind: "performance", active: "performance", views: ["indicateurs", "reseau", "tendances"] },
  relances: { kind: "followups", active: "followups", views: ["pipeline", "historique"] },
  digest: { kind: "followups", active: "followups" },
  documents: { kind: "documents", active: "documents", views: ["renouvellements"] },
  messages: { kind: "messages", active: "messages" },
  notifications: { kind: "messages", active: "messages" },
  gouvernance: { kind: "governance", active: "governance", views: ["perimetre", "approbations", "historique"] },
  perimetre: { kind: "perimeter", active: "perimeter", views: ["utilisateurs"] },
  finance: { kind: "finance", active: "finance", views: ["volume", "droit-entree", "pre-releve", "paiements"] },
};

export function resolveFranchiseNestedView(slug: readonly string[]): FranchiseNestedView | null {
  const [head, second, third] = slug;
  if (!head) return null;
  const spec = spaceViews[head];
  if (!spec) return null;
  if (head === "notifications") return { kind: "messages", active: "messages", itemId: null, tool: null, view: "notifications", create: false };
  if (head === "questions") return { kind: "questionnaires", active: "questionnaires", itemId: null, tool: null, view: "questions", create: false };
  if (head === "actions" || head === "activite") {
    return { kind: "home", active: "home", itemId: null, tool: null, view: head, create: false };
  }
  if (!second) return { kind: spec.kind, active: spec.active, itemId: null, tool: null, view: null, create: false };
  if (second === "nouveau" || second === "nouvelle" || second === "inviter") {
    return { kind: spec.kind, active: spec.active, itemId: null, tool: null, view: second === "inviter" ? "inviter" : null, create: true };
  }
  if (spec.views?.includes(second) && !third) {
    return { kind: spec.kind, active: spec.active, itemId: null, tool: null, view: second, create: false };
  }
  if (head === "validations") {
    return { kind: "validations", active: "validations", itemId: null, tool: null, view: second, create: false };
  }
  const tool = third && tools.has(third) ? third : tools.has(second) ? second : null;
  return {
    kind: spec.kind,
    active: spec.active,
    itemId: second,
    tool,
    view: tool,
    create: false,
  };
}

export const FRANCHISE_NESTED_NAV_PATHS = [
  "actions",
  "activite",
  "bibliotheque/categories",
  "bibliotheque/version",
  "bibliotheque/historique",
  "questions",
  "fournisseurs/inviter",
  "clients/inviter",
  "fournisseurs/accompagnement",
  "fournisseurs/incomplets",
  "fournisseurs/qualifies",
  "fournisseurs/inactifs",
  `fournisseurs/${FRANCHISE_NAV_SAMPLE_PROVIDER_ID}`,
  `fournisseurs/${FRANCHISE_NAV_SAMPLE_PROVIDER_ID}/qualification`,
  `fournisseurs/${FRANCHISE_NAV_SAMPLE_PROVIDER_ID}/services`,
  `fournisseurs/${FRANCHISE_NAV_SAMPLE_PROVIDER_ID}/capacite`,
  `fournisseurs/${FRANCHISE_NAV_SAMPLE_PROVIDER_ID}/documents`,
  `fournisseurs/${FRANCHISE_NAV_SAMPLE_PROVIDER_ID}/historique`,
  `demandes/${FRANCHISE_NAV_SAMPLE_REQUEST_ID}`,
  `demandes/${FRANCHISE_NAV_SAMPLE_REQUEST_ID}/matching`,
  `demandes/${FRANCHISE_NAV_SAMPLE_REQUEST_ID}/consultation`,
  `demandes/${FRANCHISE_NAV_SAMPLE_REQUEST_ID}/suivi`,
  "demandes/devis",
  "demandes/missions",
  "qualite/revues",
  "qualite/non-conformites",
  "qualite/actions",
  "qualite/anomalies",
  "qualite/recommandations",
  "qualite/opportunites",
  "qualite/definitions",
  "qualite/risques",
  "qualite/incidents",
  "performance/indicateurs",
  "performance/reseau",
  "performance/tendances",
  "relances/pipeline",
  "relances/historique",
  "documents/renouvellements",
  "notifications",
  "gouvernance/perimetre",
  "gouvernance/approbations",
  "gouvernance/historique",
  "perimetre/utilisateurs",
  "finance/volume",
  "finance/droit-entree",
  "finance/pre-releve",
  "finance/paiements",
] as const;
