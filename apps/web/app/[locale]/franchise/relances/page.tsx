import { FranchiseAccessPage } from "@/modules/franchise/ui/franchise-access-page";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { loadFranchiseFollowups } from "@/modules/franchise/data/followups/repository";
import { FollowupsBoard } from "@/modules/franchise/screens/spaces/boards";
import { FollowupPanel } from "@/modules/franchise/screens/relances/panel";
import { getFollowupMessages } from "@/modules/franchise/screens/relances/messages";
import { franchiseMandateName, loadFranchiseSpaceFromLibrary, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchiseFollowupsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result: library } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/relances`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  if (library.status === "error") return <FranchiseAccessPage locale={locale} space={space} reason={library.reason} active="followups" returnPath={space.currentPath} />;
  const m = getFollowupMessages(locale);
  const r = await loadFranchiseFollowups(library.status === "success" ? library.workspace.mandate.franchiseId : "00000000-0000-4000-8000-000000000000");
  if (r.status === "error" && r.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: space.currentPath }));
  const c = franchiseCopy(locale);
  const mandateName = franchiseMandateName(library);
  const board=await loadFranchiseSpaceFromLibrary({locale,query:space.selectedQuery,result:library});
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="followups" title={c.folTitle} lead={c.folLead} kicker={c.kicker} mandateName={mandateName}>
      <FollowupsBoard locale={locale} query={space.selectedQuery} mandateName={mandateName} board={board} />
      <details id="relances" className="client-ops" open>
        <summary>{c.opsFollow}</summary>
        {r.status === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>{r.reason === "FORBIDDEN" ? m.accessDenied : m.loadFailed}</AlertTitle>
            <AlertDescription>{r.reason}</AlertDescription>
          </Alert>
        ) : (
          <FollowupPanel dashboard={r.dashboard} locale={locale} m={m} keyValue={randomUUID()} />
        )}
      </details>
    </FranchiseAppShell>
  );
}
