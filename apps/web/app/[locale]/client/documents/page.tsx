import Link from "next/link";
import { z } from "zod";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { AdminReusePanel } from "@/modules/client/screens/documents/admin-reuse-panel";
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { resolveClientOrganizationContext } from "@/modules/shared/client-organization-context";
import { isDocumentExpired } from "@/modules/client/data/documents/expiry";
import { loadClientDocumentVault } from "@/modules/client/data/documents/server-repository";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { DocumentVaultPanel } from "@/modules/client/screens/documents/document-vault-panel";
import { DocumentsBoard, SpaceActions } from "@/modules/client/screens/spaces/boards";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";

export default async function Page({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; page?:string; q?:string }> }) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") redirect(connexionHref(locale, { next: `/${locale}/client/documents` }));
  const page=Math.max(1,Number.parseInt(query.page??"1",10)||1);
  const result = await loadClientDocumentVault(space.selectedOrganizationId,page,{query:query.q,includePending:true});
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/client/documents` }));
  const reuseResult = await (await getSupabaseServerClient()).rpc("list_my_admin_document_reuse_requests_v1", { p_organization_id: space.selectedOrganizationId });
  const reuse = z.object({ requests: z.array(z.object({ id: z.string().uuid(), document_id: z.string().uuid(), target_type: z.string(), target_id: z.string().uuid(), purpose: z.string(), status: z.string(), created_at: z.string() }).passthrough()) }).passthrough().safeParse(reuseResult.data);
  const pendingReuse = reuse.success ? reuse.data.requests.filter(request => request.status === "AWAITING_OWNER_CONSENT") : [];
  const c = spaceCopy(locale);
  const context = result.status === "success" ? resolveClientOrganizationContext(result.value.organizations.map((organization) => ({ organization_id: organization.id })), space.selectedOrganizationId) : null;
  const selectedId = context?.status === "success" ? context.membership.organization_id : null;
  const value = result.status === "success" && selectedId ? {
    organizations: result.value.organizations.filter((organization) => organization.id === selectedId),
    documents: result.value.documents.filter((document) => document.organizationId === selectedId),
    targets: result.value.targets.filter((target) => target.organizationId === selectedId),
    bindings: result.value.bindings.filter((binding) => binding.organizationId === selectedId),
  } : null;
  const documents = value?.documents.map((document) => {
    const binding = value.bindings.find((item) => item.documentId === document.id && !item.revokedAt);
    const target = binding ? value.targets.find((item) => item.id === binding.targetId) : null;
    const ext = document.fileName.split(".").pop()?.toLowerCase();
    const kind = ext === "pdf" ? "pdf" as const : ext === "doc" || ext === "docx" ? "docx" as const : ext === "xls" || ext === "xlsx" ? "xlsx" as const : "file" as const;
    const expired = isDocumentExpired(document.expiresOn);
    const ready = document.status === "VERIFIED" && document.scanStatus === "CLEAN" && Boolean(document.scanResultId);
    const state = document.scanStatus === "PENDING" ? (locale === "fr" ? "Analyse en cours" : "الفحص جارٍ") : document.scanStatus === "ERROR" ? (locale === "fr" ? "Analyse indisponible" : "الفحص غير متاح") : document.scanStatus === "INFECTED" || document.status === "QUARANTINED" ? (locale === "fr" ? "Document en quarantaine" : "مستند في الحجر") : document.status === "SUPERSEDED" ? (locale === "fr" ? "Version remplacée" : "إصدار مستبدل") : document.status === "REJECTED" ? (locale === "fr" ? "À remplacer" : "للاستبدال") : (locale === "fr" ? "Vérification en cours" : "التحقق جارٍ");
    return {
      id: document.id,
      title: document.fileName,
      folder: target?.label ?? document.type,
      status: !ready ? state : expired ? (locale === "ar" ? "منتهي الصلاحية" : "Expiré") : binding ? (locale === "ar" ? "مشترك" : "Partagé") : value.bindings.some((item)=>item.documentId===document.id&&item.revokedAt) ? (locale==="ar"?"مشاركة ملغاة":"Partage révoqué") : (locale === "ar" ? "خاص" : "Privé"),
      access: locale === "ar" ? "الأشخاص المخوّلون" : "Personnes habilitées",
      href: !ready || expired ? `/${locale}/client/onboarding${space.selectedQuery}` : `/api/client/documents/${document.id}`,
      kind,
      tone: !ready || expired ? "peach" as const : "mint" as const,
    };
  }) ?? [];
  return (
    <ClientAppShell languagePath={`/${locale}/client/documents?${new URLSearchParams({organizationId:space.selectedOrganizationId,q:query.q??"",page:String(page)})}`} locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} organizationName={space.organizationName} active="documents" title={c.docsTitle} lead={c.docsLead} kicker={c.kicker} actions={<SpaceActions href={`/${locale}/client/onboarding${space.selectedQuery}`} label={c.addDoc} />}>
      {result.status==='error'?<p role="alert" className="client-card">{locale==='fr'?(result.reason==='FORBIDDEN'?'Vous ne disposez pas des droits pour ce coffre.':'Le coffre est momentanément indisponible. Réessayez.'):(result.reason==='FORBIDDEN'?'لا تملكون صلاحية الوصول إلى الخزنة.':'الخزنة غير متاحة مؤقتاً. حاولوا مجدداً.')}</p>:<>
      {reuseResult.error || !reuse.success ? <p role="alert">{locale === "fr" ? "Les demandes d’autorisation sont momentanément indisponibles. Vérifiez vos droits et votre authentification renforcée." : "طلبات الإذن غير متاحة مؤقتاً. تحققوا من الصلاحيات والمصادقة المعززة."}</p> : <AdminReusePanel locale={locale} requests={pendingReuse} keys={Object.fromEntries(pendingReuse.map(request => [request.id, randomUUID()]))} />}
      <form method="get" className="flex flex-wrap items-end gap-3"><input type="hidden" name="organizationId" value={space.selectedOrganizationId}/><label>{locale === "fr" ? "Rechercher dans tout le coffre" : "البحث في الخزنة كاملة"}<input name="q" defaultValue={query.q} maxLength={200} className="block min-h-11 border p-2"/></label><button className="min-h-11 rounded-md border px-4">{locale === "fr" ? "Rechercher" : "بحث"}</button><Link href={space.selectedQuery}>{locale === "fr" ? "Réinitialiser" : "إعادة التعيين"}</Link><p>{result.value.total} {locale === "fr" ? "document(s) correspondant(s)" : "مستند مطابق"}</p></form>
      <DocumentsBoard locale={locale} query={space.selectedQuery} organizationName={space.organizationName} documents={documents} toHandle={documents.filter((item) => item.tone === "peach").map((item) => ({ id: item.id, title: item.title, href: item.href, tone: item.tone, action: "examine" as const }))}>
        {value ? <DocumentVaultPanel locale={locale} data={value} keys={{ link: randomUUID(), revoke: Object.fromEntries(value.bindings.map((binding) => [binding.id, randomUUID()])) }} /> : null}
      </DocumentsBoard>
      <nav className="flex gap-4" aria-label={locale==='fr'?'Pages des documents':'صفحات المستندات'}>{page>1?<Link href={`${space.selectedQuery}&q=${encodeURIComponent(query.q??"")}&page=${page-1}`}>{locale==='fr'?'Précédent':'السابق'}</Link>:null}{result.value.hasNext?<Link href={`${space.selectedQuery}&q=${encodeURIComponent(query.q??"")}&page=${page+1}`}>{locale==='fr'?'Suivant':'التالي'}</Link>:null}</nav></>}
    </ClientAppShell>
  );
}
