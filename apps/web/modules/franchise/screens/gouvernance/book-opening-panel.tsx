import { randomUUID } from "node:crypto";
import Link from "next/link";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadBookOpeningContext } from "./book-opening-actions";
import { FranchiseBookOpeningForm } from "./book-opening-form";
import { bookOpeningError, bookOpeningMessages } from "./book-opening-messages";
export async function FranchiseBookOpeningPanel({ locale, franchiseId }: { locale: "fr" | "ar"; franchiseId?: string }) {
  const m = bookOpeningMessages(locale);
  const path = `/${locale}/administration/gouvernance-franchise/livres${franchiseId ? `?${new URLSearchParams({ franchiseId })}` : ""}`;
  const result = await loadBookOpeningContext(franchiseId);
  if (result.status === "error") return <section className="space-y-3 rounded-2xl border p-4" dir={locale === "ar" ? "rtl" : "ltr"}>
    <h2 className="text-xl font-semibold">{m.title}</h2><p role="alert">{bookOpeningError(result.reason, locale)}</p>
    {result.reason === "MFA_REQUIRED" ? <Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/securite/compte?${new URLSearchParams({ next: path })}`}>{m.mfa}</Link>
      : result.reason === "UNAUTHENTICATED" ? <Link className="inline-flex min-h-11 items-center underline" href={connexionHref(locale, { next: path })}>{m.login}</Link>
        : <Link className="inline-flex min-h-11 items-center underline" href={path}>{m.retry}</Link>}
  </section>;
  return <FranchiseBookOpeningForm locale={locale} context={result.context} keys={result.context.choices.map(() => randomUUID())} returnPath={path}/>;
}
