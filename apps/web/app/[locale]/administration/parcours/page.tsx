import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import { filmHubChain, parcoursDossierChain } from "@/modules/admin/data/spaces/admin-film";
import { buildHubMetrics } from "@/modules/admin/data/spaces/hub-metrics";
import { loadAdminSupervisionDashboard } from "@/modules/admin/data/supervision/repository";
import { AdminHubBoard } from "@/modules/admin/screens/spaces/boards";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function AdminParcoursHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/administration/parcours` }));
  const c = adminCopy(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const q = space.selectedQuery;
  const supervision = await loadAdminSupervisionDashboard(80);
  const metrics = buildHubMetrics("parcours", supervision.status === "success" ? supervision.value : null, locale);
  const chain = filmHubChain(locale);
  const dossierChain = parcoursDossierChain(locale);

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="parcours"
      alternateHref={`/${alternate}/administration/parcours${space.selectedQuery}`}
      crumb={
        <AdminCrumb
          locale={locale}
          query={space.selectedQuery}
          items={[
            { href: `/${locale}/administration/command-center${space.selectedQuery}`, label: c.crumbAdmin },
            { label: c.navParcours },
          ]}
        />
      }
    >
      <section className="admin-panel space-y-4" data-tone="mint" aria-labelledby="parcours-film-title">
        <div className="admin-section-head">
          <div>
            <h2 id="parcours-film-title">{locale === "ar" ? "فيلم العمل 1 إلى 11" : "Film métier 1 → 11"}</h2>
            <p>
              {locale === "ar"
                ? "اتبعوا الترتيب: تجهيز المنصة، اعتماد الامتياز، الشبكة والتسجيل، التأكيد، ثم التجارة حتى المال."
                : "Suivez l’ordre : préparer la plateforme, valider la franchise, réseau et inscriptions, confirmation, puis commerce jusqu’à l’argent."}
            </p>
          </div>
        </div>
        <nav className="client-tabs" aria-label={locale === "ar" ? "خطوات الفيلم" : "Étapes du film"}>
          {chain.map((step) => (
            <Link key={step.id} href={`/${locale}/administration/${step.hrefSuffix}${q}`}>
              {step.label}
            </Link>
          ))}
        </nav>
      </section>
      <details className="client-card p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">{locale === "ar" ? "سلاسل أخرى" : "Autres chaînes"}</summary>
        <div className="mt-4 space-y-4">
      <section className="admin-panel space-y-4" data-tone="peach" aria-labelledby="parcours-dossier-title">
        <div className="admin-section-head">
          <div>
            <h2 id="parcours-dossier-title">{c.hubParcoursChainTitle}</h2>
            <p>
              {locale === "ar"
                ? "سلسلة الملف التجاري: تشخيص ← طلب ← مطابقة ← عرض ← عقد / ملحق ← مهمة ← معالم ← وثائق / رسائل ← نزاع."
                : "Chaîne dossier commercial : diagnostic → demande → matching → devis → contrat / avenant → mission → jalons → docs / messages → litige."}
            </p>
          </div>
        </div>
        <nav className="client-tabs" aria-label={locale === "ar" ? "سلسلة الملف" : "Chaîne dossier"}>
          {dossierChain.map((step) => (
            <Link key={step.id} href={`/${locale}/administration/${step.hrefSuffix}${q}`}>
              {step.label}
            </Link>
          ))}
        </nav>
      </section>
      <section className="admin-panel space-y-4" data-tone="violet" aria-labelledby="parcours-prereq-title">
        <div className="admin-section-head">
          <div>
            <h2 id="parcours-prereq-title">{c.hubParcoursPrereqTitle}</h2>
            <p>{c.hubParcoursPrereqLead}</p>
          </div>
        </div>
        <p className="client-actions">
          <Link href={`/${locale}/administration/conformite-clients${q}`} className="admin-soft-cta">{c.hubParcoursCompliance}</Link>
          <Link href={`/${locale}/administration/qualification${q}`} className="admin-soft-cta">{c.hubParcoursQualification}</Link>
          <Link href={`/${locale}/administration/entreprises${q}`} className="admin-soft-cta">
            {locale === "ar" ? "متابعة التسجيلات" : "Suivre les inscriptions"}
          </Link>
        </p>
      </section>
      <AdminHubBoard locale={locale} query={space.selectedQuery} groupId="parcours" metrics={metrics} title={c.parcours} />
        </div>
      </details>
    </AdminAppShell>
  );
}
