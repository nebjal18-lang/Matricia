import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

/** Bandeau V4 — pages hors film 1→11, avec retour explicite vers le parcours. */
export function AdminOffFilmGate({
  locale,
  query = "",
  role,
}: {
  locale: Locale;
  query?: string;
  role: string;
}) {
  const fr = locale === "fr";
  return (
    <aside className="admin-panel mb-4 space-y-2" data-tone="sky" aria-label={fr ? "Page hors film métier" : "صفحة خارج فيلم العمل"}>
      <p className="text-sm text-[var(--ad-muted)]">
        <span className="font-semibold text-[var(--ad-ink)]">{fr ? "Hors film 1→11" : "خارج الفيلم 1←11"}.</span>{" "}
        {fr
          ? `Rôle de cette page : ${role}. Elle ne remplace aucune étape du parcours commercial.`
          : `دور هذه الصفحة: ${role}. لا تحل محل أي خطوة من المسار التجاري.`}
      </p>
      <p>
        <Link href={`/${locale}/administration/parcours${query}`} className="admin-soft-cta">
          {fr ? "Retour au film métier" : "العودة إلى فيلم العمل"}
        </Link>
      </p>
    </aside>
  );
}
