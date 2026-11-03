import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { directionFor, isLocale } from "@/modules/shared/lib/i18n/locale";
import { seoCopy } from "@/modules/shared/lib/seo/metadata";
import { DocumentLocaleSync } from "@/modules/shared/ui/document-locale-sync";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: { default: "Matricia", template: "%s | Matricia" }, description: seoCopy[locale].description, robots: { index: false, follow: false, noarchive: true } };
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <div dir={directionFor(locale)} className="min-h-dvh"><DocumentLocaleSync locale={locale} />{children}</div>;
}
