import type { ClientFeaturedProject, ClientJourneyStepId } from "./view-model";

/**
 * Continuity contract for the Client COM demo film.
 * Stages must reuse the same requestId; never invent litiges or missions.
 */
export type ClientFilmStage =
  | "DRAFT"
  | "READY"
  | "QUOTES"
  | "CONTRACT"
  | "MISSION"
  | "DELIVERY";

export function clientFilmStageFromStatus(status: string): ClientFilmStage {
  if (status === "DRAFT" || status === "INFORMATION_REQUIRED") return "DRAFT";
  if (["READY", "MATCHING", "RFQ_OPEN"].includes(status)) return "READY";
  if (["QUOTES_RECEIVED", "CLIENT_REVIEW"].includes(status)) return "QUOTES";
  if (["PROVIDER_SELECTED", "CONTRACT_PENDING"].includes(status)) return "CONTRACT";
  if (["CONTRACTED", "MISSION_ACTIVE", "IN_PROGRESS"].includes(status)) return "MISSION";
  if (["COMPLETED", "CLOSED"].includes(status)) return "DELIVERY";
  return "DRAFT";
}

export function clientFilmNextAction(stage: ClientFilmStage, locale: "fr" | "ar"): string {
  const fr: Record<ClientFilmStage, string> = {
    DRAFT: "Compléter la demande pour recevoir des devis",
    READY: "Ouvrir la consultation et attendre les devis",
    QUOTES: "Comparer les devis et choisir un prestataire",
    CONTRACT: "Examiner et signer le contrat",
    MISSION: "Suivre les jalons et livrables",
    DELIVERY: "Examiner les livrables finaux",
  };
  const ar: Record<ClientFilmStage, string> = {
    DRAFT: "استكمال الطلب لاستلام العروض",
    READY: "فتح الاستشارة وانتظار العروض",
    QUOTES: "مقارنة العروض واختيار مقدم الخدمة",
    CONTRACT: "مراجعة العقد وتوقيعه",
    MISSION: "متابعة المراحل والتسليمات",
    DELIVERY: "مراجعة التسليمات النهائية",
  };
  return locale === "ar" ? ar[stage] : fr[stage];
}

export function clientFilmReference(featured: ClientFeaturedProject | null): string | null {
  return featured?.requestId ?? null;
}

export function clientFilmStepId(stage: ClientFilmStage): ClientJourneyStepId {
  if (stage === "DRAFT") return "need";
  if (stage === "READY") return "consultation";
  if (stage === "QUOTES") return "quotes";
  if (stage === "CONTRACT") return "contract";
  if (stage === "MISSION") return "mission";
  return "delivery";
}
