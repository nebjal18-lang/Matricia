import { redirect } from "next/navigation";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { FRANCHISE_VALIDATION_BUCKETS, FranchiseValidationsWorkbench } from "@/modules/franchise/screens/library/validations-workbench";
import { franchiseMandateName, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseValidationBucketPage({ params, searchParams }: { params: Promise<{ locale: string; bucket: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string;q?:string;type?:string;category?:string;selected?:string;page?:string }> }) {
  const [{ locale, bucket }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !(bucket in FRANCHISE_VALIDATION_BUCKETS)) redirect("/fr/franchise/validations");
  const { space, result } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/validations/${bucket}`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId, catalog: { kind: query.type === "SERVICE" || query.type === "QUESTIONNAIRE" || query.type === "RULE" ? query.type : "ALL", search: query.q, page: query.page, categoryId: query.category, objectId: query.selected, status: ({ brouillons: "DRAFT", "en-cours": "REVIEW", corrections: "RETURNS", approuves: "APPROVED", publications: "PUBLISHED", historique: "ALL" } as Record<string, string>)[bucket] } });
  const c = libraryCopy(locale);
  const mandateName = franchiseMandateName(result);
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="validations" title={c.validationsTitle} lead={c.validationsLead} kicker={c.scope} mandateName={mandateName}>
      <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={`/${locale}/franchise/validations/${bucket}`} />
      {result.status === "error" ? (
        <FranchiseAccessState locale={locale} reason={result.reason} returnPath={`/${locale}/franchise/validations/${bucket}${space.selectedQuery}`} />
      ) : (
        <FranchiseValidationsWorkbench locale={locale} query={space.selectedQuery} workspace={result.workspace} filters={query} bucket={bucket} />
      )}
    </FranchiseAppShell>
  );
}
