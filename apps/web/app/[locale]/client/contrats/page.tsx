import{SelectedQuoteIdentity}from"@/modules/client/screens/missions/selected-quote-identity";
import{SignatureReadinessNotice}from"@/modules/shared/ui/signature-readiness-notice";
import { workflowStatusLabel } from "@/modules/shared/lib/i18n/workflow-statuses";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { clientDashboardCopy } from "@/modules/client/data/home/copy";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { loadClientAmendments } from "@/modules/shared/lib/contracts-missions/amendments";
import { formatExactMoney } from "@/modules/shared/lib/contracts-missions/model";
import { loadContractMissions } from "@/modules/shared/lib/contracts-missions/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { AmendmentPanel } from "@/modules/client/screens/missions/amendment-panel";
import { ContractSnapshot } from "@/modules/client/screens/missions/contract-snapshot";
import { SignContractForm, SubmitContractForm } from "@/modules/client/screens/missions/contract-actions";
import { getMissionMessages } from "@/modules/client/screens/missions/messages";
import { MissionPanel } from "@/modules/client/screens/missions/mission-panel";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";

export default async function ClientContractsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string;identityQuote?:string;identityPage?:string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/contrats` }));
  const c = clientDashboardCopy[locale];
  const spaceC = spaceCopy(locale);
  const messages = getMissionMessages(locale);
  const [result, amendments] = await Promise.all([
    loadContractMissions(locale, space.selectedOrganizationId),
    loadClientAmendments(space.selectedOrganizationId),
  ]);
  const contracts = result.status === "success" ? result.dashboard.contracts : [];
  const missionsByContract = result.status === "success"
    ? Object.fromEntries(result.dashboard.missions.map((mission) => [mission.contractId, mission.id]))
    : {};
  return (
    <ClientAppShell
      languagePath={`/${locale}/client/contrats${space.selectedQuery}`}
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      active="contracts"
      title={c.contractsTitle}
      lead={c.contractsLead}
      kicker={spaceC.kicker}
    >
      <main className="client-page space-y-5">
        {result.status === "error" ? (
          <Alert>
            <AlertTitle>{messages.noOrg}</AlertTitle>
            <AlertDescription>{messages.loadError}</AlertDescription>
          </Alert>
        ) : contracts.length === 0 ? (
          <p>{c.contractsEmpty}</p>
        ) : (
          <ul className="space-y-4">
            {contracts.map((contract) => {
              const missionId = missionsByContract[contract.id];
              return (
                <li key={contract.id} id={`contrat-${contract.id}`} className="client-card space-y-4 p-5">
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground" dir="ltr">{contract.id}</p>
                      <h2 className="mt-1 text-lg font-semibold">{contract.title || (locale==="fr"?"Contrat — objet à préciser":"عقد — موضوع يحتاج إلى توضيح")}<span className="block text-sm font-normal">{messages.version} {contract.currentVersion} · {workflowStatusLabel(contract.status,locale)}</span></h2>
                      <p className="mt-1 text-sm text-muted-foreground">{c.contractsSign} {contract.signatureCount}/2</p>
                    </div>
                    <p className="font-semibold" dir="ltr">{formatExactMoney(contract.priceMinor, contract.currency, locale)}</p>
                  </header>
                  <ContractSnapshot contract={contract} locale={locale} messages={messages} />
                  {result.status==="success"&&["DRAFT","PENDING_SIGNATURE"].includes(contract.status)?<SelectedQuoteIdentity navigationQuery={query} locale={locale} organizationId={result.dashboard.organizationId} quoteVersionId={contract.selectedQuoteVersionId} contract={{id:contract.id,versionId:contract.versionId,contentHash:contract.contentHash,status:contract.status}}/>:null}
                  {result.status === "success" && contract.status === "DRAFT" ? (
                    <SubmitContractForm contract={contract} locale={locale} messages={messages} />
                  ) : null}
                  {result.status === "success" && contract.status === "PENDING_SIGNATURE" ? (
                    <SignContractForm contract={contract} organizationId={result.dashboard.organizationId} locale={locale} messages={messages} />
                  ) : null}
                  {contract.status!=="DRAFT"&&contract.status!=="PENDING_SIGNATURE"?<SignatureReadinessNotice locale={locale} readiness={contract.signatureReadiness}/>:null}
                  {missionId ? (
                    <Link href={`/${locale}/client/missions/${missionId}${space.selectedQuery}`} className="client-text-link">
                      {c.contractsOpenMission}
                    </Link>
                  ) : (
                    <Link href={`/${locale}/client/missions${space.selectedQuery}`} className="client-text-link">
                      {messages.missions}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {result.status === "success" ? (
          <details className="client-ops">
            <summary>{spaceC.opsMissions}</summary>
            <div className="space-y-6">
              <MissionPanel d={result.dashboard} locale={locale} m={messages} />
              {amendments.status==="error"?<p role="alert">{locale==="fr"?"Les avenants sont momentanément indisponibles ou nécessitent une nouvelle vérification de vos droits. Les autres données restent consultables.":"ملاحق العقود غير متاحة مؤقتاً أو تتطلب التحقق مجدداً من الصلاحيات. ما تزال البيانات الأخرى متاحة."}</p>:null}
              {amendments.status === "success" && amendments.value.organizationId === result.dashboard.organizationId ? (
                <AmendmentPanel
                  d={amendments.value}
                  locale={locale}
                  keys={Object.fromEntries(amendments.value.items.flatMap((item) => [[`submit:${item.id}`, randomUUID()], [`sign:${item.id}`, randomUUID()]]))}
                />
              ) : null}
            </div>
          </details>
        ) : null}
      </main>
    </ClientAppShell>
  );
}
