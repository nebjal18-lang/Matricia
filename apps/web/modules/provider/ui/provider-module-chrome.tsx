import type { ReactNode } from "react";
import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { AdminProcessStrip, type ProcessStep } from "@/modules/shared/shell/admin-process-strip";

export function ProviderModuleChrome({
  locale,
  title,
  eyebrow,
  lead,
  organizationName,
  backHref,
  backLabel,
  languageHref,
  languageLabel,
  owner,
  nextAction,
  blocker,
  steps,
  children,
}: {
  locale: Locale;
  title: string;
  eyebrow: string;
  lead: string;
  organizationName?: string | null;
  backHref: string;
  backLabel: string;
  languageHref: string;
  languageLabel: string;
  owner: string;
  nextAction: string;
  blocker?: string | null;
  steps: readonly ProcessStep[];
  children: ReactNode;
}) {
  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"} className="provider-shell admin-shell min-h-dvh px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <nav className="flex flex-wrap justify-between gap-3">
          <Link href={backHref} className="admin-btn-outline">{backLabel}</Link>
          <Link href={languageHref} hrefLang={locale === "fr" ? "ar" : "fr"} className="admin-btn-outline">{languageLabel}</Link>
        </nav>
        <header className="admin-hero">
          <div className="admin-hero-inner !grid-cols-1">
            <div>
              <p className="admin-eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              <p className="admin-hero-lead">{lead}</p>
              {organizationName ? <p className="mt-3 text-sm font-semibold text-[var(--ad-gold)]">{organizationName}</p> : null}
            </div>
          </div>
        </header>
        <AdminProcessStrip locale={locale} title={eyebrow} owner={owner} nextAction={nextAction} {...(blocker === undefined ? {} : {blocker})} steps={steps} />
        {children}
      </div>
    </main>
  );
}
