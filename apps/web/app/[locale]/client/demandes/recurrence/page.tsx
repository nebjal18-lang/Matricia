import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { expiredDocuments } from "@/modules/client/data/documents/expiry";
import { loadClientDocumentVault } from "@/modules/client/data/documents/server-repository";
import { createServerClientRecurringRepository } from "@/modules/client/data/recurring/server-repository";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { newRequestBlockReason } from "@/modules/client/screens/abonnement/entitlement";
import { getClientRecurringMessages } from "@/modules/client/screens/demandes/recurrence/messages";
import { RecurringPanel } from "@/modules/client/screens/demandes/recurrence/recurring-panel";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadSubscriptionDashboard } from "@/modules/shared/lib/subscriptions/repository";

export default async function ClientRecurringPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/demandes/recurrence` }));
  const messages = getClientRecurringMessages(locale);
  const c = spaceCopy(locale);
  const result = await (await createServerClientRecurringRepository()).load(space.selectedOrganizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/demandes/recurrence` }));
  const entitlementOrgId = space.selectedOrganizationId ?? query.organizationId;
  const [subscription, vault] = entitlementOrgId
    ? await Promise.all([loadSubscriptionDashboard(entitlementOrgId), loadClientDocumentVault(entitlementOrgId)])
    : [{ status: "error" as const, reason: "UNAVAILABLE" as const }, { status: "error" as const, reason: "UNAVAILABLE" as const }];
  const block = newRequestBlockReason({
    subscriptionStatus: subscription.status === "success" ? subscription.dashboard.subscription?.status : undefined,
    expiredDocumentCount: vault.status === "success" ? vault.value.expiredDocumentCount ?? expiredDocuments(vault.value.documents).length : 0,
  });
  const today = new Date();
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 366);
  const identity = () => ({ idempotencyKey: randomUUID(), correlationId: randomUUID() });
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      active="requests"
      title={messages.title}
      lead={messages.description}
      kicker={c.kicker}
    >
      <main className="client-page space-y-6">
        <Alert>
          <AlertTitle>{messages.safetyTitle}</AlertTitle>
          <AlertDescription>{messages.safety}</AlertDescription>
        </Alert>
        {block ? (
          <Alert>
            <AlertTitle>{block === "document" ? messages.expiredDocumentBlock : messages.trialExpiredBlock}</AlertTitle>
            <AlertDescription>
              <Link className="underline" href={`/${locale}/client/${block === "document" ? "documents" : "abonnement"}${space.selectedQuery}`}>
                {block === "document" ? c.addDoc : messages.reactivateGold}
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}
        {result.status === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>{result.reason === "FORBIDDEN" ? messages.forbidden : messages.loadError}</AlertTitle>
            <AlertDescription>
              <Link className="underline" href={`/${locale}/client/demandes/recurrence${space.selectedQuery}`}>{messages.retry}</Link>
            </AlertDescription>
          </Alert>
        ) : (
          <RecurringPanel
            dashboard={result.value}
            locale={locale}
            messages={messages}
            today={today.toISOString().slice(0, 10)}
            horizon={horizon.toISOString().slice(0, 10)}
            canOpenNew={!block}
            identities={{
              clone: identity(),
              create: identity(),
              plans: Object.fromEntries(result.value.plans.map((plan) => [plan.id, { transition: identity(), generate: identity() }])),
            }}
          />
        )}
      </main>
    </ClientAppShell>
  );
}
