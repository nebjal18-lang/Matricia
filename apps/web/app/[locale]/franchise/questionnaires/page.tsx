import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { FranchiseAccessState, FranchiseOrganizationSelector } from "@/modules/franchise/ui/franchise-access-state";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { FranchiseQuestionnairesWorkbench } from "@/modules/franchise/screens/library/library-workbenches";
import { requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseSecurityPanel } from "@/modules/franchise/screens/library/library-chrome";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseQuestionnairesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string;page?:string;status?:string;category?:string;language?:string;completeness?:string;validation?:string; q?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ locale, organizationId: query.organizationId, franchiseId:query.franchiseId,catalog:{kind:"QUESTIONNAIRE",page:query.page,search:query.q,status:query.status,categoryId:query.category,language:query.language,completeness:query.completeness,validation:query.validation,} });
  const c = libraryCopy(locale);
  return (
    <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="questionnaires" title={c.questionnairesTitle} lead={c.questionnairesLead} kicker={c.scope} mandateName={result.status === "success" ? result.workspace.mandate.libraryName : null} actions={result.status === "success" ? <FranchiseSecurityPanel locale={locale} /> : null}>
      <FranchiseOrganizationSelector locale={locale} organizations={space.organizations} selectedOrganizationId={space.selectedOrganizationId} returnPath={`/${locale}/franchise/questionnaires`} />
      {result.status === "error" ? (
        <FranchiseAccessState locale={locale} reason={result.reason} returnPath={`/${locale}/franchise/questionnaires${space.selectedQuery}`} />
      ) : (
        <FranchiseQuestionnairesWorkbench
          locale={locale}
          query={space.selectedQuery}
          workspace={result.workspace}
          selectedId={null}
          createMode={false}
          search={query.q ?? ""}
          commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }}
        />
      )}
    </FranchiseAppShell>
  );
}
