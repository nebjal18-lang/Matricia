"use client";
import Link from "next/link";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { useActionState, useId, useState } from "react";
import type { BookOpeningContext, BookOpeningState } from "@/modules/franchise/data/governance/book-opening";
import { formatMinor } from "@/modules/franchise/data/governance/model";
import { Button } from "@/modules/shared/ui/button";
import { Label } from "@/modules/shared/ui/label";
import { openFranchiseBookForMandate } from "./book-opening-actions";
import { bookOpeningError, bookOpeningMessages } from "./book-opening-messages";
const idle: BookOpeningState = { status: "idle" };
export function FranchiseBookOpeningForm({ context, locale, keys, returnPath }: { context: BookOpeningContext; locale: "fr" | "ar"; keys: string[]; returnPath: string }) {
  const m = bookOpeningMessages(locale), id = useId(), [selection, select] = useState(0);
  const choice = context.choices[selection];
  return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6" dir={locale === "ar" ? "rtl" : "ltr"} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="text-xl font-semibold">{m.title}</h2><p>{m.intro}</p>
    {context.reviewRequired ? <p role="status" className="rounded-xl border border-amber-500 p-3">{m.review}</p> : null}
    {choice ? <><div className="space-y-2"><Label htmlFor={`${id}-choice`}>{m.select}</Label><select id={`${id}-choice`} value={selection} onChange={event => select(Number(event.target.value))} className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base">
      {context.choices.map((value, index) => <option key={`${value.approvedMandateVersionId}:${value.financeRuleId}:${value.currency}`} value={index}>{value.libraryCode} · {value.organizationName} · {value.territoryCode} · {m.version} {value.mandateVersion} · {m.rule} {value.financeRuleVersion} · {value.currency}</option>)}
    </select></div><BookConfirmation key={`${choice.approvedMandateVersionId}:${choice.financeRuleId}:${choice.currency}`} choice={choice} locale={locale} keyValue={keys[selection]} returnPath={returnPath}/></> : <p>{m.empty}</p>}
  </section>;
}
function BookConfirmation({ choice, locale, keyValue, returnPath }: { choice: BookOpeningContext["choices"][number]; locale: "fr" | "ar"; keyValue: string; returnPath: string }) {
  const m = bookOpeningMessages(locale), [state, action, pending] = useActionState(openFranchiseBookForMandate, idle);
  const returnTo = `/${locale}/administration/gouvernance`;
  const mfa = state.status === "error" && state.reason === "MFA_REQUIRED";
  return <form action={action} className="space-y-4">
    <input type="hidden" name="locale" value={locale}/><input type="hidden" name="idempotencyKey" value={keyValue}/>
    <input type="hidden" name="franchiseId" value={choice.franchiseId}/><input type="hidden" name="approvedMandateVersionId" value={choice.approvedMandateVersionId}/>
    <input type="hidden" name="expectedMandateHash" value={choice.expectedMandateHash}/><input type="hidden" name="financeRuleId" value={choice.financeRuleId}/><input type="hidden" name="currency" value={choice.currency}/>
    <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">{m.fee}</dt><dd>{formatMinor(choice.entryFeeMinor, choice.feeCurrency, locale)}</dd></div><div><dt className="text-muted-foreground">{m.currency}</dt><dd dir="ltr">{choice.currency}</dd></div><div><dt className="text-muted-foreground">{m.period}</dt><dd dir="ltr">{choice.effectiveFrom}</dd></div><div><dt className="text-muted-foreground">{m.until}</dt><dd dir="auto">{choice.effectiveUntil ?? m.noEnd}</dd></div></dl>
    <p className="text-sm text-muted-foreground">{m.currencyNote}</p>
    {choice.boundBookId ? <p>{m.existing}</p> : null}
    <Button disabled={pending} className="min-h-11 max-w-full whitespace-normal">{pending ? m.pending : m.submit}</Button>
    <div aria-live="polite" role={state.status === "error" ? "alert" : "status"}>
      {state.status === "success" ? <><p>{m.success}</p><Link className="inline-flex min-h-11 items-center underline" href={`${returnTo}?${new URLSearchParams({ franchiseId: state.franchiseId })}`}>{m.finance}</Link></> : null}
      {state.status === "error" ? <p>{bookOpeningError(state.reason, locale)}</p> : null}
      {mfa ? <Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/securite/compte?${new URLSearchParams({ next: returnPath })}`}>{m.mfa}</Link> : null}
      {state.status === "error" && state.reason === "UNAUTHENTICATED" ? <Link className="inline-flex min-h-11 items-center underline" href={connexionHref(locale, { next: returnPath })}>{m.login}</Link> : null}
      {state.status === "error" && !mfa && state.reason !== "UNAUTHENTICATED" ? <Link className="inline-flex min-h-11 items-center underline" href={returnPath}>{m.retry}</Link> : null}
    </div>
  </form>;
}
