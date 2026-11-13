import { formatDateTimeCasablanca, shortReference } from "@/modules/shared/lib/format/display";
import { franchiseeAllocation, formatBps, formatMinor, type FranchiseDashboard } from "@/modules/franchise/data/governance/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { FranchiseMessages } from "./messages";

type Franchise = FranchiseDashboard["franchises"][number];
type Book = FranchiseDashboard["books"][number];

export function GovernanceHistory({ franchise, locale, m, franchiseeOnly = false }: { franchise: Franchise; locale: Locale; m: FranchiseMessages; franchiseeOnly?: boolean }) {
  return <details className="mt-4 rounded-xl border p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">{m.governanceHistory}</summary><div className="mt-3 grid gap-4 xl:grid-cols-2">
    <section><h4 className="font-medium">{m.territoryVersions}</h4><ol className="mt-2 space-y-2">{franchise.territoryVersions.map((territory) => <li key={territory.id} className="rounded-lg border bg-background p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{m.version} {territory.version} · <span dir="ltr">{territory.code}</span></strong><span>{territory.name}</span></div><p className="mt-2 text-muted-foreground">{formatDate(territory.effectiveFrom, locale)} — {territory.effectiveUntil ? formatDate(territory.effectiveUntil, locale) : m.current}</p><Hash label={m.contentHash} value={territory.contentHash}/></li>)}</ol>
    </section>
    <section><h4 className="font-medium">{m.mandateVersions}</h4><ol className="mt-2 space-y-2">{franchise.mandateVersions.map((mandate) => <li key={mandate.id} className="rounded-lg border bg-background p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{m.version} {mandate.version} · {mandate.status}</strong><span>{mandate.entryFeeMode} · {formatMinor(mandate.entryFeeMinor, "MAD", locale)}</span></div>{franchiseeOnly ? null : <p className="mt-2">{formatBps(mandate.franchiseeShareBps)} / {formatBps(mandate.neoxaShareBps)} / {formatBps(mandate.asmaShareBps)}</p>}<p className="mt-1 text-muted-foreground">{m.territoryVersion}: <span dir="ltr">{shortReference(mandate.territoryVersionId)}</span></p><p className="mt-1 text-muted-foreground">{m.ruleVersion}: <span dir="ltr">{shortReference(mandate.economicRuleVersionId)}</span></p><Hash label={m.contentHash} value={mandate.contentHash}/></li>)}</ol>
    </section>
  </div></details>;
}

export function ApprovalHistory({ approvals, locale, m }: { approvals: FranchiseDashboard["approvals"]; locale: Locale; m: FranchiseMessages }) {
  const decided = approvals.filter((approval) => approval.decision);
  if (!decided.length) return null;
  return <section><h2 className="text-2xl font-semibold">{m.approvalHistory}</h2><ol className="mt-4 grid gap-4 lg:grid-cols-2">{decided.map((approval) => <li key={approval.id} className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{approval.requestType}</strong><span>{approval.status}</span></div><p className="mt-2 text-sm">{approval.reason}</p><p className="mt-2 text-sm text-muted-foreground">{formatDate(approval.decision!.decidedAt, locale)} · {approval.decision!.decision}</p><p className="mt-2 text-sm">{approval.decision!.reason}</p><Hash label={m.mandateHash} value={approval.decision!.mandateContentHash}/></li>)}</ol></section>;
}

export function FinanceHistory({ book, locale, m, franchiseeOnly = false }: { book: Book; locale: Locale; m: FranchiseMessages; franchiseeOnly?: boolean }) {
  const shareLabel = locale === "ar" ? "حصتكم" : "Votre part";
  return <details className="mt-4 rounded-xl border p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">{m.immutableFinanceHistory}</summary><div className="mt-3 space-y-5">
    <section><h4 className="font-medium">{m.closureVersions}</h4><ol className="mt-2 space-y-3">{book.closures.map((closure) => { const share = franchiseeAllocation(book.type, closure.allocations); return <li key={closure.id} className="rounded-lg border bg-background p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{m.period} <span dir="ltr">{closure.periodStart} — {closure.periodEnd}</span> · {m.version} {closure.version}</strong><span>{formatMinor(franchiseeOnly && share ? share.amountMinor : closure.profitMinor, book.currency, locale)}</span></div><p className="mt-2 text-muted-foreground">{m.ruleVersion}: <span dir="ltr">{shortReference(closure.ruleVersionId)}</span></p><Hash label={m.contentHash} value={closure.contentHash}/><ul className="mt-3 space-y-1">{(franchiseeOnly ? (share ? [share] : []) : closure.allocations).map((allocation) => <li key={allocation.id} className="flex flex-wrap justify-between gap-2"><span dir="ltr">{franchiseeOnly ? shareLabel : `${allocation.beneficiaryCode} · ${formatBps(allocation.shareBps)}`}</span><strong dir="ltr">{formatMinor(allocation.amountMinor, book.currency, locale)}</strong></li>)}</ul></li>; })}</ol></section>
    <section><h4 className="font-medium">{m.distributionLedger}</h4><ol className="mt-2 space-y-2">{book.ledgerEntries.filter((entry) => !franchiseeOnly || entry.beneficiaryCode === (book.type === "IT" ? "HATIM_AHMITECH" : "FRANCHISEE")).map((entry) => <li key={entry.id} className="rounded-lg border bg-background p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span dir="ltr">#{shortReference(entry.id)} · {entry.entryType}{franchiseeOnly ? "" : ` · ${entry.beneficiaryCode}`}</span><strong dir="ltr">{formatMinor(entry.amountMinor, book.currency, locale)}</strong></div><p className="mt-1 break-all text-muted-foreground" dir="ltr">{entry.referenceType}: {shortReference(entry.referenceId)}</p>{entry.proofHash ? <Hash label={m.proof} value={entry.proofHash}/> : null}</li>)}</ol></section>
  </div></details>;
}

function Hash({ label, value }: { label: string; value: string }) { return <details className="mt-2"><summary className="text-xs text-muted-foreground">{label}</summary><p className="break-all font-mono text-xs" dir="ltr">{shortReference(value, 12)}</p></details>; }
function formatDate(value: string, locale: Locale) {
  return formatDateTimeCasablanca(value, locale);
}
