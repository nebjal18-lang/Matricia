import { ArrowRight, BookOpen, Search } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { Badge } from "@/modules/shared/ui/badge";
import { buttonVariants } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { encodeCatalogCursor, parseCatalogQuery } from "@/modules/shared/lib/catalogue/model";
import { listPublishedLibraries, searchPublishedCatalog } from "@/modules/shared/lib/catalogue/repository";
import { cn } from "@/modules/shared/lib/utils";
import { getCatalogMessages } from "./messages";

function queryHref(locale: string, librarySlug: string, releaseId: string, search: string, cursor?: string) {
  const params = new URLSearchParams({ bibliotheque: librarySlug, release: releaseId });
  if (search) params.set("q", search);
  if (cursor) params.set("cursor", cursor);
  return `/${locale}/catalogue?${params.toString()}`;
}

export default async function CatalogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ bibliotheque?: string | string[]; release?: string | string[]; q?: string | string[]; cursor?: string | string[] }>;
}) {
  const [{ locale }, rawQuery] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const query = parseCatalogQuery({ ...(rawQuery.release !== undefined && { releaseId: rawQuery.release }), ...(rawQuery.bibliotheque !== undefined && { librarySlug: rawQuery.bibliotheque }), ...(rawQuery.q !== undefined && { search: rawQuery.q }), ...(rawQuery.cursor !== undefined && { cursor: rawQuery.cursor }) });
  const libraryResult = await listPublishedLibraries(locale);
  if (libraryResult.status === "error" && libraryResult.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/catalogue` }));
  const copy = getCatalogMessages(locale);
  const alternate = locale === "fr" ? "ar" : "fr";

  if (libraryResult.status === "error") {
    return (
      <main className="min-h-dvh bg-muted/40 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Link href={`/${locale}/tableau-de-bord`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{copy.back}</Link>
          <Alert variant="destructive"><AlertTitle>{copy.loadErrorTitle}</AlertTitle><AlertDescription><p>{copy.loadErrorDescription}</p><Link href={`/${locale}/catalogue`} className={cn(buttonVariants({ variant: "outline" }), "mt-4 min-h-11")}>{copy.retry}</Link></AlertDescription></Alert>
        </div>
      </main>
    );
  }

  const selectedLibrary = query.librarySlug && query.releaseId
    ? libraryResult.libraries.find((library) => library.slug === query.librarySlug && library.releaseId === query.releaseId) ?? null
    : null;
  const searchResult = selectedLibrary
    ? query.cursorInvalid
      ? { status: "error" as const, reason: "INVALID_RESPONSE" as const }
      : await searchPublishedCatalog({ locale, releaseId: selectedLibrary.releaseId, search: query.search, cursor: query.cursor })
    : null;
  if (searchResult?.status === "error" && searchResult.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/catalogue` }));

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-4">
          <nav aria-label={copy.navigation} className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/${locale}/tableau-de-bord`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{copy.back}</Link>
            <Link href={`/${alternate}/catalogue${selectedLibrary ? `?bibliotheque=${encodeURIComponent(selectedLibrary.slug)}&release=${encodeURIComponent(selectedLibrary.releaseId)}` : ""}`} hrefLang={alternate} className="rounded-md px-3 py-2 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{copy.switchLanguage}</Link>
          </nav>
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{copy.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1><p className="mt-3 max-w-3xl leading-7 text-muted-foreground">{copy.description}</p></div>
        </header>

        <section aria-labelledby="libraries-heading" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="libraries-heading" className="text-2xl font-semibold">{copy.librariesTitle}</h2><p className="mt-1 text-muted-foreground">{copy.librariesDescription}</p></div><Badge variant="outline">{copy.libraryCount(libraryResult.libraries.length)}</Badge></div>
          {libraryResult.libraries.length === 0 ? (
            <Card><CardHeader><CardTitle>{copy.emptyLibrariesTitle}</CardTitle><CardDescription>{copy.emptyLibrariesDescription}</CardDescription></CardHeader></Card>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {libraryResult.libraries.map((library) => (
                <li key={library.id}>
                  <Card className={cn("h-full transition-shadow hover:shadow-md", selectedLibrary?.id === library.id && "border-primary shadow-md")}>
                    <CardHeader><div className="mb-2 flex items-center justify-between gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><BookOpen aria-hidden="true" className="size-5" /></span><Badge variant="secondary">{library.code}</Badge></div><h3 className="text-lg font-semibold">{library.name}</h3><CardDescription className="line-clamp-3">{library.description}</CardDescription></CardHeader>
                    <CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{copy.libraryContents(library.categoryCount, library.serviceCount)}</p><Link href={queryHref(locale, library.slug, library.releaseId, "")} aria-current={selectedLibrary?.id === library.id ? "page" : undefined} className={cn(buttonVariants({ variant: selectedLibrary?.id === library.id ? "default" : "outline" }), "min-h-11 w-full justify-between gap-2")}>{copy.explore}<ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" /></Link></CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(query.librarySlug || query.releaseId) && !selectedLibrary ? (
          <Alert><AlertTitle>{copy.libraryNotFoundTitle}</AlertTitle><AlertDescription>{copy.libraryNotFoundDescription}</AlertDescription></Alert>
        ) : null}
        {searchResult?.status === "error" ? (
          <Alert variant="destructive"><AlertTitle>{copy.loadErrorTitle}</AlertTitle><AlertDescription>{copy.loadErrorDescription}</AlertDescription></Alert>
        ) : searchResult?.status === "success" && !searchResult.page ? (
          <Alert><AlertTitle>{copy.libraryNotFoundTitle}</AlertTitle><AlertDescription>{copy.libraryNotFoundDescription}</AlertDescription></Alert>
        ) : searchResult?.status === "success" && searchResult.page ? (() => {
          const catalogPage = searchResult.page;
          return (
            <section aria-labelledby="selected-library-heading" className="space-y-6">
              <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-primary">{catalogPage.library.code}</p><h2 id="selected-library-heading" className="mt-1 text-2xl font-semibold">{catalogPage.library.name}</h2><p className="mt-2 max-w-3xl leading-7 text-muted-foreground">{catalogPage.library.description}</p></div><Badge>{copy.resultCount(catalogPage.total)}</Badge></div></div>
              <form action={`/${locale}/catalogue`} method="get" role="search" className="rounded-xl border bg-card p-4 shadow-sm">
                <input type="hidden" name="bibliotheque" value={catalogPage.library.slug} /><input type="hidden" name="release" value={catalogPage.library.releaseId} />
                <label htmlFor="catalog-search" className="block text-sm font-semibold">{copy.searchLabel}</label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search aria-hidden="true" className="pointer-events-none absolute start-3 top-3 size-5 text-muted-foreground" /><input id="catalog-search" name="q" type="search" defaultValue={query.search} maxLength={80} placeholder={copy.searchHint} className="min-h-11 w-full rounded-md border bg-background pe-3 ps-10 text-base shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div><button type="submit" className={cn(buttonVariants(), "min-h-11 sm:min-w-32")}>{copy.searchAction}</button>{query.search ? <Link href={queryHref(locale, catalogPage.library.slug, catalogPage.library.releaseId, "")} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{copy.clearSearch}</Link> : null}</div>
                {query.searchTooLong ? <p role="alert" className="mt-3 text-sm text-destructive">{copy.searchTooLong}</p> : null}
              </form>
              {catalogPage.library.serviceCount === 0 ? <Card><CardHeader><CardTitle>{copy.noPublishedServicesTitle}</CardTitle><CardDescription>{copy.noPublishedServicesDescription}</CardDescription></CardHeader></Card>
                : catalogPage.total === 0 ? <Card><CardHeader><CardTitle>{copy.noServicesTitle}</CardTitle><CardDescription>{copy.noServicesDescription}</CardDescription></CardHeader></Card>
                  : <div className="space-y-8">{catalogPage.categories.map((category) => <section key={category.id} aria-labelledby={`category-${category.id}`} className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{copy.categoryLabel}</p><h3 id={`category-${category.id}`} className="text-xl font-semibold">{category.name}</h3></div>{category.subcategories.map((subcategory) => <section key={subcategory.id} aria-labelledby={`subcategory-${subcategory.id}`} className="space-y-3"><h4 id={`subcategory-${subcategory.id}`} className="text-base font-semibold text-muted-foreground">{copy.subcategoryLabel} · {subcategory.name}</h4><ul className="grid gap-4 md:grid-cols-2">{subcategory.services.map((service) => <li key={service.id}><Card className="h-full"><CardHeader><div className="flex flex-wrap items-start justify-between gap-2"><h5 className="text-lg font-semibold">{service.name}</h5><Badge variant="outline" dir="ltr">{service.code}</Badge></div><CardDescription>{service.shortDescription}</CardDescription></CardHeader><CardContent><Link href={`/${locale}/catalogue/${catalogPage.library.slug}/${service.slug}?release=${encodeURIComponent(catalogPage.library.releaseId)}`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 w-full justify-between gap-2")}>{copy.serviceDetails}<ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" /></Link></CardContent></Card></li>)}</ul></section>)}</section>)}</div>}
              {catalogPage.hasMore && catalogPage.nextCursor ? <nav aria-label={copy.moreResults} className="flex justify-end border-t pt-5"><Link href={queryHref(locale, catalogPage.library.slug, catalogPage.library.releaseId, query.search, encodeCatalogCursor(catalogPage.nextCursor))} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 gap-2")}>{copy.next}<ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" /></Link></nav> : null}
            </section>
          );
        })() : null}
      </div>
    </main>
  );
}
