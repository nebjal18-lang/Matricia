import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** Porte étape 2 — valider franchise (jamais ACTIVE en 1 clic). */
export function AdminStep2Gate({
  locale,
  query = "",
  current,
}: {
  locale: Locale;
  query?: string;
  current: "candidatures" | "gouvernance" | "franchises" | "territoires" | "relances";
}) {
  const fr = locale === "fr";
  const q = query.startsWith("?") || query === "" ? query : `?${query}`;
  const steps = [
    { id: "relances" as const, href: `/${locale}/administration/relances-franchise`, label: fr ? "Règles de relance" : "قواعد المتابعة" },
    { id: "candidatures" as const, href: `/${locale}/administration/candidatures-franchise${q}`, label: fr ? "Candidatures" : "الترشيحات" },
    { id: "gouvernance" as const, href: `/${locale}/administration/gouvernance${q}`, label: fr ? "Gouvernance" : "الحوكمة" },
    { id: "franchises" as const, href: `/${locale}/administration/franchises${q}`, label: fr ? "Annuaire actifs" : "دليل النشطين" },
  ];

  return (
    <section className="admin-panel mb-4 space-y-3" data-tone="mint" aria-label={fr ? "Étape 2 sur 11" : "الخطوة 2 من 11"}>
      <p className="text-sm font-semibold">{fr ? "Étape 2/11 — Valider le franchisé" : "الخطوة 2/11 — اعتماد صاحب الامتياز"}</p>
      <p className="text-sm">
        {fr
          ? "Pourquoi : ouvrir et instruire un dossier, valider le mandat (quatre yeux si exigé). L’activation ACTIVE est faite par le candidat — pas un bouton admin « créer franchisé »."
          : "لماذا: فتح الملف ودراسته واعتماد التفويض (أربعة أعين عند اللزوم). التفعيل النشط يتم من المترشح — وليس بزر إداري «إنشاء امتياز»."}
      </p>
      <nav className="client-tabs" aria-label={fr ? "Chaîne franchise" : "سلسلة الامتياز"}>
        {steps.map((step) => (
          <Link key={step.id} href={step.href} aria-current={step.id === current ? "page" : undefined}>
            {step.label}
          </Link>
        ))}
      </nav>
      <p className="client-actions">
        <Link href={`/${locale}/administration/preparation${q}`} className="admin-soft-cta">
          {fr ? "Étape précédente : préparation" : "الخطوة السابقة: التجهيز"}
        </Link>
        <Link href={`/${locale}/administration/invitations-reseau${q}`} className="admin-soft-cta">
          {fr ? "Ensuite : invitations réseau (3–4)" : "بعدها: دعوات الشبكة (3–4)"}
        </Link>
      </p>
    </section>
  );
}
