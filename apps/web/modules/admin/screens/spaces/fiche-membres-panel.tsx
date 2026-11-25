import Link from "next/link";
import {
  Check,
  Crown,
  Mail,
  MoreHorizontal,
  Plus,
  UserRoundX,
  Users,
} from "lucide-react";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { inferOrgType } from "@/modules/admin/data/spaces/directory";
import { organizationJourney } from "@/modules/admin/data/spaces/view-model";
import type { AdminOrganizationFiche } from "@/modules/admin/data/supervision/types";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

function membershipStatusTone(status: string): "ok" | "warn" | "danger" | "neutral" {
  const value = status.toUpperCase();
  if (value === "ACTIVE") return "ok";
  if (value === "INVITED") return "warn";
  if (value === "SUSPENDED" || value === "REVOKED") return "danger";
  return "neutral";
}

function membershipLabel(item: AdminOrganizationFiche["memberships"][number], locale: Locale) {
  const name = item.display_name?.trim();
  if (name) return name;
  const email = item.email?.trim();
  if (email) return email.split("@")[0] || email;
  return locale === "ar" ? "عضو" : "Membre";
}

function membershipInitials(label: string) {
  const parts = label.split(/\s+/u).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  return label.slice(0, 2).toUpperCase() || "M";
}

function membershipPersonStatus(status: string, locale: Locale) {
  const key = status.toUpperCase();
  if (key === "ACTIVE") return locale === "ar" ? "نشط" : "Actif";
  if (key === "INVITED") return locale === "ar" ? "مدعوّة" : "Invitée";
  if (key === "SUSPENDED") return locale === "ar" ? "موقوف" : "Suspendu";
  if (key === "REVOKED") return locale === "ar" ? "ملغى" : "Révoqué";
  return status;
}

function membershipRoleLabel(role: string, locale: Locale) {
  const key = role.toUpperCase();
  const ar = locale === "ar";
  if (key.includes("ADMIN") || key.includes("OWNER") || key.includes("OPERATOR")) {
    return ar ? "مسؤول" : "Administrateur";
  }
  if (key.includes("BUYER")) return ar ? "مشتري" : "Acheteur";
  if (key.includes("ACCOUNTING")) return ar ? "محاسبة" : "Comptabilité";
  if (key.includes("TECHNICIAN")) return ar ? "تقني" : "Technicien";
  return role;
}

