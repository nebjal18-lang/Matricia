import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { buttonVariants } from "@/modules/shared/ui/button";
import { adminV41Modules, type AdminV41Module } from "@/modules/admin/data/v41/model";
import { loadAdminV41ExternalValidations, loadAdminV41Overview } from "@/modules/admin/data/v41/repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { cn } from "@/modules/shared/lib/utils";
import { getAdminV41Messages } from "@/modules/admin/screens/v4-1/module/messages";
import { AdminV41OverviewPanel } from "@/modules/admin/screens/v4-1/module/overview-panel";
import { ExternalValidationPanel } from "@/modules/admin/screens/v4-1/module/validation-panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminOffFilmGate } from "@/modules/admin/ui/admin-off-film-gate";

export const dynamic = "force-dynamic";

export default async function AdminV41Page({ params }: { params: Promise<{ locale: string; module: string }> }) {
  const { locale, module } = await params;
  if (!isLocale(locale) || !adminV41Modules.includes(module as AdminV41Module)) notFound();
  const selected = module as AdminV41Module;
  const [result, validations] = await Promise.all([loadAdminV41Overview(), loadAdminV41ExternalValidations()]);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/v4-1/${module}` }));
  const m = getAdminV41Messages(locale);
  return (
    <AdminModulePage locale={locale} active="settings" path={`v4-1/${selected}`} title={m.title} lead={m.intro}>
      <AdminOffFilmGate
        locale={locale}
        role={locale === "ar" ? "وحدات V4.1 الخارجية والمراجعات" : "Modules V4.1 et validations externes"}
      />
      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{result.reason === "FORBIDDEN" ? m.forbidden : m.unavailable}</AlertTitle>
          <AlertDescription>
            <Link href={`/${locale}/administration/v4-1/${selected}`} className={cn(buttonVariants({ variant: "outline" }), "mt-3 min-h-11")}>{m.retry}</Link>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <AdminV41OverviewPanel overview={result.value} selected={selected} locale={locale} m={m} />
          {validations.status === "success" ? (
            <ExternalValidationPanel
              dashboard={validations.value}
              locale={locale}
              module={selected}
              submitKey={randomUUID()}
              decisionKeys={Object.fromEntries(validations.value.cases.map((x) => [x.id, randomUUID()]))}
            />
          ) : (
            <Alert variant="destructive"><AlertTitle>{m.unavailable}</AlertTitle></Alert>
          )}
        </>
      )}
    </AdminModulePage>
  );
}
