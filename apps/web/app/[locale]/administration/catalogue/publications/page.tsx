import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { buttonVariants } from "@/modules/shared/ui/button";
import { loadPublicationDashboard } from "@/modules/shared/lib/catalogue-publications/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { cn } from "@/modules/shared/lib/utils";
import { getPublicationMessages } from "@/modules/admin/screens/catalogue/publications/messages";
import { PublicationPanel } from "@/modules/admin/screens/catalogue/publications/publication-panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminStep1Gate } from "@/modules/admin/ui/admin-step1-gate";

export const dynamic = "force-dynamic";

export default async function CataloguePublicationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const result = await loadPublicationDashboard();
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/catalogue/publications` }));
  const messages = getPublicationMessages(locale);
  const commandIds = result.status === "success"
    ? Object.fromEntries(result.value.libraries.map((library) => [library.id, { idempotencyKey: randomUUID(), correlationId: randomUUID() }]))
    : {};
  return (
    <AdminModulePage locale={locale} active="catalog" path="catalogue/publications" title={messages.title} lead={messages.description}>
      <AdminStep1Gate locale={locale} current="publications" />
      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{result.reason === "FORBIDDEN" ? messages.forbidden : messages.unavailable}</AlertTitle>
          <AlertDescription>
            <Link href={`/${locale}/administration/catalogue/publications`} className={cn(buttonVariants({ variant: "outline" }), "mt-3 min-h-11")}>{messages.retry}</Link>
          </AlertDescription>
        </Alert>
      ) : (
        <PublicationPanel locale={locale} dashboard={result.value} messages={messages} commandIds={commandIds} />
      )}
    </AdminModulePage>
  );
}
