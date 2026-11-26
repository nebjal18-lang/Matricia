import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { buttonVariants } from "@/modules/shared/ui/button";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadUserActionCenter } from "@/modules/shared/lib/action-center/repository";
import { loadMyPlatformAccess, hasPlatformRole } from "@/modules/shared/lib/account-security/platform-access";
import { PLATFORM_ADMIN_ROLES } from "@/modules/shared/lib/connected-space/workspace-landing";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import { cn } from "@/modules/shared/lib/utils";
import { ActionsPanel } from "./actions-panel";
import { getActionCenterMessages } from "./messages";

export default async function ActionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await loadMyPlatformAccess();
  if (access.status === "error" && access.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/actions` }));
  if (access.status === "error") return <WorkspaceFailure locale={locale} reason={access.reason} returnPath={`/${locale}/actions`} />;
  const includeAdmin = hasPlatformRole(access.roles, PLATFORM_ADMIN_ROLES);
  if (includeAdmin && !access.requirementSatisfied) return <WorkspaceFailure locale={locale} reason="MFA_REQUIRED" returnPath={`/${locale}/actions`} />;
  const result = await loadUserActionCenter(locale, new Date().toISOString(), undefined, { includeAdmin });
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/actions` }));
  const m = getActionCenterMessages(locale), alternate = locale === "fr" ? "ar" : "fr";
  return <main dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-dvh bg-muted/40 px-4 py-6 sm:px-6 sm:py-8"><div className="mx-auto max-w-6xl space-y-7"><nav aria-label={m.navigation} className="flex flex-wrap items-center justify-between gap-3"><Link href={`/${locale}/tableau-de-bord`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{m.back}</Link><Link href={`/${alternate}/actions`} hrefLang={alternate} className="min-h-11 rounded-md px-3 py-2 font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{m.language}</Link></nav><header><p className="text-xs font-semibold uppercase tracking-[.18em] text-primary">{m.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{m.title}</h1><p className="mt-3 max-w-3xl leading-7 text-muted-foreground">{m.description}</p></header>{result.status === "error" ? <Alert variant="destructive"><AlertTitle>{m.title}</AlertTitle><AlertDescription>{result.reason}</AlertDescription></Alert> : <ActionsPanel center={result.value} locale={locale} m={m} />}</div></main>;
}

