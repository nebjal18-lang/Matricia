import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { listOrganizationRoles } from "@/app/[locale]/organisation/roles/actions";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { ActivateClientRoleForm } from "@/modules/provider/screens/mode-client/activate-form";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

const CLIENT_ROLES = new Set(["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_ACCOUNTING", "CLIENT_MEMBER", "CLIENT_VIEWER"]);

export default async function ProviderModeClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/mode-client` }));
  const roles = await listOrganizationRoles();
  if (roles.status === "error" && roles.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/mode-client` }));
  const organizationId = space.selectedOrganizationId ?? (roles.status === "success" ? roles.organizations[0]?.id : null);
  const current = roles.status === "success" ? roles.organizations.find((item) => item.id === organizationId) ?? roles.organizations[0] : null;
  const hasClient = current?.currentRoles.some((role) => CLIENT_ROLES.has(role)) ?? false;
  const pending = roles.status === "success"
    ? roles.requests.find((item) => item.isOwn && item.status === "PENDING" && item.requestedRole.startsWith("CLIENT_"))
    : null;
  const ar = locale === "ar";
  const copy = ar
    ? { title: "وضع العميل", lead: "سياقان، منصة واحدة — دون إنشاء مؤسسة ثانية.", current: "السياق المهني الحالي", switch: "متابعة كعميل", request: "تفعيل دور العميل", pending: "طلب دور العميل معلّق.", isolated: "الاستشارات والعروض المهنية تبقى في فضاء المقدّم." }
    : { title: "Mode Client", lead: "Deux contextes, une seule plateforme — sans recréer l’organisation.", current: "Contexte professionnel actuel", switch: "Continuer en Mode Client", request: "Activer le rôle Client", pending: "Une demande de rôle Client est en attente.", isolated: "Vos consultations et devis professionnels restent dans l’espace prestataire." };

  return (
    <ProviderAppShell locale={locale} organizations={space.organizations} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="modeClient" title={copy.title} lead={copy.lead}>
      <main className="client-page provider-mode-client">
        <section className="client-board client-board-compare">
          <article className="client-card">
            <header><h2>{copy.current}</h2></header>
            <p><strong>{current?.displayName ?? space.organizationName ?? "—"}</strong></p>
            <p>{current?.currentRoles.join(" · ") || (ar ? "دور مهني" : "Rôle professionnel")}</p>
            <Link href={`/${locale}/tableau-de-bord${space.selectedQuery}`} className="client-ghost-link">{ar ? "البقاء كمقدّم خدمة" : "Rester en mode professionnel"}</Link>
          </article>
          <article className="client-card">
            <header><h2>{copy.request}</h2></header>
            {hasClient ? (
              <Link href={`/${locale}/tableau-de-bord${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ""}`} className="client-cta">{copy.switch}</Link>
            ) : pending ? (
              <p role="status">{copy.pending}</p>
            ) : organizationId ? (
              <ActivateClientRoleForm locale={locale} organizationId={organizationId} idempotencyKey={randomUUID()} />
            ) : (
              <p role="status">{ar ? "لا مؤسسة نشطة لطلب الدور." : "Aucune organisation active pour demander le rôle."}</p>
            )}
            <p className="client-access-note">{copy.isolated}</p>
          </article>
        </section>
      </main>
    </ProviderAppShell>
  );
}
