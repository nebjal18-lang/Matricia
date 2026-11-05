import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { DisputesBoard } from "@/modules/client/screens/spaces/disputes-board";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { getDisputeMessages } from "@/modules/client/screens/litiges/messages";
import { createServerDisputesRepository } from "@/modules/shared/lib/disputes/server-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";

export default async function DisputesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { locale } = await params;
  const { organizationId } = await searchParams;
  if (!isLocale(locale)) notFound();

  const space = await resolveClientSpace({ locale, organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/litiges` }));

  const repository = await createServerDisputesRepository(space.selectedOrganizationId ?? organizationId);
  const result = await repository.list();
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/litiges` }));
  const m = getDisputeMessages(locale);
  const c = spaceCopy(locale);
  const selfHref = `/${locale}/client/litiges${space.selectedQuery}`;
  if (result.status === "error") {
    return (
      <ClientAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} organizations={space.organizations} title={m.title} lead={m.intro} kicker={space.organizationName ?? c.kicker}>
        <WorkspaceFailure locale={locale} reason={result.reason === "FORBIDDEN" ? "FORBIDDEN" : "UNAVAILABLE"} returnPath={selfHref} supportReference="CLIENT-DISPUTES" />
      </ClientAppShell>
    );
  }

  const selectedId = result.value.cases[0]?.id;
  const selected = selectedId ? await repository.detail(selectedId) : { status: "success" as const, value: null };
  if (selected.status === "error" && selected.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/litiges` }));

  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName} organizations={space.organizations}
      title={m.title}
      lead={m.intro}
      kicker={space.organizationName ?? c.kicker}
      actions={
        result.value.canOpen ? (
          <Link href={`/${locale}/client/litiges/nouveau${space.selectedQuery}`} className="client-cta">
            {m.newCase}
          </Link>
        ) : (
          <Link href={`/${locale}/contact${space.selectedQuery}`} className="client-cta">
            {c.contactAssist}
          </Link>
        )
      }
    >
      {selected.status === "error" ? <WorkspaceFailure locale={locale} reason={selected.reason === "FORBIDDEN" ? "FORBIDDEN" : "UNAVAILABLE"} returnPath={selfHref} supportReference="CLIENT-DISPUTE-DETAIL" /> : null}
      <DisputesBoard
        locale={locale}
        query={space.selectedQuery}
        organizationName={space.organizationName}
        cases={result.value.cases}
        selected={selected.status === "success" ? selected.value : null}
        messages={m}
        canOpen={result.value.canOpen}
      />
    </ClientAppShell>
  );
}
