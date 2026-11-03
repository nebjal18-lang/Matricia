import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadProviderDashboard } from "@/modules/provider/data/qualification/repository";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { getProviderStatusLabel } from "@/modules/provider/screens/qualification/messages";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function ProviderPartnerContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/entreprise/contrat` }));
  const result = await loadProviderDashboard(query.organizationId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/entreprise/contrat` }));
  const profile = result.status === "success" ? result.dashboard.profile : null;
  const proofs = result.status === "success" ? result.dashboard.documents.filter((item) => item.kind === "PARTNER_CONTRACT") : [];
  const status = profile?.partnerContractStatus ?? "NOT_SIGNED";
  const ar = locale === "ar";
  const copy = ar
    ? { title: "عقد الشراكة Matricia", lead: "يجب أن يكون العقد سارياً قبل استلام استشارات جديدة.", status: "حالة العقد", proofs: "نسخ مودعة", empty: "لا نسخة عقد مودعة في الملف.", add: "إيداع إثبات", note: "التوقيع يُسجَّل بقرار إداري. لا تُختلق وثيقة هنا.", error: "تعذر تحميل العقد." }
    : { title: "Contrat partenaire Matricia", lead: "Le contrat doit être valide avant de recevoir de nouvelles consultations.", status: "Statut du contrat", proofs: "Versions déposées", empty: "Aucune version de contrat n’est déposée dans le dossier.", add: "Déposer une preuve", note: "La signature est enregistrée par une décision administrative. Aucun document n’est inventé ici.", error: "Impossible de charger le contrat." };

  return (
    <ProviderAppShell
      locale={locale}
      organizations={space.organizations} selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="company"
      title={copy.title}
      lead={copy.lead}
      kicker={result.status === "error" ? copy.error : getProviderStatusLabel(locale, status)}
    >
      <main className="client-page provider-partner-contract">
        <section className="client-board client-board-compare">
          <article className="client-card">
            <header><h2>{copy.status}</h2></header>
            <p className="client-status-chip" data-tone={status === "SIGNED" || status === "ACTIVE" ? "mint" : "peach"}>{getProviderStatusLabel(locale, status)}</p>
            <p>{result.status === "success" ? result.dashboard.organizationName : space.organizationName}</p>
            <p className="client-access-note">{copy.note}</p>
          </article>
          <article className="client-card">
            <header className="client-priority-head">
              <h2>{copy.proofs}</h2>
              <Link href={`/${locale}/sous-traitant/qualification${space.selectedQuery}#documents`} className="client-text-link">{copy.add}</Link>
            </header>
            {proofs.length === 0 ? <p role="status">{copy.empty}</p> : (
              <ul className="client-feed">
                {proofs.map((document) => (
                  <li key={document.id}>
                    <span>
                      <strong>{document.code}</strong>
                      <small>{getProviderStatusLabel(locale, document.status)}{document.expiresOn ? ` · ${document.expiresOn}` : ""}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </main>
    </ProviderAppShell>
  );
}
