import Link from "next/link";
import {ProviderReadState}from"@/modules/provider/ui/provider-read-state";
import{providerContextReadState}from"@/modules/provider/data/spaces/organization-context";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { loadProviderDashboard } from "@/modules/provider/data/qualification/repository";
import { resolveProviderSpace } from "@/modules/provider/data/spaces/context";
import { getProviderStatusLabel } from "@/modules/provider/screens/qualification/messages";
import { ProviderAppShell } from "@/modules/provider/ui/provider-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import type { ProviderDocument } from "@/modules/provider/data/qualification/model";

const CERT_KINDS = new Set(["CERTIFICATION", "LICENSE", "ACCREDITATION"]);
const REF_KINDS = new Set(["REFERENCE", "PORTFOLIO"]);

function tone(status: string): "mint" | "peach" | "violet" {
  if (status === "VERIFIED" || status === "APPROVED" || status === "ACTIVE") return "mint";
  if (status === "EXPIRED" || status === "INVALID" || status === "REJECTED") return "peach";
  return "violet";
}

function Table({
  locale,
  title,
  empty,
  rows,
  query,
}: {
  locale: "fr" | "ar";
  title: string;
  empty: string;
  rows: ProviderDocument[];
  query: string;
}) {
  return (
    <article className="client-card">
      <header className="client-priority-head">
        <h2>{title}</h2>
        <Link href={`/${locale}/sous-traitant/qualification${query}#documents`} className="client-text-link">
          {locale === "ar" ? "إضافة إثبات" : "Ajouter une preuve"}
        </Link>
      </header>
      {rows.length === 0 ? (
        <p role="status">{empty}</p>
      ) : (
        <div className="client-table-wrap">
          <table className="client-space-table">
            <thead>
              <tr>
                <th>{locale === "ar" ? "المرجع" : "Référence"}</th>
                <th>{locale === "ar" ? "النوع" : "Type"}</th>
                <th>{locale === "ar" ? "الحالة" : "Statut"}</th>
                <th>{locale === "ar" ? "الانتهاء" : "Expiration"}</th>
                <th>{locale === "ar" ? "النسخة" : "Version"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((document) => (
                <tr key={document.id}>
                  <td>{document.code}</td>
                  <td>{getProviderStatusLabel(locale, document.kind)}</td>
                  <td><span className="client-status-chip" data-tone={tone(document.status)}>{getProviderStatusLabel(locale, document.status)}</span></td>
                  <td dir="ltr">{document.expiresOn ?? "—"}</td>
                  <td><span dir="ltr">{document.version}</span> · {document.scanStatus==="CLEAN"?<a className="client-text-link" href={`/api/provider/documents/${document.id}`}>{locale==="ar"?"تنزيل":"Télécharger"}</a>:<span>{document.scanStatus==="PENDING"?(locale==="ar"?"الفحص جارٍ":"Analyse en attente"):(locale==="ar"?"في الحجر":"En quarantaine")}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export default async function ProviderCertificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string;page?:string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveProviderSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/qualification/certifications` }));
  const contextState=providerContextReadState(space,query.organizationId);
  const result = contextState?{status:"error" as const,reason:"NO_PROVIDER_ORGANIZATION" as const}:await loadProviderDashboard(space.selectedOrganizationId??undefined,/^\d{1,6}$/.test(query.page??"")?Number(query.page):1,{kinds:[...CERT_KINDS,...REF_KINDS]});
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/sous-traitant/qualification/certifications` }));
  const documents = result.status === "success" ? result.dashboard.documents : [];
  const copy = locale === "ar"
    ? { title: "الشهادات والمراجع", lead: "الشهادات والرخص والمراجع المودعة في ملف التأهيل.", certs: "الشهادات والرخص", refs: "مراجع المشاريع", emptyCerts: "لا شهادة أو رخصة مسجّلة.", emptyRefs: "لا مرجع أو محفظة مسجّلة.", error: "تعذر تحميل الإثباتات." }
    : { title: "Certifications et références", lead: "Licences, assurances de compétence et références déjà versées au dossier de qualification.", certs: "Certifications et licences", refs: "Références de projets", emptyCerts: "Aucune certification ou licence enregistrée.", emptyRefs: "Aucune référence ou portfolio enregistré.", error: "Impossible de charger les preuves." };

  return (
    <ProviderAppShell
      locale={locale}
      organizations={space.organizations} selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="qualify"
      title={copy.title}
      lead={copy.lead}
      kicker={result.status === "error" ? copy.error : undefined}
    >
      <main className="client-page">{result.status==="error"?<ProviderReadState locale={locale}state={contextState??"unavailable"}retryHref={`/${locale}/sous-traitant/qualification/certifications${space.selectedQuery}`}/>:<><nav aria-label={locale==="ar"?"صفحات الشهادات":"Pages des certifications"}>{(result.dashboard.documentPage??1)>1?<Link className="client-ghost-link" href={`/${locale}/sous-traitant/qualification/certifications${space.selectedQuery}&page=${(result.dashboard.documentPage??1)-1}`}>{locale==="ar"?"السابق":"Précédente"}</Link>:null}<span>{result.dashboard.documentPage??1}</span>{result.dashboard.documentsHasMore?<Link className="client-ghost-link" href={`/${locale}/sous-traitant/qualification/certifications${space.selectedQuery}&page=${(result.dashboard.documentPage??1)+1}`}>{locale==="ar"?"التالي":"Suivante"}</Link>:null}</nav>
        <Table locale={locale} title={copy.certs} empty={copy.emptyCerts} rows={documents.filter((item) => CERT_KINDS.has(item.kind))} query={space.selectedQuery} />
        <Table locale={locale} title={copy.refs} empty={copy.emptyRefs} rows={documents.filter((item) => REF_KINDS.has(item.kind))} query={space.selectedQuery} />
      </>}</main>
    </ProviderAppShell>
  );
}
