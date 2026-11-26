import type { UserActionItem } from "@/modules/shared/lib/action-center/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ClientHomeSnapshot } from "./repository";
import { isDemoAccessEnabled } from "@/modules/shared/lib/demo-access";

/** Use the same demo gate as the login page. */
export function isDemoClientHomeEnabled() {
  return isDemoAccessEnabled();
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
