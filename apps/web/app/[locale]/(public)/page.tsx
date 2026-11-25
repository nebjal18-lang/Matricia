import { notFound } from "next/navigation";
import { HomePremium } from "@/modules/public/ui/home-premium/HomePremium";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { DemoAccess } from "../connexion/demo-access";
import { isPublicDemoAccessEnabled } from "../connexion/demo-policy";

export const dynamic = "force-dynamic";

export default async function PublicHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const demoAccess = isPublicDemoAccessEnabled() ? (
    <div className="mx-auto my-4 w-full max-w-6xl px-4">
      <DemoAccess locale={locale} />
    </div>
  ) : undefined;
  return <HomePremium locale={locale} demoAccess={demoAccess} />;
}