export function FicheMembresPanel({
  locale,
  query,
  fiche,
  base,
  membersHref,
  inviteHref,
}: {
  locale: Locale;
  query: string;
  fiche: AdminOrganizationFiche;
  base: string;
  membersHref: string;
  inviteHref: string;
}) {
  const c = adminCopy(locale);
  const org = fiche.organization;
  const unknown = locale === "ar" ? "— للتعبئة" : "— à compléter";
  const journey = organizationJourney(fiche, locale);
  const activeMembers = fiche.memberships.filter((item) => item.status === "ACTIVE").length;
  const invitedMembers = fiche.memberships.filter((item) => item.status === "INVITED").length;
  const withoutRole = fiche.memberships.filter((item) => item.roles.length === 0).length;
  const rolesHref = (userId: string) =>
    `/${locale}/administration/utilisateurs/${userId}/roles?organizationId=${encodeURIComponent(org.id)}`;
  const profileHref = (userId: string) =>
    `/${locale}/administration/utilisateurs/${userId}?organizationId=${encodeURIComponent(org.id)}`;

  return (
    <section className="admin-fiche-membres" id="membres" tabIndex={-1}>
      <article className="client-card admin-fiche-membres-card">
        <header className="admin-fiche-membres-head">
          <div className="admin-fiche-membres-title">
            <h2>{c.members}</h2>
            <p className="admin-fiche-membres-lead">{c.membersLead}</p>
          </div>
          <div className="admin-fiche-membres-actions">
            <Link href={inviteHref} className="admin-primary-cta">
              <Plus className="size-4" aria-hidden />
              {c.inviteMember}
            </Link>
          </div>
        </header>

        <ul className="admin-fiche-membres-kpis" aria-label={c.members}>
          <li data-tone="sky">
            <Users className="admin-fiche-kpi-icon" aria-hidden />
            <small dir="ltr">{fiche.memberships.length}</small>
            <strong>{c.membersCount}</strong>
          </li>
          <li data-tone="mint">
            <Check className="admin-fiche-kpi-icon" aria-hidden />
            <small dir="ltr">{activeMembers}</small>
            <strong>{c.accessActive}</strong>
          </li>
          <li data-tone="peach">
            <Mail className="admin-fiche-kpi-icon" aria-hidden />
            <small dir="ltr">{invitedMembers}</small>
            <strong>{c.invitePending}</strong>
          </li>
          <li data-tone="violet">
            <UserRoundX className="admin-fiche-kpi-icon" aria-hidden />
            <small dir="ltr">{withoutRole}</small>
            <strong>{c.membersWithoutRole}</strong>
          </li>
        </ul>

        {fiche.memberships.length === 0 ? (
          <div className="admin-fiche-membres-empty" role="status">
            <Users className="size-5" aria-hidden />
            <p>{c.membersEmpty}</p>
            <Link href={inviteHref} className="admin-soft-cta">{c.inviteMember}</Link>
          </div>
        ) : (
          <div className="admin-fiche-member-table-wrap">
            <table className="admin-fiche-member-table">
              <thead>
                <tr>
                  <th scope="col">{c.colMember}</th>
                  <th scope="col">{c.roles}</th>
                  <th scope="col">{c.colStatus}</th>
                  <th scope="col">
                    <span className="sr-only">{c.memberActions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {fiche.memberships.map((member) => {
                  const label = membershipLabel(member, locale);
                  const primaryRole = member.roles[0];
                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="admin-fiche-member-main">
                          <span className="admin-fiche-member-avatar" aria-hidden>
                            {membershipInitials(label)}
                          </span>
                          <div className="admin-fiche-member-meta">
                            <strong>{label}</strong>
                            <small dir="ltr">{member.email?.trim() || "—"}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        {primaryRole ? (
                          <span className="admin-fiche-role-chip" data-role="admin">
                            <Crown className="size-3.5" aria-hidden />
                            {membershipRoleLabel(primaryRole, locale)}
                          </span>
                        ) : (
                          <span className="admin-fiche-role-chip" data-empty="true">{c.membersWithoutRole}</span>
                        )}
                      </td>
                      <td>
                        <span className="admin-status" data-tone={membershipStatusTone(member.status)}>
                          {membershipPersonStatus(member.status, locale)}
                        </span>
                      </td>
                      <td className="admin-fiche-member-actions-cell">
                        <details className="admin-fiche-member-menu">
                          <summary aria-label={`${c.memberActions} — ${label}`}>
                            <MoreHorizontal className="size-4" aria-hidden />
                          </summary>
                          <div className="admin-fiche-member-menu-panel" role="menu">
                            <Link href={profileHref(member.user_id)} role="menuitem">{c.openMember}</Link>
                            <Link href={rolesHref(member.user_id)} role="menuitem">{c.manageMembers}</Link>
                            <Link href={membersHref} role="menuitem">{c.seeAll}</Link>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <section className="admin-fiche-membres-context">
        <article className="client-card">
          <header><h2>{c.info}</h2></header>
          <dl className="admin-dl admin-dl-dense">
            <div><dt>{c.legal}</dt><dd>{org.legal_name}</dd></div>
            <div><dt>{locale === "ar" ? "الاسم التجاري" : "Nom commercial"}</dt><dd>{org.display_name || unknown}</dd></div>
            <div><dt>{c.type}</dt><dd>{inferOrgType(`${org.display_name} ${org.legal_name}`, locale, org.role_codes)}</dd></div>
            <div><dt>{locale === "ar" ? "الشكل القانوني" : "Forme juridique"}</dt><dd>{org.client_legal_profile?.legal_form ?? unknown}</dd></div>
            <div><dt>{locale === "ar" ? "تاريخ التأسيس" : "Date de création"}</dt><dd>{org.client_legal_profile?.incorporation_date ?? unknown}</dd></div>
            <div><dt>{c.activity}</dt><dd>{org.client_legal_profile?.activity ?? unknown}</dd></div>
            <div><dt>{locale === "ar" ? "القطاع" : "Secteur"}</dt><dd>{org.client_legal_profile?.sector ?? unknown}</dd></div>
            <div><dt>{locale === "ar" ? "مدينة السجل" : "Ville du RC"}</dt><dd>{org.client_legal_profile?.registered_city ?? unknown}</dd></div>
            <div><dt>{locale === "ar" ? "البلد" : "Pays"}</dt><dd dir="ltr">{org.country_code}</dd></div>
            <div><dt>{locale === "ar" ? "المعرّف الضريبي (IF)" : "Identifiant fiscal (IF)"}</dt><dd dir="ltr">{org.client_legal_profile?.if_number ?? unknown}</dd></div>
            <div><dt>{locale === "ar" ? "السجل التجاري (RC)" : "Registre de commerce (RC)"}</dt><dd dir="ltr">{org.client_legal_profile?.rc_number ?? unknown}</dd></div>
            <div><dt>{locale === "ar" ? "الممثل" : "Représentant"}</dt><dd>{org.client_legal_profile?.representative_name ?? unknown}</dd></div>
          </dl>
        </article>
        <article className="client-card" data-tone="sky">
          <header><h2>{c.journey}</h2></header>
          <ol className="admin-journey admin-journey-badges">
            {journey.map((step) => (
              <li key={step.id} data-state={step.state}>
                <i aria-hidden>{step.state === "done" ? <Check className="size-3" /> : null}</i>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
                {step.state === "done" ? (
                  <em className="admin-journey-done">{c.journeyDone}</em>
                ) : null}
              </li>
            ))}
          </ol>
          <Link href={base + query} className="admin-soft-cta">{c.overview}</Link>
        </article>
      </section>
    </section>
  );
}
