import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { buildHubMetrics } from "@/modules/admin/data/spaces/hub-metrics";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { AdminHubBoard } from "@/modules/admin/screens/spaces/boards";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminActorsHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/acteurs` }));
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const supervision = await loadAdminSupervisionDashboard(80);
  const metrics = buildHubMetrics("actors", supervision.status === "success" ? supervision.value : null, locale);

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      alternateHref={`/${alternate}/administration/acteurs${space.selectedQuery}`}
      crumb={
        <AdminCrumb
          locale={locale}
          query={space.selectedQuery}
          items={[
            { href: `/${locale}/administration/command-center${space.selectedQuery}`, label: c.crumbAdmin },
            { label: c.navActors },
          ]}
        />
      }
      title={c.actors}
      lead={
        locale === "fr"
          ? "Film acteurs : franchise (2) → invitations réseau (3–4) → confirmation clients/prestataires (5). Puis commerce via Parcours."
          : "فيلم الفاعلين: الامتياز (2) ← دعوات الشبكة (3–4) ← تأكيد العملاء/مقدمي الخدمات (5). ثم التجارة عبر المسار."
      }
      kicker={c.kicker}
    >
      <section className="admin-panel mb-4 space-y-3" data-tone="mint" aria-label={locale === "fr" ? "Ordre acteurs" : "ترتيب الفاعلين"}>
        <p className="text-sm">
          {locale === "fr"
            ? "Pourquoi ce hub : ouvrir les bonnes files dans l’ordre. Ne créez pas une franchise ACTIVE ici."
            : "لماذا هذا المركز: فتح الطوابير الصحيحة بالترتيب. لا تنشئوا امتيازاً نشطاً هنا."}
        </p>
        <p className="client-actions">
          <Link href={`/${locale}/administration/candidatures-franchise${space.selectedQuery}`} className="admin-soft-cta">
            {locale === "fr" ? "2. Candidatures franchise" : "2. ترشيحات الامتياز"}
          </Link>
          <Link href={`/${locale}/administration/invitations-reseau${space.selectedQuery}`} className="admin-soft-cta">
            {locale === "fr" ? "3–4. Invitations réseau" : "3–4. دعوات الشبكة"}
          </Link>
          <Link href={`/${locale}/administration/conformite-clients${space.selectedQuery}`} className="admin-soft-cta">
            {locale === "fr" ? "5. Conformité clients" : "5. امتثال العملاء"}
          </Link>
          <Link href={`/${locale}/administration/qualification${space.selectedQuery}`} className="admin-soft-cta">
            {locale === "fr" ? "5. Qualification" : "5. التأهيل"}
          </Link>
        </p>
      </section>
      <details className="client-card p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">{locale === "fr" ? "Répertoire acteurs" : "دليل الفاعلين"}</summary>
        <div className="mt-4">
          <AdminHubBoard locale={locale} query={space.selectedQuery} groupId="actors" metrics={metrics} title={c.actors} />
        </div>
      </details>
    </AdminAppShell>
  );
}
