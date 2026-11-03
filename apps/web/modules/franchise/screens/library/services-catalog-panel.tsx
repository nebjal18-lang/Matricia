"use client";

import Link from "next/link";
import{usePathname,useRouter,useSearchParams}from"next/navigation";
import type{CatalogServerPage}from"@/modules/franchise/data/library/server-page";
import { useState } from "react";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import type { FranchiseCatalogRow, FranchiseCategoryNode } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { FranchiseCategoryCreateForm, FranchiseSubcategoryCreateForm } from "./catalog-commands";
import { KindChip, LanguageMarks, StatusChip, nextAction } from "./library-boards";
import { FranchiseRowMenu } from "./library-chrome";

function completeness(item: FranchiseCatalogRow) {
  return Math.round(([item.nameFr, item.nameAr, item.description].filter(Boolean).length / 3) * 100);
}

export function ServicesCatalogPanel({
  locale,
  workspaceName,
  categories,
  services,
  selectedId,
  libraryId,
  organizationId,
  commandIdentity,
  serverPage,
}: {
  serverPage?:CatalogServerPage;
  locale: Locale;
  workspaceName: string;
  categories: FranchiseCategoryNode[];
  services: FranchiseCatalogRow[];
  selectedId: string | null;
  libraryId: string;
  organizationId: string | null;
  commandIdentity: { idempotencyKey: string; correlationId: string };
}) {
  const c = libraryCopy(locale);
  const router=useRouter();const pathname=usePathname();const searchParams=useSearchParams();
  const [query,setQuery]=useState(serverPage?.search??"");
  const status=serverPage?.status??"ALL";const language=serverPage?.language??"ALL";const complete=serverPage?.completeness??"ALL";const validation=serverPage?.validation??"ALL";const categoryId=serverPage?.categoryId??null;
  function navigate(values:Record<string,string|null>){const params=new URLSearchParams(searchParams.toString());params.delete("page");for(const[key,value]of Object.entries(values)){if(value&&value!=="ALL")params.set(key,value);else params.delete(key);}router.push(`${pathname}?${params}`);}
  const rows=services;const paged=rows;const pageCount=Math.max(1,Math.ceil((serverPage?.groups.SERVICE.total??rows.length)/25));const safePage=serverPage?.page??1;

  return (
    <>
      <article className="client-card">
        <header><h2>{c.catalogTree}</h2></header>
        <p className="client-access-note">{workspaceName}</p>
        <form onSubmit={(event)=>{event.preventDefault();navigate({q:query});}} className="franchise-search"><label>
          <span className="sr-only">{c.searchService}</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); }} placeholder={c.searchService} />
        </label><button type="submit" className="franchise-tool">{locale==="ar"?"بحث":"Rechercher"}</button></form>
        {categories.length === 0 ? <p>{c.emptyCategories}</p> : (
          <ul className="franchise-tree">
            {categories.map((category) => (
              <li key={category.id}>
                <button type="button" className="franchise-tree-btn" data-selected={categoryId === category.id ? "true" : undefined} onClick={() => { navigate({category:categoryId===category.id?null:category.id}); }}>
                  {category.title}
                </button>
                <ul>
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <button type="button" className="franchise-tree-btn" data-selected={categoryId === child.id ? "true" : undefined} onClick={() => { navigate({category:categoryId===child.id?null:child.id}); }}>
                        {child.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <details className="franchise-builder" open={categories.length === 0}>
          <summary>{c.createCategory}</summary>
          <FranchiseCategoryCreateForm locale={locale} libraryId={libraryId} organizationId={organizationId} commandIdentity={commandIdentity} />
        </details>
        <details className="franchise-builder">
          <summary>{c.createSubcategory}</summary>
          <FranchiseSubcategoryCreateForm locale={locale} libraryId={libraryId} organizationId={organizationId} commandIdentity={commandIdentity} categories={categories} />
        </details>
      </article>
      <article className="client-card">
        <header className="client-priority-head">
          <h2>{c.filterServices}</h2>
          <button type="button" className="client-soft-link" onClick={() => { setQuery(""); navigate({q:null,status:null,language:null,completeness:null,validation:null,category:null}); }}>{c.resetFilters}</button>
        </header>
        <div className="franchise-filters">
          <label><span className="sr-only">{c.state}</span>
            <select value={status} onChange={(event) => { navigate({status:event.target.value}); }}>
              <option value="ALL">{c.allStatuses}</option>
              <option value="DRAFT">{c.drafts}</option>
              <option value="IN_REVIEW">{c.inReview}</option>
              <option value="PUBLISHED">{c.published}</option>
            </select>
          </label>
          <label><span className="sr-only">{c.language}</span>
            <select value={language} onChange={(event) => { navigate({language:event.target.value}); }}>
              <option value="ALL">{c.language}</option>
              <option value="FR">FR</option>
              <option value="AR">AR</option>
            </select>
          </label>
          <label><span className="sr-only">{c.completeness}</span>
            <select value={complete} onChange={(event) => { navigate({completeness:event.target.value}); }}>
              <option value="ALL">{c.completeness}</option>
              <option value="FULL">100%</option>
              <option value="PARTIAL">0–99%</option>
            </select>
          </label>
          <label><span className="sr-only">{c.validation}</span>
            <select value={validation} onChange={(event) => { navigate({validation:event.target.value}); }}>
              <option value="ALL">{c.validation}</option>
              <option value="DRAFT">{c.drafts}</option>
              <option value="REVIEW">{c.inReview}</option>
              <option value="PUBLISHED">{c.published}</option>
            </select>
          </label>
        </div>
        {rows.length === 0 ? <p>{c.emptyServices}</p> : (
          <div className="client-table-wrap client-compare">
            <table className="client-space-table">
                <thead>
                  <tr>
                    <th><span className="sr-only">{c.rowActions}</span></th>
                    <th>{c.serviceKind}</th>
                  <th>{c.category}</th>
                  <th>{c.subcategory}</th>
                  <th>{c.version}</th>
                  <th>{c.languages}</th>
                  <th>{c.completeness}</th>
                  <th>{c.state}</th>
                    <th>{c.next}</th>
                    <th><span className="sr-only">{c.rowActions}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((item) => (
                    <tr key={item.id} data-selected={selectedId === item.id ? "true" : undefined}>
                      <td><input type="checkbox" aria-label={item.title} /></td>
                      <td><Link href={item.href}><strong>{item.title}</strong></Link><div><KindChip kind={item.kind} locale={locale} /></div></td>
                    <td>{item.category ?? "—"}</td>
                    <td>{item.subcategory ?? "—"}</td>
                    <td>{item.versionLabel ?? "—"}</td>
                    <td><LanguageMarks item={item} /></td>
                    <td>
                      <span className="franchise-complete" aria-label={`${completeness(item)}%`}><span style={{ width: `${completeness(item)}%` }} /></span>
                      <small dir="ltr">{completeness(item)}%</small>
                    </td>
                    <td><StatusChip status={item.status} locale={locale} /></td>
                      <td><Link href={item.href}>{nextAction(item.status, locale)}</Link></td>
                      <td><FranchiseRowMenu href={item.href} label={item.title} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <nav className="franchise-pagination" aria-label={c.page}>
          <span>{serverPage?.groups.SERVICE.total??rows.length} · {safePage}/{pageCount}</span>
          {safePage>1?<button type="button" onClick={()=>navigate({page:String(safePage-1)})}>{locale==="ar"?"السابق":"Précédent"}</button>:null}
          {safePage<pageCount?<button type="button" onClick={()=>navigate({page:String(safePage+1)})}>{locale==="ar"?"التالي":"Suivant"}</button>:null}
        </nav>
        <p className="client-access-note">{c.clientsNote}</p>
      </article>
    </>
  );
}
