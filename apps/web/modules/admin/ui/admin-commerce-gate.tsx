import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** Rappel étape 6+ : commerce après confirmation. */
export function AdminCommerceGate({
  locale,
  query = "",
  current,
}: {
  locale: Locale;
  query?: string;
  current: "diagnostics" | "demandes" | "matching" | "devis" | "contrats" | "missions";
}) {
  const fr = locale === "fr";
  const q = query.startsWith("?") || query === "" ? query : `?${query}`;

  return (
    <section className="admin-panel mb-4 space-y-2" data-tone="violet" aria-label={fr ? "Porte commerce" : "بوابة التجارة"}>
      <p className="text-sm font-semibold">
        {fr ? `Étape ${current === "diagnostics" || current === "demandes" ? "6" : current === "matching" ? "7" : current === "devis" ? "8" : current === "contrats" ? "9" : "10"}/11 — Commerce` : "التجارة"}
      </p>
      <p className="text-sm">
        {fr
          ? "Supervision seulement : le client dépose le besoin, le prestataire répond. Si un dossier n’est pas confirmé (étape 5), renvoyez vers conformité ou qualification."
          : "إشراف فقط: العميل يودع الحاجة والمزوّد يرد. إن لم يُؤكَّد الملف (الخطوة 5) أعيدوا إلى الامتثال أو التأهيل."}
      </p>
      <p className="client-actions">
        <Link href={`/${locale}/administration/conformite-clients${q}`} className="admin-soft-cta">
          {fr ? "Vérifier conformité client" : "تحقق من امتثال العميل"}
        </Link>
        <Link href={`/${locale}/administration/qualification${q}`} className="admin-soft-cta">
          {fr ? "Vérifier qualification" : "تحقق من التأهيل"}
        </Link>
      </p>
    </section>
  );
}
