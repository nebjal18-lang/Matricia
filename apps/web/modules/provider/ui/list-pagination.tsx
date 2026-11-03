import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
export function ProviderListPagination({locale,path,query,page,hasMore}:{locale:Locale;path:string;query:string;page:number;hasMore:boolean}){
 const href=(next:number)=>{const p=new URLSearchParams(query.replace(/^\?/,""));p.set("page",String(next));return `${path}?${p}`;};
 return <nav className="flex flex-wrap items-center gap-3" aria-label={locale==="ar"?"صفحات القائمة":"Pages de la liste"}>{page>1?<Link className="client-ghost-link" href={href(page-1)}>{locale==="ar"?"السابق":"Précédente"}</Link>:null}<span>{locale==="ar"?"الصفحة":"Page"} {page}</span>{hasMore?<Link className="client-ghost-link" href={href(page+1)}>{locale==="ar"?"التالي":"Suivante"}</Link>:null}</nav>;
}
