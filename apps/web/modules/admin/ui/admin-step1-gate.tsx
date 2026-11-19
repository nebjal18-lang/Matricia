import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** Porte étape 1 — plateforme prête avant candidatures franchise. */
export function AdminStep1Gate({
  locale,
  query = "",
  current,
}: {
  locale: Locale;
  query?: string;
  current: "preparation" | "configuration" | "catalogue" | "publications" | "revues" | "validation" | "calendrier" | "territoires" | "fiscalite" | "clonage";
}) {
  const fr = locale === "fr";
  const q = query.startsWith("?") || query === "" ? query : `?${query}`;
  const steps = [
    { id: "preparation" as const, href: `/${locale}/administration/preparation`, label: fr ? "Préparation" : "التحضير" },
    { id: "configuration" as const, href: `/${locale}/administration/configuration`, label: fr ? "Configuration" : "التكوين" },
    { id: "catalogue" as const, href: `/${locale}/administration/catalogue${q}`, label: fr ? "Catalogue" : "الدليل" },
    { id: "publications" as const, href: `/${locale}/administration/catalogue/publications${q}`, label: fr ? "Publications" : "المنشورات" },
    { id: "territoires" as const, href: `/${locale}/administration/territoires${q}`, label: fr ? "Territoires" : "الأقاليم" },
  ];

  return (
    <section className="admin-panel mb-4 space-y-3" data-tone="mint" aria-label={fr ? "Étape 1 sur 11" : "الخطوة 1 من 11"}>
      <p className="text-sm font-semibold">{fr ? "Étape 1/11 — Préparer la plateforme" : "الخطوة 1/11 — تجهيز المنصة"}</p>
      <p className="text-sm">
        {fr
          ? "Pourquoi : publier catalogue, règles et mandats avant d’ouvrir une candidature franchise. Tant que le catalogue n’est pas publié, le commerce reste bloqué."
          : "لماذا: نشر الدليل والقواعد والتفويضات قبل فتح ترشيح امتياز. ما دام الدليل غير منشور تبقى التجارة موقوفة."}
      </p>
      <nav className="client-tabs" aria-label={fr ? "Chaîne préparation" : "سلسلة التجهيز"}>
        {steps.map((step) => (
          <Link key={step.id} href={step.href} aria-current={step.id === current ? "page" : undefined}>
            {step.label}
          </Link>
        ))}
      </nav>
      <p className="client-actions">
        <Link href={`/${locale}/administration/candidatures-franchise${q}`} className="admin-soft-cta">
          {fr ? "Ensuite : candidatures franchise (étape 2)" : "بعدها: ترشيحات الامتياز (الخطوة 2)"}
        </Link>
        <Link href={`/${locale}/administration/parcours${q}`} className="admin-soft-cta">
          {fr ? "Voir le film 1→11" : "عرض الفيلم 1→11"}
        </Link>
      </p>
    </section>
  );
}
