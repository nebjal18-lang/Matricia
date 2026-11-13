import { cookies } from "next/headers";
import { Suspense } from "react";
import { readWorkspaceNavigation } from "@/modules/shared/lib/auth/workspace-navigation-server";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { hasSupabaseAuthCookie } from "@/modules/shared/lib/supabase/session-cookie";
import { PublicNavigation } from "./public-navigation";

async function PublicNavigationAuthed({ locale }: { locale: Locale }) {
  const jar = await cookies();
  if (!hasSupabaseAuthCookie(jar.getAll())) {
    return <PublicNavigation locale={locale} />;
  }
  const preferred = jar.get("matricia.workspace")?.value;
  const result = await readWorkspaceNavigation(locale, undefined, preferred);
  return (
    <PublicNavigation
      locale={locale}
      sessionNavigation={
        result.status === "ok"
          ? result.navigation
          : result.signedIn
            ? { signedIn: true, landing: null, options: [] }
            : undefined
      }
    />
  );
}

/** Anonymous nav paints immediately; session upgrade streams in only when Auth cookies exist. */
export function PublicNavigationServer({ locale }: { locale: Locale }) {
  return (
    <Suspense fallback={<PublicNavigation locale={locale} />}>
      <PublicNavigationAuthed locale={locale} />
    </Suspense>
  );
}
