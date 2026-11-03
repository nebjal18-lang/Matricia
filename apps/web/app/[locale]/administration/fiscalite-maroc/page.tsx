import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadMoroccoTaxDashboard } from "@/modules/shared/lib/morocco-tax/repository";
import { getMoroccoTaxMessages } from "@/modules/admin/screens/fiscalite-maroc/messages";
import { TaxPanel } from "@/modules/admin/screens/fiscalite-maroc/tax-panel";
import { sensitivePageContext } from "@/modules/admin/ui/sensitive-page-context";

export default async function MoroccoTaxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMoroccoTaxMessages(locale);
  const context = await sensitivePageContext({ locale, path: "fiscalite-maroc", active: "catalog", title: m.title, lead: m.subtitle, roles: ["SUPER_ADMIN", "FINANCE_MANAGER"] });
  if (context.status === "blocked") return context.view;
  const result = await loadMoroccoTaxDashboard();
  const keys: Record<string, string> = { proposal: randomUUID() };
  if (result.status === "success") result.dashboard.rules.forEach((rule) => { keys[rule.id] = randomUUID(); });
  return context.wrap(
    <main className="client-page">
      <Link href={`/${locale}/administration/classification-fiscale`} className="inline-flex min-h-11 items-center rounded border px-3 py-2">{locale === "ar" ? "ربط الخدمات بفئات ضريبية معتمدة" : "Associer les services aux catégories fiscales validées"}</Link>
      {result.status === "error" ? (
        <WorkspaceFailure locale={locale} reason={result.reason === "AAL2_REQUIRED" ? "MFA_REQUIRED" : result.reason} returnPath={context.selfPath} />
      ) : (
        <TaxPanel dashboard={result.dashboard} locale={locale} m={m} keys={keys} />
      )}
    </main>
  );
}
