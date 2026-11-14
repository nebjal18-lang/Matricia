import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription } from "@/modules/shared/ui/alert";
import { mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { loadAdminIncentives } from "@/modules/admin/data/incentives/server-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { IncentivesPanel } from "@/modules/admin/screens/incitations/incentives-panel";
import { messages } from "@/modules/admin/screens/incitations/messages";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const r = await loadAdminIncentives();
  if (r.status === "error" && r.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/incitations` }));
  const m = messages[locale];
  return (
    <AdminModulePage locale={locale} active="parcours" parcoursCurrent="reputation" path="incitations" title={m.title} lead={m.description}>
      <Alert><AlertDescription>{m.security}</AlertDescription></Alert>
      {r.status === "error" ? (
        <p role="alert" className="text-destructive">{r.reason === "MFA_REQUIRED" ? mfaRequiredMessage(locale) : m.loadError}</p>
      ) : (
        <IncentivesPanel
          locale={locale}
          d={r.value}
          keys={{
            rule: randomUUID(),
            policy: randomUUID(),
            evaluate: randomUUID(),
            refresh: randomUUID(),
            checklist: randomUUID(),
            decisions: Object.fromEntries(r.value.evaluations.map((x) => [String(x.id), randomUUID()])),
          }}
        />
      )}
    </AdminModulePage>
  );
}
