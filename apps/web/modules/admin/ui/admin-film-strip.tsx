import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { AdminProcessStrip } from "@/modules/shared/shell/admin-process-strip";
import type { AdminFilmContext } from "@/modules/admin/data/spaces/admin-film";

/** Bandeau film 1→11 dans le shell admin existant (sans AdminModuleChrome). */
export function AdminFilmStrip({
  locale,
  film,
  blocker,
  compact = false,
}: {
  locale: Locale;
  film: AdminFilmContext;
  blocker?: string | null;
  /** Sur une fiche, une seule ligne d’action — pas le film 11 étapes ni les pills précédent/suivant. */
  compact?: boolean;
}) {
  if (compact) {
    // Contexte film seulement — le CTA primaire vit dans le dossier (évite le double bouton).
    return (
      <section className="admin-film-compact mb-4" aria-label={film.title}>
        <div className="admin-film-compact__body">
          <p className="admin-film-compact__title">{film.title}</p>
          <p className="admin-film-compact__why">{film.why}</p>
          {film.nextAction ? (
            <p className="admin-film-compact__next">
              <span className="font-semibold">{locale === "ar" ? "الإجراء التالي" : "Prochaine action"}:</span> {film.nextAction}
            </p>
          ) : null}
        </div>
        {blocker ? <p className="admin-notice mt-2 w-full">{blocker}</p> : null}
      </section>
    );
  }

  return (
    <section className="mb-4 space-y-3" aria-label={film.title}>
      <AdminProcessStrip
        locale={locale}
        title={film.title}
        owner={film.owner}
        nextAction={film.nextAction}
        blocker={blocker}
        steps={film.steps}
      />
      <p className="text-sm text-[var(--ad-muted)]">{film.why}</p>
      <p className="client-actions">
        {film.prevHref ? (
          <Link href={film.prevHref} className="admin-soft-cta">
            {locale === "ar" ? "الخطوة السابقة" : "Étape précédente"}
          </Link>
        ) : null}
        {film.nextHref ? (
          <Link href={film.nextHref} className="admin-soft-cta">
            {locale === "ar" ? "الخطوة التالية" : "Étape suivante"}
          </Link>
        ) : null}
      </p>
    </section>
  );
}
