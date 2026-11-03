import { notFound } from "next/navigation";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { FranchiseValidationsWorkbench } from "@/modules/franchise/screens/library/validations-workbench";
import { franchiseMandateName, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseValidationsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string;page?:string;q?:string;type?:string;category?:string;selected?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ locale, organizationId: query.organizationId, franchiseId:query.franchiseId,catalog:{kind:query.type==="SERVICE"||query.type==="QUESTIONNAIRE"||query.type==="RULE"?query.type:"ALL",page:query.page,search:query.q,categoryId:query.category,status:"DRAFT",objectId:query.selected} });
  const c = libraryCopy(locale);
  const mandateName = franchiseMandateName(result);
  return (
    <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="validations" title={c.validationsTitle} lead={c.validationsLead} kicker={c.scope} mandateName={mandateName}>
      <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={`/${locale}/franchise/validations`} />
      {result.status === "error" ? (
        <FranchiseAccessState locale={locale} reason={result.reason} returnPath={`/${locale}/franchise/validations${space.selectedQuery}`} />
      ) : (
        <FranchiseValidationsWorkbench locale={locale} query={space.selectedQuery} workspace={result.workspace} filters={query} />
      )}
    </FranchiseAppShell>
  );
}
