/** Nested mockup routes fall back to the parent screen that actually exists. */

export function franchiseFallbackPath(slug: readonly string[]): string {
  const [head, item] = slug;
  if (head === "services" && item && item !== "nouveau") return `services/${item}`;
  if (head === "questionnaires" && item && item !== "nouveau") return `questionnaires/${item}`;
  if (head === "validations" && item) return `validations/${item}`;
  const roots: Record<string, string> = {
    actions: "accueil",
    activite: "accueil",
    accueil: "accueil",
    bibliotheque: "bibliotheque",
    services: "services",
    questionnaires: "questionnaires",
    questions: "questions",
    regles: "regles",
    validations: "validations",
    fournisseurs: "fournisseurs",
    demandes: "demandes",
    qualite: "qualite",
    performance: "performance",
    relances: "relances",
    documents: "documents",
    messages: "messages",
    notifications: "messages",
    gouvernance: "gouvernance",
    perimetre: "perimetre",
    reseau: "reseau",
    finance: "finance",
    digest: "digest",
  };
  return roots[head ?? ""] ?? "accueil";
}

export function providerFallbackPath(slug: readonly string[]): string {
  const [head] = slug;
  const roots: Record<string, string> = {
    qualification: "qualification",
    services: "services",
    consultations: "consultations",
    devis: "devis",
    missions: "missions",
    documents: "documents",
    facturation: "facturation",
    reputation: "reputation",
    planning: "planning",
    messages: "messages",
    notifications: "messages",
    entreprise: "entreprise",
    litiges: "litiges",
    achats: "achats",
    marketing: "marketing",
    contrats: "contrats",
    questionnaires: "questionnaires",
    "mode-client": "mode-client",
    parametres: "parametres",
    identite: "identite",
  };
  return roots[head ?? ""] ?? "qualification";
}
