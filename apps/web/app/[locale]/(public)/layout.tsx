import type { Metadata } from "next";
import "./experience.css";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/modules/public/ui/site/public-footer";
import { PublicNavigationServer } from "@/modules/public/ui/site/public-navigation-server";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { localizedRouteMetadata } from "@/modules/shared/lib/seo/metadata";
import { getPublicMessages } from "./messages";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getPublicMessages(locale).home;
  return localizedRouteMetadata(locale, "", copy.title, copy.description);
}

export default async function PublicLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <div dir={locale === "ar" ? "rtl" : "ltr"} className="public-root flex min-h-dvh flex-col text-[var(--mat-navy)]">
    <a href="#contenu-principal" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 z-50 bg-white text-slate-950 p-3">{getPublicMessages(locale).common.skipToContent}</a>
    <PublicNavigationServer locale={locale}/>
    <div className="flex-1">{children}</div>
    <PublicFooter locale={locale}/>
  </div>;
}
