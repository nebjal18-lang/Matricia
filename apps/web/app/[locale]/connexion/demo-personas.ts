import type { WorkspaceLanding } from "@/modules/shared/lib/connected-space/workspace-landing";

export type DemoPersona = "client" | "provider" | "franchise" | "admin";

export function demoPersonaWorkspace(persona: DemoPersona): WorkspaceLanding {
  if (persona === "admin") return "administration";
  if (persona === "provider") return "provider";
  if (persona === "franchise") return "franchise";
  return "client";
}

/** Tableau de bord canonique de chaque persona démo. */
export function demoPersonaHome(persona: DemoPersona, locale: "fr" | "ar"): string {
  if (persona === "admin") return `/${locale}/administration/command-center`;
  if (persona === "franchise") return `/${locale}/franchise/accueil`;
  if (persona === "provider") return `/${locale}/tableau-de-bord?workspace=provider`;
  return `/${locale}/tableau-de-bord?workspace=client`;
}

/** Un next d’un autre espace ne doit jamais détourner le bouton persona. */
export function personaCompatibleNext(
  persona: DemoPersona,
  locale: "fr" | "ar",
  requested: string | undefined,
): string {
  const fallback = demoPersonaHome(persona, locale);
  if (!requested) return fallback;
  const pathname = new URL(requested, "https://matricia.invalid").pathname;
  const prefix = pathname.split("/")[2] ?? "";
  if (persona === "admin") return prefix === "administration" ? requested : fallback;
  if (persona === "provider") {
    if (prefix === "sous-traitant") return requested;
    if (pathname === `/${locale}/tableau-de-bord`) return requested.includes("workspace=provider") ? requested : fallback;
    return fallback;
  }
  if (persona === "franchise") return prefix === "franchise" ? requested : fallback;
  if (prefix === "administration" || prefix === "sous-traitant" || prefix === "franchise") return fallback;
  return pathname === `/${locale}/tableau-de-bord` || prefix === "client" ? requested : fallback;
}
