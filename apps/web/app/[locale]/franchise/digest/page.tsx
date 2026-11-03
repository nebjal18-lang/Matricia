import { FranchiseAccessPage } from "@/modules/franchise/ui/franchise-access-page";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { loadFranchiseDigest } from "@/modules/franchise/data/digest/repository";
import { FranchiseHomeBoard } from "@/modules/franchise/screens/spaces/boards";
import { FranchiseDigestPanel } from "@/modules/franchise/screens/digest/digest-panel";
import { getFranchiseDigestMessages } from "@/modules/franchise/screens/digest/messages";
import { franchiseMandateName, loadFranchiseSpaceFromLibrary, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchiseDigestPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result: library } = await requireFranchiseLibrary({ returnPath: `/${locale}/franchise/digest`, returnQuery: query, locale, organizationId: query.organizationId, franchiseId:query.franchiseId });
  if (library.status === "error") return <FranchiseAccessPage locale={locale} space={space} reason={library.reason} active="followups" returnPath={space.currentPath} />;
  const board=await loadFranchiseSpaceFromLibrary({locale,query:space.selectedQuery,result:library});
  const m = getFranchiseDigestMessages(locale);
  const result = await loadFranchiseDigest(library.status === "success" ? library.workspace.mandate.franchiseId : "00000000-0000-4000-8000-000000000000");
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: space.currentPath }));
  const c = franchiseCopy(locale);
  const mandateName = franchiseMandateName(library);
  const keys: Record<string, string> = {};
  if (result.status === "success") for (const franchise of result.dashboard.franchises) keys[franchise.id] = randomUUID();
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="home" title={c.homeTitle} lead={c.homeLead} kicker={c.kicker} mandateName={mandateName}>
      <FranchiseHomeBoard board={board} locale={locale} query={space.selectedQuery} mandateName={mandateName} />
      <details className="client-ops">
        <summary>{c.opsDigest}</summary>
        {result.status === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>{result.reason === "FORBIDDEN" ? m.accessDenied : m.queryFailed}</AlertTitle>
            <AlertDescription>{result.reason === "FORBIDDEN" ? m.forbidden : m.queryFailedBody}</AlertDescription>
          </Alert>
        ) : (
          <FranchiseDigestPanel dashboard={result.dashboard} locale={locale} m={m} keys={keys} />
        )}
      </details>
    </FranchiseAppShell>
  );
}
