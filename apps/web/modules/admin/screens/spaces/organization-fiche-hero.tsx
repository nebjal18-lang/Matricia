import Link from "next/link";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { inferOrgType } from "@/modules/admin/data/spaces/directory";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
import type { AdminOrganizationFiche } from "@/modules/admin/data/supervision/types";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { SpaceSceneHero } from "@/modules/shared/ui/space-scene-hero";

export function OrganizationFicheHero({
  locale,
  query,
  fiche,
}: {
  locale: Locale;
  query: string;
  fiche: AdminOrganizationFiche;
}) {
  const c = adminCopy(locale);
  const org = fiche.organization;
  const name = org.display_name || org.legal_name;
  const city = org.client_legal_profile?.registered_city;
  const type = inferOrgType(`${org.display_name} ${org.legal_name}`, locale, org.role_codes);
  const country = locale === "ar" ? "المغرب" : "Maroc";
  const meta = [type, city ? `${city}, ${country}` : country].filter(Boolean).join(" · ");
  const statusTone = org.status.toUpperCase() === "ACTIVE" ? "ok" : "neutral";

  return (
    <SpaceSceneHero
      className="admin-org-hero"
      sceneSrc="/scenes/arch-city.png"
      motifTlSrc="/admin/scene/pattern-tl.png"
      motifBrSrc="/admin/scene/pattern-br.png"
      title={name}
      meta={meta}
      badge={
        <span className="admin-status" data-tone={statusTone}>
          {localizeStatus(org.status, locale)}
        </span>
      }
      actions={
        <>
          <Link
            href={`/${locale}/administration/entreprises/${org.id}/modifier${query}`}
            className="admin-primary-cta"
          >
            {c.edit}
          </Link>
          <Link
            href={`/${locale}/administration/entreprises/${org.id}/archiver${query ? `${query}&mode=disable` : "?mode=disable"}`}
            className="admin-danger-cta"
          >
            {c.disable}
          </Link>
        </>
      }
      priority
    />
  );
}
