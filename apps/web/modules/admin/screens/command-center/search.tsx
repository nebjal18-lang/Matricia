import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { AdminCommandCenter } from "@/modules/admin/data/command-center/model";
import { dossierHref } from "@/modules/admin/data/command-center/view-model";
import { adminDirectoryGroups } from "@/modules/admin/data/spaces/directory";

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
export function searchAdminLoadedContent(locale: Locale, query: string, organizationQuery: string, dashboard: AdminCommandCenter | null) {
  const tokens = normalize(query).split(/\s+/u).filter(Boolean);
  if (!tokens.length) return [];
  const matches = (text: string) => tokens.every(token => normalize(text).includes(token));
  const alternate = adminDirectoryGroups(locale === "fr" ? "ar" : "fr", organizationQuery).flatMap(group => group.links);
  const pages = adminDirectoryGroups(locale, organizationQuery).flatMap(group => group.links);
  const seen = new Set<string>();
  const links = pages.flatMap((page, index) => {
    if (seen.has(page.href) || !matches(`${page.label} ${alternate[index]?.label ?? ""} ${page.href.split("?")[0]}`)) return [];
    seen.add(page.href);
    return [{ ...page, kind: "page" as const }];
  });
  const dossiers = (dashboard?.workItems ?? []).filter(item => matches(`${item.titleFr} ${item.titleAr} ${item.resourceId} ${item.resourceType}`)).map(item => ({
    href: `${dossierHref(locale, item)}${organizationQuery}`,
    label: locale === "ar" ? item.titleAr : item.titleFr,
    kind: "dossier" as const,
  }));
  const actions = (dashboard?.actions ?? []).filter(item => matches(`${item.reason} ${item.resourceType} ${item.resourceId} ${item.actionType}`)).map(item => ({
    href: `#admin-action-${item.id}`, label: `${item.reason} · ${item.resourceId}`, kind: "action" as const,
  }));
  return [...links, ...dossiers, ...actions];
}

export function AdminSearchResults({ locale, query, organizationQuery, dashboard }: { locale: Locale; query: string; organizationQuery: string; dashboard: AdminCommandCenter | null }) {
  const results = searchAdminLoadedContent(locale, query, organizationQuery, dashboard);
  const ar = locale === "ar";
  return <section className="client-card" aria-labelledby="admin-search-title" aria-live="polite">
    <h2 id="admin-search-title">{ar ? "نتائج البحث" : "Résultats de recherche"} : {query}</h2>
    <p>{ar ? "يشمل البحث الصفحات والملفات المحمّلة والصفحة الحالية من الإجراءات. لا يشمل كامل الأرشيف." : "Recherche dans les pages, les dossiers chargés et la page actuelle des actions. L’archive complète n’est pas parcourue."}</p>
    {!dashboard ? <p role="status">{ar ? "البحث في الملفات غير متاح حالياً؛ نتائج الصفحات فقط." : "La recherche de dossiers est indisponible ; seuls les liens de pages sont proposés."}</p> : null}
    {results.length ? <ul>{results.map((result, index) => <li key={`${result.href}-${index}`}><Link href={result.href}>{result.label}</Link></li>)}</ul> : <p role="status">{ar ? "لا توجد نتيجة لهذا البحث ضمن المحتوى المتاح." : "Aucun résultat pour cette recherche dans le contenu disponible."}</p>}
  </section>;
}
