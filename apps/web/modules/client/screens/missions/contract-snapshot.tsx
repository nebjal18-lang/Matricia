import {SourceDocumentLinks}from"./source-document-links";
import { serializedDateLabel } from "./serialized-date";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatExactMoney, type ContractMissionDashboard, type ContractSignature, type MissionContractSnapshot } from "@/modules/shared/lib/contracts-missions/model";
import type { MissionMessages } from "./messages";

type Contract = ContractMissionDashboard["contracts"][number];

export function ContractSnapshot({ contract, locale, messages }: { contract: Contract; locale: Locale; messages: MissionMessages }) {
  const deliverables = contract.items.filter((item) => item.type === "DELIVERABLE");
  const exclusions = contract.items.filter((item) => item.type === "EXCLUSION");
  const obligations = contract.items.filter((item) => item.type !== "DELIVERABLE" && item.type !== "EXCLUSION");
  return <section aria-labelledby={`snapshot-${contract.id}`} className="mt-5 rounded-xl border bg-muted/30 p-4">
    <h4 id={`snapshot-${contract.id}`} className="font-semibold">{messages.snapshot}</h4>
    <dl className="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
      <SnapshotDatum label={messages.contractVersionId} value={contract.versionId} mono/>
      <SnapshotDatum label={messages.selectedQuote} value={contract.selectedQuoteVersionId} mono/>
      <SnapshotDatum label={messages.contractHash} value={contract.contentHash} mono/>
      <SnapshotDatum label={messages.changeReason} value={contract.changeReason}/>
      <SnapshotDatum label={messages.snapshotDate} value={serializedDateLabel(contract.createdAt,contract.createdAtLabel)}/>
    </dl>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <ItemList title={messages.acceptedDeliverables} items={deliverables} empty={messages.none}/>
      <ItemList title={messages.acceptedExclusions} items={exclusions} empty={messages.none}/>
    </div>
    {obligations.length ? <ItemList title={messages.contractObligations} items={obligations} empty={messages.none}/> : null}
    <SourceDocumentLinks kind="contract" id={contract.id} versionId={contract.versionId}/>
    <SignatureList signatures={contract.signatures} locale={locale} messages={messages}/>
    <details className="mt-4">
      <summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{messages.versionHistory} ({contract.history.length})</summary>
      <ol className="space-y-3">
        {contract.history.map((version) => <li key={version.id} className="min-w-0 rounded-lg border bg-background p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2"><strong>{messages.version} {version.version}</strong><span dir="ltr">{formatExactMoney(version.priceMinor, version.currency, locale)}</span></div>
          <p className="mt-2">{version.changeReason}</p><SourceDocumentLinks kind="contract" id={contract.id} versionId={version.id}/>
          <dl className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2"><SnapshotDatum label={messages.selectedQuote} value={version.selectedQuoteVersionId} mono/><SnapshotDatum label={messages.contractHash} value={version.contentHash} mono/></dl>
        </li>)}
      </ol>
    </details>
  </section>;
}

export function MissionContractSnapshotView({ snapshot, missionId, locale, messages }: { snapshot: MissionContractSnapshot; missionId: string; locale: Locale; messages: MissionMessages }) {
  const deliverables = snapshot.items.filter((item) => item.type === "DELIVERABLE");
  const exclusions = snapshot.items.filter((item) => item.type === "EXCLUSION");
  const obligations = snapshot.items.filter((item) => item.type !== "DELIVERABLE" && item.type !== "EXCLUSION");
  return <section aria-labelledby={`mission-contract-${missionId}`} className="mt-5 rounded-xl border bg-muted/30 p-4">
    <h4 id={`mission-contract-${missionId}`} className="font-semibold">{messages.missionContractSnapshot}</h4>
    <dl className="mt-3 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
      <SnapshotDatum label={messages.version} value={String(snapshot.version)}/>
      <SnapshotDatum label={messages.contractVersionId} value={snapshot.versionId} mono/>
      <SnapshotDatum label={messages.selectedQuote} value={snapshot.selectedQuoteVersionId} mono/>
      <SnapshotDatum label={messages.contractHash} value={snapshot.contentHash} mono/>
      <SnapshotDatum label={messages.contractAmount} value={formatExactMoney(snapshot.priceMinor, snapshot.currency, locale)}/>
      <SnapshotDatum label={messages.snapshotDate} value={serializedDateLabel(snapshot.createdAt,snapshot.createdAtLabel)}/>
    </dl>
    <p className="mt-3 text-sm"><span className="text-muted-foreground">{messages.changeReason}: </span>{snapshot.changeReason}</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2"><ItemList title={messages.acceptedDeliverables} items={deliverables} empty={messages.none}/><ItemList title={messages.acceptedExclusions} items={exclusions} empty={messages.none}/></div>
    {obligations.length ? <ItemList title={messages.contractObligations} items={obligations} empty={messages.none}/> : null}
    <SignatureList signatures={snapshot.signatures} locale={locale} messages={messages}/>
  </section>;
}

function SnapshotDatum({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className={`mt-1 break-all ${mono ? "font-mono text-xs" : "font-medium"}`} dir={mono ? "ltr" : "auto"}>{value}</dd></div>;
}

function ItemList({ title, items, empty }: { title: string; items: Contract["items"]; empty: string }) {
  return <section className="mt-4"><h5 className="font-medium">{title}</h5>{items.length ? <ol className="mt-2 space-y-2">{items.map((item) => <li key={item.id} className="rounded-lg border bg-background p-3"><span className="font-mono text-xs text-muted-foreground" dir="ltr">{item.key}</span><p className="mt-1" dir="auto">{item.label}</p></li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">{empty}</p>}</section>;
}

function SignatureList({ signatures, messages }: { signatures: ContractSignature[]; locale: Locale; messages: MissionMessages }) {
  return <section className="mt-4"><h5 className="font-medium">{messages.recordedSignatures} ({signatures.length}/2)</h5>{signatures.length ? <ol className="mt-2 space-y-2">{signatures.map((signature) => <li key={signature.id} className="rounded-lg border bg-background p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{signature.signerRole}</strong><time dateTime={signature.signedAt}>{serializedDateLabel(signature.signedAt,signature.signedAtLabel)}</time></div><p className="mt-2 break-all font-mono text-xs" dir="ltr">{messages.signerOrganization}: {signature.organizationId}</p><p className="mt-1 break-all font-mono text-xs" dir="ltr">{messages.signatureMethod}: {signature.method}</p><p className="mt-1 break-all font-mono text-xs" dir="ltr">{messages.evidenceHash}: {signature.evidenceHash}</p></li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">{messages.noSignature}</p>}</section>;
}
