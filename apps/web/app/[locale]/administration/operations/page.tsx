import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { loadAdminOperationsDashboard } from "@/modules/admin/data/operations/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getAdminOperationsMessages } from "@/modules/admin/screens/operations/messages";
import { OperationsDashboard } from "@/modules/admin/screens/operations/operations-dashboard";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminOffFilmGate } from "@/modules/admin/ui/admin-off-film-gate";

export default async function AdminOperationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getAdminOperationsMessages(locale);
  const result = await loadAdminOperationsDashboard();
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/operations` }));

  return (
    <AdminModulePage locale={locale} active="settings" path="operations" title={messages.title} lead={messages.description} hubGroup="ops">
      <AdminOffFilmGate
        locale={locale}
        role={locale === "ar" ? "إشراف الإشعارات والتدقيق وطابور الأحداث" : "Supervision notifications, audit et file d’événements"}
      />
      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{result.reason === "MFA_REQUIRED" ? mfaRequiredMessage(locale) : result.reason === "FORBIDDEN" ? messages.forbidden : messages.unavailable}</AlertTitle>
          <AlertDescription>{result.reason === "MFA_REQUIRED" ? mfaRequiredMessage(locale) : result.reason === "FORBIDDEN" ? messages.forbiddenText : messages.unavailableText}</AlertDescription>
        </Alert>
      ) : (
        <section className="admin-panel space-y-4" data-tone="sky" aria-label={messages.title}>
          <OperationsDashboard dashboard={result.value} locale={locale} messages={messages} />
        </section>
      )}
      <p className="admin-notice" data-tone="sky">
        <Link href={`/${locale}/administration/parcours`} className="font-semibold underline-offset-4 hover:underline">
          {locale === "ar" ? "إشراف المسار التجاري" : "Supervision du parcours métier"}
        </Link>
      </p>
    </AdminModulePage>
  );
}
