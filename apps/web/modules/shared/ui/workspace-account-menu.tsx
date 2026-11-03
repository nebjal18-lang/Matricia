import Link from "next/link";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import type { ReactNode } from "react";
import { signOutOfWorkspace } from "@/modules/shared/lib/account-security/sign-out-action";
import { dashboardHomeCopy } from "@/modules/shared/module-hub-copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { Button } from "@/modules/shared/ui/button";

export function WorkspaceAccountMenu({
  locale,
  userEmail,
  returnTo,
  fallbackInitial,
  label,
  displayName,
  className = "client-account",
  workspace,
}: {
  locale: Locale;
  userEmail: string | null;
  returnTo: string;
  fallbackInitial: string;
  label: string;
  displayName?: string;
  className?: string;
  workspace?: "client" | "provider" | "franchise" | "administration";
}): ReactNode {
  const m = dashboardHomeCopy[locale];
  const next = safeReturnPath(returnTo, locale) ?? `/${locale}/tableau-de-bord`;
  const returnUrl = new URL(next, "https://matricia.invalid");
  const intent = returnUrl.pathname.startsWith(`/${locale}/securite/`) ? safeReturnPath(returnUrl.searchParams.get("next"), locale) ?? next : next;
  const securityQuery = new URLSearchParams({ next: intent });
  const organizationId = returnUrl.searchParams.get("organizationId");
  const currentWorkspace = workspace ?? (returnUrl.pathname.startsWith(`/${locale}/administration/`) ? "administration" : returnUrl.searchParams.get("workspace"));
  if (organizationId && currentWorkspace !== "administration") securityQuery.set("organizationId", organizationId);
  if (currentWorkspace) securityQuery.set("workspace", currentWorkspace);
  const initial = (userEmail?.slice(0, 1) || fallbackInitial).toUpperCase();
  return (
    <details className={className}>
      <summary aria-label={label}>
        {displayName ? (
          <>
            <span className="client-account-avatar" aria-hidden>
              {initial}
            </span>
            <span className="client-account-label">{displayName}</span>
          </>
        ) : (
          initial
        )}
      </summary>
      <div>
        <p dir="ltr">{userEmail ?? "—"}</p>
        <Link href={`/${locale}/securite/compte?${securityQuery}`}>{m.accountTitle}</Link>
        <Link href={`/${locale}/securite/sessions?${securityQuery}`}>{m.sessionsCta}</Link>
        <form action={signOutOfWorkspace}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Button type="submit" className="client-ghost-btn">
            {m.signOut}
          </Button>
        </form>
      </div>
    </details>
  );
}
