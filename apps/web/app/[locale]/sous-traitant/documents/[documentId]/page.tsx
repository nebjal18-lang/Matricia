import Link from "next/link";
import {notFound,redirect} from "next/navigation";
import {z} from "zod";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {isLocale} from "@/modules/shared/lib/i18n/locale";
import {connexionHref} from "@/modules/shared/lib/auth/connexion-href";
import {resolveProviderSpace} from "@/modules/provider/data/spaces/context";
import {providerContextReadState} from "@/modules/provider/data/spaces/organization-context";
import {getProviderStatusLabel} from "@/modules/provider/screens/qualification/messages";
import {workflowStatusLabel} from "@/modules/shared/lib/i18n/workflow-statuses";
import {ProviderAppShell} from "@/modules/provider/ui/provider-app-shell";
import {ProviderReadState} from "@/modules/provider/ui/provider-read-state";
const uuid=z.string().uuid();
const document=z.object({id:uuid,family_id:uuid,version_number:z.number().int(),status:z.string(),issued_on:z.string().nullable(),expires_on:z.string().nullable(),storage_object_path:z.string(),content_hash:z.string(),change_reason:z.string(),created_at:z.string(),provider_document_families:z.object({code:z.string(),document_kind:z.string()})});
export default async function ProviderDocumentVersionPage({params,searchParams}:{params:Promise<{locale:string;documentId:string}>;searchParams:Promise<{organizationId?:string;page?:string}>}){
 const {locale,documentId}=await params,query=await searchParams;if(!isLocale(locale)||!uuid.safeParse(documentId).success)notFound();
 const space=await resolveProviderSpace({locale,organizationId:query.organizationId});if(space.status==="unauthenticated")redirect(connexionHref(locale,{next:`/${locale}/sous-traitant/documents/${documentId}`}));
 const contextState=providerContextReadState(space,query.organizationId),ar=locale==="ar",selfHref=`/${locale}/sous-traitant/documents/${documentId}${space.selectedQuery}`;
 const shell=(content:React.ReactNode,title:string)=><ProviderAppShell locale={locale}organizations={space.organizations}selectedQuery={space.selectedQuery}selectedOrganizationId={space.selectedOrganizationId}userEmail={space.userEmail}active="documents"title={title}>{content}</ProviderAppShell>;
 if(contextState)return shell(<ProviderReadState locale={locale}state={contextState}retryHref={selfHref}/>,ar?"وثيقة التأهيل":"Document de qualification");
 const client=await getSupabaseServerClient(),result=await client.from("provider_document_versions").select("id,family_id,version_number,status,issued_on,expires_on,storage_object_path,content_hash,change_reason,created_at,provider_document_families!inner(code,document_kind)").eq("id",documentId).eq("provider_organization_id",space.selectedOrganizationId).maybeSingle();
 if(result.error)return shell(<ProviderReadState locale={locale}state="unavailable"retryHref={selfHref}/>,ar?"وثيقة التأهيل":"Document de qualification");
 const doc=document.safeParse(result.data);if(!doc.success)notFound();
 const page=/^[1-9]\d{0,4}$/.test(query.page??"")?Number(query.page):1;
 const [scan,historyResult]=await Promise.all([
  client.from("provider_document_scan_jobs").select("scan_status").eq("storage_object_path",doc.data.storage_object_path).eq("provider_organization_id",space.selectedOrganizationId).maybeSingle(),
  client.from("provider_document_versions").select("id,version_number,status,created_at,change_reason").eq("family_id",doc.data.family_id).eq("provider_organization_id",space.selectedOrganizationId).order("version_number",{ascending:false}).range((page-1)*30,page*30)
 ]);
 const scanStatus=z.object({scan_status:z.enum(["PENDING","CLEAN","INFECTED","ERROR"])}).safeParse(scan.data),history=z.array(z.object({id:uuid,version_number:z.number().int().positive(),status:z.string(),created_at:z.string(),change_reason:z.string()})).max(31).safeParse(historyResult.data);
 return shell(<main className="client-page space-y-6"><article className="client-card space-y-3"><h2>{getProviderStatusLabel(locale,doc.data.provider_document_families.document_kind)}</h2><p>{workflowStatusLabel(doc.data.status,locale)} · {scanStatus.success&&!scan.error?workflowStatusLabel(scanStatus.data.scan_status,locale):ar?"حالة الفحص غير متاحة":"État d’analyse indisponible"}</p><p>{ar?"تاريخ الإصدار":"Émise le"} : {doc.data.issued_on??"—"} · {ar?"تاريخ الانتهاء":"Expiration"} : {doc.data.expires_on??"—"}</p><p>{doc.data.change_reason}</p><details><summary>{ar?"بصمة النسخة":"Empreinte de cette version"}</summary><code className="break-all"dir="ltr">{doc.data.content_hash}</code></details>{!scan.error&&scanStatus.success&&scanStatus.data.scan_status==="CLEAN"?<a className="client-text-link"href={`/api/provider/documents/${documentId}`}>{ar?"تنزيل هذه النسخة":"Télécharger cette version"}</a>:<p>{ar?"الملف في الحجر حتى تأكيد سلامة الفحص":"Fichier en quarantaine jusqu’à confirmation d’une analyse saine"}</p>}<Link href={`/${locale}/sous-traitant/qualification${space.selectedQuery}#documents`}>{ar?"تحديث وثائق التأهيل":"Mettre à jour les pièces de qualification"}</Link></article><section className="client-card"><h2>{ar?"تاريخ النسخ غير القابلة للتعديل":"Historique des versions immuables"}</h2>{historyResult.error||!history.success?<ProviderReadState locale={locale}state="unavailable"retryHref={selfHref}/>:<><ol>{history.data.slice(0,30).map(version=><li key={version.id}className="border-b py-3"><Link className="client-text-link"href={`/${locale}/sous-traitant/documents/${version.id}${space.selectedQuery}`}aria-current={version.id===documentId?"page":undefined}>v{version.version_number} · {workflowStatusLabel(version.status,locale)}</Link><p>{version.change_reason}</p><time dateTime={version.created_at}>{version.created_at.slice(0,10)}</time></li>)}</ol><nav aria-label={ar?"صفحات التاريخ":"Pages de l’historique"}>{page>1?<Link className="client-ghost-link"href={`${selfHref}&page=${page-1}`}>{ar?"السابق":"Précédente"}</Link>:null}<span>{page}</span>{history.data.length>30?<Link className="client-ghost-link"href={`${selfHref}&page=${page+1}`}>{ar?"التالي":"Suivante"}</Link>:null}</nav></>}</section></main>,`${doc.data.provider_document_families.code} · v${doc.data.version_number}`);
}
