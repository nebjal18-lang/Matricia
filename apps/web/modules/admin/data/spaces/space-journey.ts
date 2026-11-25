import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminSpaceId } from "./admin-nav";
import { adminFilmForSpace } from "./admin-film";

export type SpaceNextStep = { href: string; label: string };

/** Next step from film registry (actors + commercial + finance glue). */
export function spaceNextStep(locale: Locale, space: AdminSpaceId, query: string): SpaceNextStep | null {
  const film = adminFilmForSpace(locale, space, query);
  if (!film?.nextHref) return null;
  return { href: film.nextHref, label: film.nextAction };
}

export function spacePrevStep(locale: Locale, space: AdminSpaceId, query: string): SpaceNextStep | null {
  const film = adminFilmForSpace(locale, space, query);
  if (!film?.prevHref) return null;
  return {
    href: film.prevHref,
    label: locale === "ar" ? "الخطوة السابقة" : "Étape précédente",
  };
}

export const governedMutationSpaces: ReadonlySet<AdminSpaceId> = new Set([
  "devis", "contrats", "missions", "jalons", "territoires", "franchises", "gouvernance",
  "avenants", "diagnostics", "demandes", "matching", "litiges", "messagerie", "documents",
]);
