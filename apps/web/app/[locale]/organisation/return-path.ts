import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** Only explicit same-site journeys that resume after an organization exists. */
export function organizationReturnPath(locale: Locale, value: string | undefined): string | null {
  const allowed = [`/${locale}/diagnostic?reprendre=enregistrer`];
  if(value && new RegExp(`^/${locale}/invitation/[A-Z0-9][A-Z0-9_-]{7,63}$`, "u").test(value)) return value;
  if (value?.startsWith(`/${locale}/rejoindre-reseau?`)) {
    try {
      const target = new URL(value, "https://matricia.invalid");
      const keys = [...target.searchParams.keys()];
      const invitationId = target.searchParams.get("invitationId"), token = target.searchParams.get("token");
      if (target.origin === "https://matricia.invalid" && target.pathname === `/${locale}/rejoindre-reseau` && !target.hash
        && keys.length === 2 && keys.includes("invitationId") && keys.includes("token")
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(invitationId ?? "")
        && /^[A-Za-z0-9_-]{43}$/u.test(token ?? "")) return value;
    } catch { return null; }
  }
  return value && allowed.includes(value) ? value : null;
}
