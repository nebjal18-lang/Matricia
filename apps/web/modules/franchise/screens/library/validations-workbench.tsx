import{FranchiseReviewDiff}from"./review-diff";
import{CatalogServerPagination}from"./server-pagination";
import Link from "next/link";
import { Lock, Pencil } from "lucide-react";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import { catalogStatusLabel, type FranchiseCatalogRow, type FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { KindChip, LanguageMarks, MandateBanner, nextAction } from "./library-boards";
import { FranchisePublishReleaseForm } from "./catalog-commands";

export const FRANCHISE_VALIDATION_BUCKETS: Record<string, string[] | null> = {
  brouillons: ["DRAFT"],
  "en-cours": ["IN_REVIEW", "FRANCHISE_REVIEW", "CENTRAL_REVIEW", "LOCAL_TEST"],
  corrections: ["REJECTED", "CHANGES_REQUESTED"],
  approuves: ["APPROVED"],
  publications: ["PUBLISHED"],
  historique: null,
};

function bucketLabel(key: string, locale: Locale) {
  const c = libraryCopy(locale);
  if (key === "brouillons") return c.bucketDrafts;
  if (key === "en-cours") return c.bucketReview;
  if (key === "corrections") return c.bucketCorrections;
  if (key === "approuves") return c.bucketApproved;
  if (key === "publications") return c.bucketPublished;
  return c.bucketHistory;
}

function filterRows(rows: FranchiseCatalogRow[], bucket: string | null) {
  const allowed = bucket ? FRANCHISE_VALIDATION_BUCKETS[bucket] : undefined;
  if (!bucket || allowed === undefined) return rows;
  if (allowed === null) return rows;
  return rows.filter((item) => allowed.includes(item.status) || (bucket==="corrections"&&item.reviewEvents?.[0]?.status==="REJECTED"));
}

function reviewStatus(status: string, locale: Locale) {
  const c = libraryCopy(locale);
  if (status === "DRAFT") return c.notSubmitted;
  return catalogStatusLabel(status, locale);
}

export function FranchiseValidationsWorkbench({
  locale,
  query,
  workspace,
  bucket = null,
  commandIdentity,
  organizationId = null,
  filters,
}: {
  locale: Locale;
  query: string;
  workspace: FranchiseLibraryWorkspace;
  bucket?: string | null;
  commandIdentity?: { idempotencyKey: string; correlationId: string };
  organizationId?: string | null;
  filters?:{q?:string;type?:string;category?:string;selected?:string;page?:string};
}) {
  const c = libraryCopy(locale);
  const all = [...workspace.services, ...workspace.questionnaires, ...workspace.rules];
  const activeBucket = bucket && bucket in FRANCHISE_VALIDATION_BUCKETS ? bucket : "brouillons";
  const needle=(filters?.q??"").trim().toLocaleLowerCase();
  const rows = (workspace.serverPage?all:filterRows(all, activeBucket)).filter((item)=>(!filters?.type||filters.type==="all"||item.kind===filters.type)&&(!filters?.category||filters.category==="all"||item.category===filters.category||workspace.categories.some(category=>category.id===filters.category&&category.children.some(child=>child.id===item.subcategoryId)))&&(!needle||`${item.title} ${item.code} ${item.reviewEvents?.[0]?.comment??""}`.toLocaleLowerCase().includes(needle)));
  const selected = rows.find((item)=>item.id===filters?.selected)??rows[0]??null;
  const selectionHref=(id:string)=>{const params=new URLSearchParams(query.replace(/^\?/,""));for(const[key,value]of Object.entries(filters??{}))if(value)params.set(key,value);params.set("selected",id);return`/${locale}/franchise/validations/${activeBucket}?${params}`;};
  const date=(value:string|null|undefined)=>value?new Intl.DateTimeFormat(locale==="ar"?"ar-MA":"fr-MA",{dateStyle:"medium",timeZone:"Africa/Casablanca"}).format(new Date(value)):"—";
  const bucketKeys = Object.keys(FRANCHISE_VALIDATION_BUCKETS);
  const paginationQuery = new URLSearchParams(query.replace(/^\?/, ""));
  for (const [key, value] of Object.entries(filters ?? {})) if (value && key !== "page") paginationQuery.set(key, value);
  return (
    <main className="client-page">
      <MandateBanner locale={locale} name={workspace.mandate.libraryName} />
      <nav className="franchise-pill-tabs" aria-label={c.validationsTitle}>
        {bucketKeys.map((key) => (
          <Link
            key={key}
            href={`/${locale}/franchise/validations/${key}${query}`}
            className="franchise-pill-tab"
            data-active={activeBucket === key ? "true" : undefined}
          >
            <span>{bucketLabel(key, locale)}</span>
            <em dir="ltr">{workspace.serverPage?.bucketCounts?(key==="historique"?Object.values(workspace.serverPage.bucketCounts).reduce((sum,n)=>sum+n,0):(FRANCHISE_VALIDATION_BUCKETS[key]??[]).reduce((sum,status)=>sum+(workspace.serverPage?.bucketCounts?.[status]??0),0)):key === "historique" ? all.length : filterRows(all, key).length}</em>
          </Link>
        ))}
      </nav>
      <section className="franchise-validation-grid">
        <article className="client-card">
          <header className="client-priority-head">
            <h2>{c.queueItems} <small dir="ltr">({rows.length})</small></h2>
          </header>
          <form className="franchise-filters" action={`/${locale}/franchise/validations/${activeBucket}`} method="get"><input type="hidden" name="organizationId" value={workspace.mandate.operatorOrganizationId??""}/><input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId}/>
            <label>
              <span className="sr-only">{c.kind}</span>
              <select name="type" defaultValue={filters?.type??"all"}><option value="all">{c.queueAllTypes}</option>{["SERVICE","QUESTIONNAIRE","RULE"].map((kind)=><option key={kind} value={kind}>{kind==="SERVICE"?c.servicesTitle:kind==="QUESTIONNAIRE"?c.questionnairesTitle:c.rulesTitle}</option>)}</select>
            </label>
            <label>
              <span className="sr-only">{c.category}</span>
              <select name="category" defaultValue={filters?.category??"all"}><option value="all">{c.categoriesOfLibrary}</option>{(workspace.categories ?? []).map(category=><option key={category.id} value={category.id}>{category.title}</option>)}</select>
            </label>
            <label className="franchise-search">
              <span className="sr-only">{c.search}</span>
              <input name="q" defaultValue={filters?.q} placeholder={c.search} />
            </label>
            <button type="submit" className="franchise-tool">{c.search}</button>
          </form>
          {rows.length === 0 ? <p>{c.emptyQueue}</p> : (
            <div className="client-table-wrap client-compare">
              <table className="client-space-table">
                <thead>
                  <tr>
                    <th>{c.kind}</th>
                    <th>{c.element}</th>
                    <th>{c.version}</th>
                    <th>{c.languages}</th>
                    <th>{c.modifiedOn}</th>
                    <th>{c.reviewStatus}</th>
                    <th>{c.lastComment}</th>
                    <th>{c.next}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={`${item.kind}-${item.id}`} data-selected={item.id === selected?.id ? "true" : undefined}>
                      <td><KindChip kind={item.kind} locale={locale} /></td>
                      <td>
                        <Link href={selectionHref(item.id)} className="client-soft-link"><strong>{item.title}</strong></Link>
                        <small>{item.subcategory ?? item.category ?? workspace.mandate.libraryName}</small>
                      </td>
                      <td><span className="franchise-version-chip" dir="ltr">{item.versionLabel ?? "v1.0"}</span></td>
                      <td><LanguageMarks item={item} /></td>
                      <td>{date(item.reviewEvents?.[0]?.reviewedAt??item.reviewEvents?.[0]?.requestedAt)}</td>
                      <td><em className="client-status-chip" data-tone={item.status === "DRAFT" ? "sky" : "peach"}>{reviewStatus(item.status, locale)}</em></td>
                      <td>{item.reviewEvents?.[0]?.comment??c.noComment}</td>
                      <td>
                        <Link href={item.href} className="franchise-tool franchise-tool-primary">
                          {item.status === "DRAFT" ? c.submitRow : nextAction(item.status, locale)}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <CatalogServerPagination page={workspace.serverPage} locale={locale} query={`?${paginationQuery}`}/>
          {commandIdentity && (activeBucket === "approuves" || activeBucket === "publications") ? (
            <FranchisePublishReleaseForm locale={locale} workspace={workspace} commandIdentity={commandIdentity} organizationId={organizationId} />
          ) : null}
          <p className="client-access-note">{c.clientsNote}</p>
        </article>
        <aside className="client-card franchise-review-panel">
          <header>
            <h2>{c.reviewPanel}</h2>
            {selected ? (
              <p>
                <KindChip kind={selected.kind} locale={locale} />
                <strong>{selected.title}</strong>
                <small>{selected.versionLabel ?? "v1.0"} · {selected.subcategory ?? selected.category ?? workspace.mandate.libraryName}</small>
              </p>
            ) : <p>{c.emptyQueue}</p>}
          </header>
          <p className="franchise-mandate-banner" role="note">
            <Lock className="size-3.5" aria-hidden />
            <span>{c.scope} {workspace.mandate.libraryName}</span>
          </p>
          <h3>{c.reviewTimeline}</h3>
          {(selected?.reviewEvents?.length??0)>0?<ol className="franchise-review-steps">{selected?.reviewEvents?.map((event)=><li key={event.id}><span><strong>{catalogStatusLabel(event.status,locale)}</strong><small>{date(event.requestedAt)}{event.reviewedAt?` → ${date(event.reviewedAt)}`:""}</small><small>{event.comment??c.noComment}</small></span><FranchiseReviewDiff franchiseId={workspace.mandate.franchiseId} requestId={event.id} locale={locale}/></li>)}</ol>:<p>{locale==="ar"?"لم يُرسل هذا الإصدار للمراجعة بعد.":"Aucune demande de revue n’a encore été enregistrée pour cet élément."}</p>}
          <div className="franchise-comment-box"><strong>{c.lastComment}</strong><p>{selected?.reviewEvents?.[0]?.comment??c.noComment}</p></div>
          <div className="franchise-toolbar">
            {selected ? <Link href={selected.href} className="franchise-tool"><Pencil className="size-4" aria-hidden /> {c.fixDraft}</Link> : null}
            <p className="client-access-note">{c.seeApproved}</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
