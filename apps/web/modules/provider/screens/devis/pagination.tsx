import Link from "next/link";
import {providerSearchQuery} from "@/modules/provider/data/spaces/list-rows";
export function ProviderQuotePagination({locale,path,query,pagination}:{locale:"fr"|"ar";path:"devis"|"consultations";query:string;pagination?:{page:number;pageSize:number;total:number}}) {
 if(!pagination)return null;
 const {page,pageSize,total}=pagination,last=Math.max(1,Math.ceil(total/pageSize)),ar=locale==="ar";
 const href=(value:number)=>`/${locale}/sous-traitant/${path}${providerSearchQuery(query,{page:String(value)})}`;
 return <nav className="client-card flex min-w-0 flex-wrap items-center gap-4" aria-label={ar?"صفحات الملفات":"Pages des dossiers"}>
  {page>1?<Link className="client-ghost-link" href={href(page-1)}>{ar?"السابق":"Précédent"}</Link>:null}
  <p role="status">{ar?`الصفحة ${page} من ${last} — ${total} نتيجة إجمالية`:`Page ${page} sur ${last} — ${total} résultats au total`}</p>
  {page<last?<Link className="client-ghost-link" href={href(page+1)}>{ar?"التالي":"Suivant"}</Link>:null}
  {page>last?<Link className="client-text-link" href={href(1)}>{ar?"العودة إلى الصفحة الأولى":"Revenir à la première page"}</Link>:null}
 </nav>;
}
