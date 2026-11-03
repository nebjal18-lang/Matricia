import Link from "next/link";
import type {QuoteRevisionInProgress} from "@/modules/client/data/rfq/publication-state";
export function QuoteRevisionNotice({locale,requestId,query,revisions}:{locale:"fr"|"ar";requestId:string;query:string;revisions:QuoteRevisionInProgress[]}) {
 if(!revisions.length)return null;
 const ar=locale==="ar";
 return <article className="client-card" role="status"><h2>{ar?"عروض قيد المراجعة":"Devis en cours de révision"}</h2><p>{ar?"توجد عروض منشورة يجري تعديلها. تظل نسخها المنشورة السابقة متاحة في السجل. المسودات الجديدة خاصة بمقدمي الخدمات؛ يتطلب الاختيار إعادة النشر وتحديث المقارنة.":"Des offres déjà publiées sont en cours de révision. Leurs versions publiées précédentes restent consultables dans l’historique. Les nouveaux brouillons restent privés ; leur sélection attend la republication et une comparaison actualisée."}</p><ul>{revisions.map((revision,index)=><li key={revision.quoteId}><Link className="client-text-link" href={`/${locale}/client/demandes/${requestId}/offres/${revision.quoteId}?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(query.replace(/^\?/,""))),versionId:revision.publishedVersionId})}`}>{ar?`الاطلاع على النسخة المنشورة السابقة ${index+1}`:`Consulter la version publiée précédente ${index+1}`}</Link></li>)}</ul></article>;
}
