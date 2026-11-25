import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadMarketingGovernance } from "@/modules/shared/lib/marketing-autopilot/governance-repository";
import { loadMarketingDimensionLabels } from "@/modules/shared/lib/marketing-autopilot/dimension-labels";
import { loadMarketingDashboard } from "@/modules/shared/lib/marketing-autopilot/repository";
import { GovernancePanel } from "@/modules/admin/screens/marketing-autopilot/governance-panel";
import { MarketingPanel } from "@/modules/admin/screens/marketing-autopilot/marketing-panel";
import { getMarketingMessages } from "@/modules/admin/screens/marketing-autopilot/messages";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminOffFilmGate } from "@/modules/admin/ui/admin-off-film-gate";

export default async function MarketingAutopilotPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = getMarketingMessages(locale);
  const [result, governance] = await Promise.all([loadMarketingDashboard(), loadMarketingGovernance()]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/marketing-autopilot` }));
  const keys: Record<string, string> = {
    consent: randomUUID(),
    campaign: randomUUID(),
    scheduleRule: randomUUID(),
    brandKit: randomUUID(),
    brandEvidenceReview: randomUUID(),
    templates: randomUUID(),
    brandAuthorization: randomUUID(),
    connectionSecurity: randomUUID(),
    killSwitch: randomUUID(),
  };
  if (result.status === "success") {
    result.dashboard.campaigns.forEach((value) => {
      keys[`approve:${value.id}`] = randomUUID();
      keys[`schedule:${value.id}`] = randomUUID();
    });
    result.dashboard.scheduleRules.forEach((value) => {
      keys[`activateRule:${value.id}`] = randomUUID();
    });
    result.dashboard.calendars.forEach((value) => {
      keys[`approveCalendar:${value.id}`] = randomUUID();
    });
  }
  const dimensionLabels = result.status === "success" ? await loadMarketingDimensionLabels(result.dashboard, locale) : {};
  return (
    <AdminModulePage locale={locale} active="pilot" path="marketing-autopilot" title={m.title} lead={m.subtitle}>
      <AdminOffFilmGate
        locale={locale}
        role={locale === "ar" ? "تشغيل الحملات التسويقية بموافقة وموافقة المحتوى" : "Pilotage des campagnes marketing avec consentement et validation de contenu"}
      />
      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{result.reason === "FORBIDDEN" ? m.accessDenied : m.loadFailed}</AlertTitle>
          <AlertDescription>{result.reason}</AlertDescription>
        </Alert>
      ) : (
        <>
          <GovernancePanel dashboard={result.dashboard} data={governance ?? { authorizations: [], securityVersions: [], killSwitches: [] }} locale={locale} keys={keys} />
          <MarketingPanel dashboard={result.dashboard} dimensionLabels={dimensionLabels} locale={locale} m={m} keys={keys} />
        </>
      )}
    </AdminModulePage>
  );
}
