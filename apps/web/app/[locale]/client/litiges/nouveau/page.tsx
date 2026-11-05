import {loadDisputeOpenContext}from"@/modules/client/screens/litiges/open-context";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { getDisputeMessages } from "@/modules/client/screens/litiges/messages";
import { OpenForm } from "@/modules/client/screens/litiges/open-form";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { createServerDisputesRepository } from "@/modules/shared/lib/disputes/server-repository";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function NewDispute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/litiges/nouveau` }));
  const result = await (await createServerDisputesRepository(space.selectedOrganizationId ?? query.organizationId)).list();
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/litiges/nouveau` }));
  const m = getDisputeMessages(locale);
  if (result.status === "error") {
    return (
      <ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} organizations={space.organizations} active="missions" title={m.newCase} kicker={spaceCopy(locale).kicker}>
        <WorkspaceFailure locale={locale} reason={result.reason === "FORBIDDEN" ? "FORBIDDEN" : "UNAVAILABLE"} returnPath={`/${locale}/client/litiges/nouveau${space.selectedQuery}`} supportReference="CLIENT-DISPUTE-OPEN" />
      </ClientAppShell>
    );
  }
  if (!result.value.canOpen) redirect(`/${locale}/client/litiges${space.selectedQuery}`);
  const context=space.selectedOrganizationId?await loadDisputeOpenContext(space.selectedOrganizationId):null;
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName} organizations={space.organizations}
      active="missions"
      title={m.newCase}
      kicker={spaceCopy(locale).kicker}
    >
      <main className="client-page">
        <Card>
          <CardHeader><CardTitle>{m.newCase}</CardTitle></CardHeader>
          <CardContent>
            {context?<OpenForm locale={locale} context={context} m={m} keyValue={randomUUID()} />:<p role="alert">{locale==="ar"?"تعذر تحميل الالتزامات والوثائق المسموح بها. أعد المحاولة.":"Impossible de charger les obligations et pièces autorisées. Réessayez le chargement."}</p>}
          </CardContent>
        </Card>
      </main>
    </ClientAppShell>
  );
}
