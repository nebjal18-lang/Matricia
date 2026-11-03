import { cookies } from "next/headers";
import { readWorkspaceNavigation } from "@/modules/shared/lib/auth/workspace-navigation-server";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { PublicNavigation } from "./public-navigation";

export async function PublicNavigationServer({ locale }: { locale: Locale }) {
  const preferred = (await cookies()).get("matricia.workspace")?.value;
  const result = await readWorkspaceNavigation(locale, undefined, preferred);
  return <PublicNavigation locale={locale} sessionNavigation={result.status === "ok" ? result.navigation : result.signedIn ? { signedIn: true, landing: null, options: [] } : undefined} />;
}
