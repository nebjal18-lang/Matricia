import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { ActionPanel } from "@/modules/client/screens/litiges/action-panel";
import { DisputesBoard } from "@/modules/client/screens/spaces/disputes-board";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { getProviderDisputeMessages } from "@/modules/provider/screens/litiges/messages";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { formatMinorAmount } from "@/modules/shared/lib/disputes/model";
import { createServerDisputesRepository } from "@/modules/shared/lib/disputes/server-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

function date(value: string | null, locale: "fr" | "ar") {
  return value ? new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

export default async function ProviderDisputePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; caseId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale, caseId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/litiges/${caseId}` }));
  const repository = await createServerDisputesRepository(space.selectedOrganizationId ?? query.organizationId, "provider");
  const [list, result] = await Promise.all([repository.list(), repository.detail(caseId)]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/litiges/${caseId}` }));
  if (list.status === "error" && list.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/litiges/${caseId}` }));
  if (result.status === "error" || !result.value) notFound();
  const d = result.value;
  const m = getProviderDisputeMessages(locale);
  const keys = Object.fromEntries(["respond", "appeal", "decide", "propose", "approve", "activate"].map((x) => [x, randomUUID()]));
  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="disputes" title={m.title} lead={d.obligationKey}>
      <DisputesBoard
        locale={locale}
        query={space.selectedQuery}
        organizationName={space.organizationName}
        cases={list.status === "success" ? list.value.cases : [d]}
        selected={d}
        messages={m}
        canOpen={false}
        hrefPrefix={`/${locale}/sous-traitant/litiges`}
      >
        <ActionPanel locale={locale} d={d} m={m} keys={keys} />
      </DisputesBoard>
      <details className="client-ops">
        <summary>{m.actions}</summary>
        <dl className="client-fact-grid">
          <div><small>{m.policy}</small><span>{d.policyVersion}</span></div>
          <div><small>{m.deadline}</small><span>{date(d.responseDueAt, locale)}</span></div>
          <div><small>{m.reviewDeadline}</small><span>{date(d.reviewDueAt, locale)}</span></div>
          <div><small>{m.appealDeadline}</small><span>{date(d.appealDueAt, locale)}</span></div>
        </dl>
        {d.decisions.map((item) => (
          <article key={item.id} className="client-card">
            <h3>{m.decisionNumber}{item.number} · {m.outcomes[item.outcome]}</h3>
            <p>{item.reason}</p>
          </article>
        ))}
        {d.appeal ? <article className="client-card"><h3>{m.appealTitle}</h3><p>{d.appeal.grounds}</p></article> : null}
        {d.reassignment ? (
          <article className="client-card">
            <h3>{m.reassignment}</h3>
            <p>{m.originalCost}: <strong dir="ltr">{formatMinorAmount(d.reassignment.originalCostMinor, d.reassignment.currency, locale)}</strong></p>
            <p>{m.costDelta}: <strong dir="ltr">{formatMinorAmount(d.reassignment.costDeltaMinor ?? "0", d.reassignment.currency, locale)}</strong></p>
          </article>
        ) : null}
      </details>
    </ProviderAppShell>
  );
}
