import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAccessPage } from "@/modules/franchise/ui/franchise-access-page";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { catalogStatusLabel } from "@/modules/franchise/data/library/workspace-model";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export default async function FranchiseSearchPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{organizationId?:string;franchiseId?:string;q?:string;page?:string}>}) {
  const [{locale},query]=await Promise.all([params,searchParams]);
  if(!isLocale(locale))notFound();
  const search=(query.q??"").trim().slice(0,120);
  const {space,result}=await requireFranchiseLibrary({locale,organizationId:query.organizationId,franchiseId:query.franchiseId,returnPath:`/${locale}/franchise/recherche`,returnQuery:query,catalog:{kind:"ALL",search,page:query.page}});
  if(result.status==="error")return <FranchiseAccessPage locale={locale} space={space} reason={result.reason} active="library" returnPath={space.currentPath}/>;
  const ar=locale==="ar",workspace=result.workspace;
  const rows=[...workspace.services,...workspace.questionnaires,...workspace.rules,...workspace.questions.map(row=>({id:row.id,title:row.label,status:row.status,kind:"QUESTION" as const,href:`/${locale}/franchise/questions/${row.id}${space.selectedQuery}`}))];
  const labels={SERVICE:ar?"خدمة":"Service",QUESTIONNAIRE:ar?"استبيان":"Questionnaire",RULE:ar?"قاعدة":"Règle",QUESTION:ar?"سؤال":"Question"};
  const page=workspace.serverPage;
  const totals=page?Object.values(page.groups).map(group=>group.total):[];
  const total=page?totals.reduce((sum,n)=>sum+n,0):rows.length;
  const last=page?Math.max(1,...totals.map(n=>Math.ceil(n/page.pageSize))):1;
  const href=(number:number)=>{const p=new URLSearchParams(space.selectedQuery);p.set("q",search);p.set("page",String(number));return`/${locale}/franchise/recherche?${p}`;};
  return <FranchiseAppShell locale={locale} selectedQuery={space.selectedQuery} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} mandates={space.mandates} languagePath={space.currentPath} active="library" title={ar?"البحث في مكتبتكم":"Rechercher dans votre bibliothèque"} mandateName={workspace.mandate.libraryName}>
    <main className="client-page"><section className="client-card space-y-4">
      <form method="get" action={`/${locale}/franchise/recherche`} role="search" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="organizationId" value={space.selectedOrganizationId??""}/><input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId}/>
        <label className="grid min-w-0 flex-1 gap-2" htmlFor="franchise-library-search">{ar?"خدمة أو سؤال أو قاعدة":"Service, question ou règle"}<input id="franchise-library-search" name="q" defaultValue={search} maxLength={120} className="min-h-11 rounded border px-3"/></label>
        <button className="franchise-tool" type="submit">{ar?"بحث":"Rechercher"}</button>
      </form>
      {!search?<p>{ar?"أدخلوا اسماً أو رمزاً أو كلمات من النص المعتمد في مكتبتكم.":"Saisissez un nom, un code ou des mots du contenu de votre bibliothèque."}</p>:<><p role="status">{total} {ar?"نتيجة":"résultat(s)"} — <bdi>{search}</bdi></p>
        {rows.length?<ul className="space-y-3">{rows.map(row=><li key={`${row.kind}-${row.id}`} className="flex flex-wrap items-center justify-between gap-2 border-b py-3"><Link href={row.href} className="inline-flex min-h-11 items-center font-semibold underline">{row.title}</Link><span>{labels[row.kind]} · {catalogStatusLabel(row.status,locale)}</span></li>)}</ul>:<p>{ar?"لا توجد نتيجة لهذا البحث ضمن التكليف المحدد. جرّبوا عبارة أخرى.":"Aucun résultat pour cette recherche dans le mandat sélectionné. Essayez un autre terme."}</p>}
        <nav className="franchise-pagination" aria-label={ar?"صفحات نتائج البحث":"Pages des résultats de recherche"}><span>{page?.page??1}/{last}</span>{page&&page.page>1?<Link href={href(page.page-1)} className="inline-flex min-h-11 items-center underline">{ar?"السابق":"Précédent"}</Link>:null}{page&&page.page<last?<Link href={href(page.page+1)} className="inline-flex min-h-11 items-center underline">{ar?"التالي":"Suivant"}</Link>:null}</nav>
      </>}
    </section></main>
  </FranchiseAppShell>;
}
