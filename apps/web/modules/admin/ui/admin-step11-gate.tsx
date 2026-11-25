import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** Porte étape 11 — argent & suivi. */
export function AdminStep11Gate({
  locale,
  query = "",
  current,
}: {
  locale: Locale;
  query?: string;
  current: "facturation" | "finance" | "prestataires" | "approbations" | "litiges";
}) {
  const fr = locale === "fr";
  const q = query.startsWith("?") || query === "" ? query : `?${query}`;
  const steps = [
    { id: "facturation" as const, href: `/${locale}/administration/facturation-clients${q}`, label: fr ? "Facturation clients" : "فوترة العملاء" },
    { id: "prestataires" as const, href: `/${locale}/administration/finance/prestataires${q}`, label: fr ? "Prestataires" : "مقدمو الخدمات" },
    { id: "finance" as const, href: `/${locale}/administration/finance${q}`, label: fr ? "Finance" : "المالية" },
    { id: "approbations" as const, href: `/${locale}/administration/approbations-finance${q}`, label: fr ? "Approbations" : "الموافقات" },
    { id: "litiges" as const, href: `/${locale}/administration/litiges${q}`, label: fr ? "Litiges" : "النزاعات" },
  ];

  return (
    <section className="admin-panel mb-4 space-y-3" data-tone="mint" aria-label={fr ? "Étape 11 sur 11" : "الخطوة 11 من 11"}>
      <p className="text-sm font-semibold">{fr ? "Étape 11/11 — Argent et suivi" : "الخطوة 11/11 — المال والمتابعة"}</p>
      <p className="text-sm">
        {fr
          ? "Pourquoi : facturer, payer, répartir — sans modifier un solde à la main. Les journaux sont immuables ; un litige ouvert peut bloquer la clôture."
          : "لماذا: الفوترة والدفع والتوزيع — دون تعديل رصيد يدوياً. الدفاتر غير قابلة للتعديل؛ نزاع مفتوح قد يوقف الإغلاق."}
      </p>
      <nav className="client-tabs" aria-label={fr ? "Chaîne argent" : "سلسلة المال"}>
        {steps.map((step) => (
          <Link key={step.id} href={step.href} aria-current={step.id === current ? "page" : undefined}>
            {step.label}
          </Link>
        ))}
      </nav>
      <p className="client-actions">
        <Link href={`/${locale}/administration/jalons${q}`} className="admin-soft-cta">
          {fr ? "Étape précédente : jalons" : "الخطوة السابقة: المعالم"}
        </Link>
        <Link href={`/${locale}/administration/parcours${q}`} className="admin-soft-cta">
          {fr ? "Retour au film 1→11" : "العودة إلى الفيلم 1→11"}
        </Link>
      </p>
    </section>
  );
}
