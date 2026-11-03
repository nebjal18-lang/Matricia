import type {ObligationRetirement} from "@/modules/shared/lib/contracts-missions/operational-scope";
export function ObligationRetirementNotice({retirement,locale}:{retirement?:ObligationRetirement;locale:"fr"|"ar"}){
 if(!retirement)return null;
 const ar=locale==="ar";
 return <aside className="my-3 space-y-2 rounded-lg border bg-muted/50 p-3 text-sm"><strong>{retirement.operation==="REPLACE"?(ar?"التزام سابق تم استبداله":"Ancienne obligation remplacée"):(ar?"التزام مسحوب من التنفيذ":"Obligation retirée de l’exécution")}</strong><p>{ar?"تُحفظ التسليمات والاستلامات والأدلة السابقة بصفتها التاريخية. لا يعادل هذا السحب قبولاً ولا يمحو النزاعات أو آثارها المالية.":"Les livraisons, réceptions et preuves antérieures restent conservées dans leur historique. Ce retrait ne vaut pas réception et n’efface ni les litiges ni leurs conséquences financières."}</p>{retirement.replacementDeliverableId?<a href={`#deliverable-${retirement.replacementDeliverableId}`} className="underline">{ar?"عرض الالتزام البديل واستلامه المستقل":"Voir l’obligation de remplacement et sa réception indépendante"}</a>:null}</aside>;
}

export function RetiredOperationalNotice({retired,locale}:{retired?:boolean;locale:"fr"|"ar"}){return retired?<p className="my-2 rounded-md border bg-muted/50 p-2 text-sm">{locale==="ar"?"عنصر تشغيلي مؤرشف بملحق موقع؛ تُحفظ حالته السابقة ولا يتطلب إجراءً جديداً.":"Élément opérationnel archivé par avenant signé ; son état antérieur est conservé et ne demande plus d’action."}</p>:null}
