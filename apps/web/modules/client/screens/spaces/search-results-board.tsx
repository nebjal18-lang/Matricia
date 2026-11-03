import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { clientDashboardCopy } from "@/modules/client/data/home/copy";
import type { ClientSearchHit, ClientSearchKind } from "@/modules/client/data/search/workspace-search";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export function SearchResultsBoard({
  locale,
  query,
  hits,
  unavailable,
  moreResults=[],
}: {
  locale: Locale;
  query: string;
  hits: readonly ClientSearchHit[];
  unavailable: readonly ClientSearchKind[];
  moreResults?: readonly {kind:ClientSearchKind;href:string;total?:number}[];
}) {
  const c = clientDashboardCopy[locale];
  const kindLabel: Record<ClientSearchKind, string> = {
    action: c.searchKindAction,
    request: c.searchKindRequest,
    mission: c.searchKindMission,
    contract: c.searchKindContract,
    document: c.searchKindDocument,
    message: c.searchKindMessage,
  };
  if (query.trim().length < 2) {
    return <main className="client-page"><p>{c.searchHint}</p></main>;
  }
  return (
    <main className="client-page client-action-file space-y-5">
      {unavailable.length > 0 ? <p role="status">{c.searchUnavailable}</p> : null}
      {hits.length === 0 ? (
        <p>{unavailable.length?(locale==="fr"?"Aucun résultat n’a pu être chargé dans les rubriques disponibles. Réessayez les rubriques signalées indisponibles.":"لم يتم تحميل أي نتيجة من الأقسام المتاحة. أعيدوا محاولة الأقسام غير المتاحة."):c.searchEmpty}</p>
      ) : (
        <div className="client-treat">
          {hits.map((hit) => (
            <Link key={hit.id} href={hit.href} className="client-treat-tile">
              <div>
                <strong>{hit.title}</strong>
                <small>{kindLabel[hit.kind]} · {hit.detail}</small>
              </div>
              <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
            </Link>
          ))}
        </div>
      )}
      {moreResults.length?<nav aria-label={locale==="fr"?"Tous les résultats par rubrique":"جميع النتائج حسب القسم"} className="flex flex-wrap gap-4">{moreResults.map(result=><Link className="min-h-11 underline" key={result.kind} href={result.href}>{locale==="fr"?"Tous les résultats":"جميع النتائج"} · {kindLabel[result.kind]}{result.total!==undefined?` (${result.total})`:""}</Link>)}</nav>:null}
    </main>
  );
}
