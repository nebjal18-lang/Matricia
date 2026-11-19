import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** Porte étape 5 — confirmation avant commerce. */
export function AdminStep5Gate({
  locale,
  query = "",
  current,
}: {
  locale: Locale;
  query?: string;
  current: "conformite" | "qualification" | "capacite" | "providers" | "clients" | "entreprises";
}) {
  const fr = locale === "fr";
  const q = query.startsWith("?") || query === "" ? query : `?${query}`;
  const steps = [
    { id: "conformite" as const, href: `/${locale}/administration/conformite-clients${q}`, label: fr ? "Conformité clients" : "امتثال العملاء" },
    { id: "providers" as const, href: `/${locale}/administration/providers${q}`, label: fr ? "Prestataires" : "مقدمو الخدمات" },
    { id: "qualification" as const, href: `/${locale}/administration/qualification${q}`, label: fr ? "Qualification" : "التأهيل" },
    { id: "capacite" as const, href: `/${locale}/administration/capacite${q}`, label: fr ? "Capacité" : "القدرة" },
  ];

  return (
    <section className="admin-panel mb-4 space-y-3" data-tone="mint" aria-label={fr ? "Étape 5 sur 11" : "الخطوة 5 من 11"}>
      <p className="text-sm font-semibold">{fr ? "Étape 5/11 — Confirmer les acteurs" : "الخطوة 5/11 — تأكيد الفاعلين"}</p>
      <p className="text-sm">
        {fr
          ? "Pourquoi : vérifier identité et preuves avant le commerce. Un client non confirmé (ou un prestataire non qualifié par service) ne doit pas ouvrir diagnostics / demandes."
          : "لماذا: التحقق من الهوية والأدلة قبل التجارة. عميل غير مؤكد (أو مزوّد غير مؤهل حسب الخدمة) لا يفتح التشخيصات / الطلبات."}
      </p>
      <nav className="client-tabs" aria-label={fr ? "Chaîne confirmation" : "سلسلة التأكيد"}>
        {steps.map((step) => (
          <Link key={step.id} href={step.href} aria-current={step.id === current ? "page" : undefined}>
            {step.label}
          </Link>
        ))}
      </nav>
      <p className="client-actions">
        <Link href={`/${locale}/administration/invitations-reseau${q}`} className="admin-soft-cta">
          {fr ? "Étape précédente : réseau / inscriptions" : "الخطوة السابقة: الشبكة / التسجيل"}
        </Link>
        <Link href={`/${locale}/administration/diagnostics${q}`} className="admin-soft-cta">
          {fr ? "Ensuite : diagnostics (si confirmé)" : "بعدها: التشخيصات (بعد التأكيد)"}
        </Link>
      </p>
    </section>
  );
}
