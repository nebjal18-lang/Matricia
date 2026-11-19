import type { UserActionItem } from "@/modules/shared/lib/action-center/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ClientHomeSnapshot } from "./repository";

const allowedDemoAppEnvs = new Set(["development", "staging", "test"]);

/** Same gate as connexion demo: require allowlisted APP_ENV + flag; never production/Vercel prod. */
export function isDemoClientHomeEnabled() {
  if (process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") return false;
  if (!process.env.APP_ENV || !allowedDemoAppEnvs.has(process.env.APP_ENV)) return false;
  return process.env.MATRICIA_DEMO_ACCESS_ENABLED === "true";
}

export function isDemoClientOrganization(name: string | null) {
  return Boolean(name && (/^Client · /u.test(name) || /^Client Démo/u.test(name)));
}

export function applyDemoClientHome(input: {
  locale: Locale;
  organizationId: string | null;
  organizationName: string | null;
  selectedQuery: string;
  now: string;
  items: readonly UserActionItem[];
  snapshot: ClientHomeSnapshot;
}): { items: UserActionItem[]; snapshot: ClientHomeSnapshot } {
  return { items: [...input.items], snapshot: input.snapshot };
}
