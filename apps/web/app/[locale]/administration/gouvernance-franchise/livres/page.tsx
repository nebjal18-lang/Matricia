import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { FranchiseBookOpeningPanel } from "@/modules/franchise/screens/gouvernance/book-opening-panel";
import { bookOpeningMessages } from "@/modules/franchise/screens/gouvernance/book-opening-messages";
export default async function FranchiseBooksPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ franchiseId?: string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  if (query.franchiseId && !z.string().uuid().safeParse(query.franchiseId).success) notFound();
  const m = bookOpeningMessages(locale);
  return <AdminModulePage locale={locale} active="finance" path="gouvernance-franchise/livres" querySuffix={query.franchiseId ? new URLSearchParams({ franchiseId: query.franchiseId }).toString() : undefined} title={m.title} lead={m.intro}>
    <div className="client-page space-y-5"><Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/administration/gouvernance${query.franchiseId ? `?${new URLSearchParams({ franchiseId: query.franchiseId })}` : ""}`}>{m.back}</Link><FranchiseBookOpeningPanel locale={locale} franchiseId={query.franchiseId}/></div>
  </AdminModulePage>;
}
