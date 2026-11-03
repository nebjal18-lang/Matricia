import { FranchiseAccessState, FranchiseOrganizationSelector } from "./franchise-access-state";
import { FranchiseAppShell, type FranchiseNavKey } from "./franchise-app-shell";
import type { FranchiseLibraryLoadResult } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** A failed authorized read is recoverable and must never become a false 404 or creation form. */
export function FranchiseAccessPage({ locale, space, reason, returnPath, active }: {
  locale: Locale;
  space: { selectedQuery: string; selectedOrganizationId: string | null; userEmail: string | null; organizations: Array<{ id: string; name: string }>; mandates?: Array<{id:string;organizationId:string;label:string}> };
  reason: Extract<FranchiseLibraryLoadResult, { status: "error" }>["reason"];
  returnPath: string;
  active: FranchiseNavKey;
}) {
  return <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} languagePath={returnPath} active={active} title={locale === "ar" ? "الولوج إلى ملف الامتياز" : "Accès au dossier franchisé"}>
    <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={returnPath.split("?")[0]!} />
    <FranchiseAccessState locale={locale} reason={reason} returnPath={returnPath} />
  </FranchiseAppShell>;
}
