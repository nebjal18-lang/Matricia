import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { FranchiseQuestionnaireConstructor } from "@/modules/franchise/screens/library/constructors";
import { requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function FranchiseQuestionnaireDetailPage({ params, searchParams }: { params: Promise<{ locale: string; questionnaireId: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string }> }) {
  const [{ locale, questionnaireId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({ locale, organizationId: query.organizationId, franchiseId:query.franchiseId,catalog:{kind:"QUESTIONNAIRE",objectId:questionnaireId} });
  if (result.status !== "success") notFound();
  const item = result.workspace.questionnaires.find((row) => row.id === questionnaireId);
  if (!item) notFound();
  const c = libraryCopy(locale);
  return (
    <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="questionnaires" title={c.questionnaireConstructorTitle} lead={c.questionnaireConstructorLead} kicker={c.scope} mandateName={result.workspace.mandate.libraryName}>
      <FranchiseQuestionnaireConstructor
        locale={locale}
        query={space.selectedQuery}
        workspace={result.workspace}
        selectedId={item.id}
        createMode={false}
        commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }}
        organizationId={space.selectedOrganizationId}
      />
    </FranchiseAppShell>
  );
}
