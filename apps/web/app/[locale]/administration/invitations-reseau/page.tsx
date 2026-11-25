import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveAdminSpace } from "@/modules/admin/data/spaces/context";
import { loadAdminNetworkInvitationsSupervision } from "@/modules/admin/screens/network-invitations/load";
import { AdminAppShell, AdminCrumb } from "@/modules/admin/ui/admin-app-shell";
import { AdminReadError } from "@/modules/admin/ui/admin-read-error";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";

export default async function AdminNetworkInvitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveAdminSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") {
    redirect(connexionHref(locale, { next: `/${locale}/administration/invitations-reseau` }));
  }
  const fr = locale === "fr";
  const alternate = fr ? "ar" : "fr";
  const loaded = await loadAdminNetworkInvitationsSupervision(locale);
  const q = space.selectedQuery;

  return (
    <AdminAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="actors"
      actorCurrent="network-invitations"
      alternateHref={`/${alternate}/administration/invitations-reseau${q}`}
      crumb={
        <AdminCrumb
          locale={locale}
          query={q}
          items={[
            { href: `/${locale}/administration/acteurs${q}`, label: fr ? "Acteurs" : "الفاعلون" },
            { label: fr ? "Invitations réseau" : "دعوات الشبكة" },
          ]}
        />
      }
      title={fr ? "Supervision des invitations réseau" : "إشراف دعوات الشبكة"}
      lead={
        fr
          ? "Étapes 3–4 — lecture seule. Le franchisé invite ; l’admin surveille l’état puis confirme les dossiers à l’étape 5."
          : "الخطوتان 3–4 — قراءة فقط. يدعو صاحب الامتياز؛ وتشرف الإدارة ثم تؤكد الملفات في الخطوة 5."
      }
      kicker={fr ? "Pont réseau" : "جسر الشبكة"}
    >
      <section className="admin-panel mb-4 space-y-3" data-tone="mint">
        <p className="text-sm">
          {fr
            ? "Cette page ne remplace pas l’invitation franchise. Prochaine action : ouvrir conformité ou qualification quand un inscrit a déposé ses pièces."
            : "هذه الصفحة لا تحل محل دعوة الامتياز. الخطوة التالية: فتح الامتثال أو التأهيل عندما يودع المسجّل وثائقه."}
        </p>
        <p className="client-actions">
          <Link href={`/${locale}/administration/entreprises${q}`} className="admin-soft-cta">
            {fr ? "Organisations inscrites" : "المؤسسات المسجّلة"}
          </Link>
          <Link href={`/${locale}/administration/conformite-clients${q}`} className="admin-soft-cta">
            {fr ? "Étape 5 — conformité" : "الخطوة 5 — الامتثال"}
          </Link>
          <Link href={`/${locale}/administration/qualification${q}`} className="admin-soft-cta">
            {fr ? "Étape 5 — qualification" : "الخطوة 5 — التأهيل"}
          </Link>
        </p>
      </section>

      {loaded.status === "error" ? (
        loaded.reason === "MFA_REQUIRED" ? (
          <Alert variant="destructive">
            <AlertTitle>{mfaRequiredMessage(locale)}</AlertTitle>
            <AlertDescription>
              {fr ? "La supervision reste masquée jusqu’au second facteur." : "يظل الإشراف محجوباً حتى العامل الثاني."}
            </AlertDescription>
          </Alert>
        ) : (
          <AdminReadError locale={locale} reason={loaded.reason === "FORBIDDEN" ? "FORBIDDEN" : "UNAVAILABLE"} retryHref={`/${locale}/administration/invitations-reseau${q}`} />
        )
      ) : loaded.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {fr
            ? "Aucune invitation réseau visible pour le moment. Le franchisé crée les invitations depuis son espace."
            : "لا دعوات شبكة ظاهرة حالياً. ينشئها صاحب الامتياز من مساحته."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table w-full text-sm">
            <thead>
              <tr>
                <th>{fr ? "Franchise" : "الامتياز"}</th>
                <th>{fr ? "Type" : "النوع"}</th>
                <th>{fr ? "Contact" : "جهة الاتصال"}</th>
                <th>{fr ? "État" : "الحالة"}</th>
                <th>{fr ? "Org liée" : "المؤسسة المرتبطة"}</th>
              </tr>
            </thead>
            <tbody>
              {loaded.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.operatorLabel}</td>
                  <td>{row.prospectType === "CLIENT" ? (fr ? "Client" : "عميل") : fr ? "Prestataire" : "مقدّم خدمة"}</td>
                  <td dir="ltr">{row.contactEmailMasked}</td>
                  <td>{row.statusLabel}</td>
                  <td>
                    {row.referralOrganizationId ? (
                      <Link href={`/${locale}/administration/entreprises/${row.referralOrganizationId}${q}`}>
                        {fr ? "Voir l’organisation" : "عرض المؤسسة"}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminAppShell>
  );
}
