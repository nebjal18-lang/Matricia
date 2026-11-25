import { notFound } from "next/navigation";
import { HomePremium } from "@/modules/public/ui/home-premium/HomePremium";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function PublicHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HomePremium locale={locale} />;
}
