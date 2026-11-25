import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { FranchiseAccessState } from "@/modules/franchise/ui/franchise-access-state";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { FranchiseRuleConstructor } from "@/modules/franchise/screens/library/constructors";
import { requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseNewRulePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/regles/nouvelle`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId,catalog:{kind:"RULE"} });
  const c = libraryCopy(locale);
  const returnPath = `/${locale}/franchise/regles/nouvelle${space.selectedQuery}`;
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="rules" title={c.ruleConstructorTitle} lead={c.ruleConstructorLead} kicker={c.scope} mandateName={result.status === "success" ? result.workspace.mandate.libraryName : null}>
      {result.status === "error" ? (
        <FranchiseAccessState locale={locale} reason={result.reason} returnPath={returnPath} />
      ) : (
        <FranchiseRuleConstructor locale={locale} query={space.selectedQuery} workspace={result.workspace} selectedId={null} createMode commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }} organizationId={space.selectedOrganizationId} />
      )}
    </FranchiseAppShell>
  );
}
