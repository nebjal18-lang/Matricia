import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { sensitivePageContext } from "@/modules/admin/ui/sensitive-page-context";
import { GovernanceInspector } from "@/modules/franchise/screens/performance/governance-inspector";
export default async function GovernanceSignalPage({ params }: { params: Promise<{ locale: string; requestId: string }> }) {
  const { locale, requestId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(requestId).success) notFound();
  const ar = locale === "ar";
  const context = await sensitivePageContext({ locale, active: "pilot", path: `gouvernance-franchise/signalements/${requestId}`, title: ar ? "مراجعة وقائع حكامة الامتياز" : "Examen des faits de gouvernance franchise", roles: ["SUPER_ADMIN", "MATRICIA_ADMIN"] });
  if (context.status === "blocked") return context.view;
  return context.wrap(<main className="client-page space-y-5"><Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/administration/command-center`}>{ar ? "العودة للمهام الإدارية" : "Retour aux tâches administratives"}</Link><GovernanceInspector locale={locale} requestId={requestId}/></main>);
}
