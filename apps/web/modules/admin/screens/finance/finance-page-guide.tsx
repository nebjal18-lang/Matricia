import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { HashAwareLink } from "@/modules/shared/ui/hash-nav";

/** Guide du hub Finance du jour — offres et packs sont hors page. */
export function FinancePageGuide({
  locale,
  organizationQuery = "",
}: {
  locale: Locale;
  hasOrganization?: boolean;
  organizationQuery?: string;
}) {
  const ar = locale === "ar";
  const q = organizationQuery;

  return (
    <section className="admin-panel space-y-4" data-tone="violet" aria-labelledby="finance-guide-title">
      <div className="admin-section-head">
        <div>
          <h2 id="finance-guide-title">{ar ? "كيف تستعملون هذه الصفحة" : "Comment utiliser cette page"}</h2>
          <p>
            {ar
              ? "هذه الصفحة للمال الداخل والخارج اليوم فقط. إنشاء العرض وحزم الأرصدة في ورش منفصلة."
              : "Cette page sert uniquement à l’argent qui entre et sort aujourd’hui. Création d’offre et packs crédits sont dans des ateliers séparés."}
          </p>
        </div>
      </div>
      <ol className="admin-finance-map">
        <li>
          <Link href={`/${locale}/administration/finance/offres${q}`} className="admin-finance-map__link">
            <span className="admin-finance-map__index" aria-hidden>
              1
            </span>
            <span>
              <strong>{ar ? "إنشاء عرض Box" : "Créer une offre Box"}</strong>
              <span className="admin-finance-map__body">
                {ar ? "ورشة منفصلة — عدة خدمات في عرض واحد." : "Atelier séparé — plusieurs services dans une offre."}
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href={`/${locale}/administration/finance/credits${q}`} className="admin-finance-map__link">
            <span className="admin-finance-map__index" aria-hidden>
              2
            </span>
            <span>
              <strong>{ar ? "حزم ومنح أرصدة" : "Packs et attributions"}</strong>
              <span className="admin-finance-map__body">
                {ar ? "حزم، عروض، منح ودفتر." : "Packs, promotions, attributions et journal."}
              </span>
            </span>
          </Link>
        </li>
        <li>
          <HashAwareLink href="#finance-aujourdhui" className="admin-finance-map__link">
            <span className="admin-finance-map__index" aria-hidden>
              3
            </span>
            <span>
              <strong>{ar ? "ما يجب معالجته اليوم" : "Ce qu’il y a à traiter"}</strong>
              <span className="admin-finance-map__body">
                {ar ? "مدفوعات العملاء والاشتراكات." : "Paiements clients et abonnements."}
              </span>
            </span>
          </HashAwareLink>
        </li>
        <li>
          <HashAwareLink href="#sorties" className="admin-finance-map__link">
            <span className="admin-finance-map__index" aria-hidden>
              4
            </span>
            <span>
              <strong>{ar ? "الأموال الخارجة" : "Argent sortant"}</strong>
              <span className="admin-finance-map__body">
                {ar ? "فواتير مقدّمي الخدمات والمدفوعات المسجّلة." : "Factures prestataires et paiements enregistrés."}
              </span>
            </span>
          </HashAwareLink>
        </li>
      </ol>
    </section>
  );
}
