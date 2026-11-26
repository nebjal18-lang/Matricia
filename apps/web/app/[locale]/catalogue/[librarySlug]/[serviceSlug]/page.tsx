import { ArrowLeft, CheckCircle2, CircleMinus, Layers3 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { Badge } from "@/modules/shared/ui/badge";
import { buttonVariants } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/modules/shared/ui/card";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { parseCatalogQuery, serviceTypeLabel } from "@/modules/shared/lib/catalogue/model";
import { getPublishedCatalogService } from "@/modules/shared/lib/catalogue/repository";
import { cn } from "@/modules/shared/lib/utils";
import { getCatalogMessages } from "../../messages";

export default async function PublishedServicePage({ params, searchParams }: {
  params: Promise<{ locale: string; librarySlug: string; serviceSlug: string }>;
  searchParams: Promise<{ release?: string | string[] }>;
}) {
  const [{ locale, librarySlug, serviceSlug }, rawQuery] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const copy = getCatalogMessages(locale);
  const query = parseCatalogQuery({ ...(rawQuery.release !== undefined && { releaseId: rawQuery.release }), librarySlug });
  const result = query.releaseId
    ? await getPublishedCatalogService({ locale, releaseId: query.releaseId, librarySlug, serviceSlug })
    : { status: "success" as const, detail: null };
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/catalogue/${librarySlug}/${serviceSlug}` }));
  const alternate = locale === "fr" ? "ar" : "fr";

  if (result.status === "error") {
    return (
      <main className="min-h-dvh bg-muted/40 px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Link href={`/${locale}/catalogue`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 gap-2")}><ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />{copy.backToLibrary}</Link>
          <Alert variant="destructive"><AlertTitle>{copy.loadErrorTitle}</AlertTitle><AlertDescription>{copy.loadErrorDescription}</AlertDescription></Alert>
        </div>
      </main>
    );
  }

  const detail = result.detail;
  const service = detail?.service ?? null;
  const attributes = service ? [
    [copy.creditEligible, service.creditEligible],
    [copy.volumeEligible, service.volumeEligible],
    [copy.recurringEligible, service.recurringEligible],
    [copy.trialEligible, service.trialEligible],
    [copy.rfqRequired, service.rfqRequired],
  ] as const : [];

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl space-y-7">
        <nav aria-label={copy.navigation} className="flex flex-wrap items-center justify-between gap-3">
          <Link href={detail ? `/${locale}/catalogue?bibliotheque=${encodeURIComponent(detail.library.slug)}&release=${encodeURIComponent(detail.library.releaseId)}` : `/${locale}/catalogue`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11 gap-2")}><ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />{copy.backToLibrary}</Link>
          <Link href={`/${alternate}/catalogue/${encodeURIComponent(librarySlug)}/${encodeURIComponent(serviceSlug)}${query.releaseId ? `?release=${encodeURIComponent(query.releaseId)}` : ""}`} hrefLang={alternate} className="rounded-md px-3 py-2 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{copy.switchLanguage}</Link>
        </nav>
        {!service || !detail ? (
          <Alert><AlertTitle>{copy.detailNotFoundTitle}</AlertTitle><AlertDescription>{copy.detailNotFoundDescription}</AlertDescription></Alert>
        ) : (
          <article className="space-y-6" aria-labelledby="service-title">
            <Card className="overflow-hidden shadow-lg">
              <CardHeader className="border-b bg-card p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-primary"><Layers3 aria-hidden="true" className="size-4" /><span>{detail.library.name}</span><span aria-hidden="true">/</span><span>{detail.categoryName}</span><span aria-hidden="true">/</span><span>{detail.subcategoryName}</span></div>
                    <h1 id="service-title" className="break-words text-2xl font-semibold sm:text-3xl">{service.name}</h1>
                    <CardDescription className="max-w-3xl text-base leading-7">{service.shortDescription}</CardDescription>
                  </div>
                  <Badge variant="outline" dir="ltr" className="shrink-0">{service.code}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-7 p-5 sm:p-7">
                <p className="whitespace-pre-line break-words leading-7">{service.longDescription}</p>
                <dl className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                  <div><dt className="text-sm text-muted-foreground">{copy.serviceCode}</dt><dd className="mt-1 font-semibold" dir="ltr">{service.code}</dd></div>
                  <div><dt className="text-sm text-muted-foreground">{copy.serviceType}</dt><dd className="mt-1 break-words font-semibold">{serviceTypeLabel(service.serviceType, locale)}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-sm text-muted-foreground">{copy.unit}</dt><dd className="mt-1 break-words font-semibold">{service.unitLabel}</dd></div>
                </dl>
                <section aria-labelledby="service-characteristics" className="space-y-3">
                  <h2 id="service-characteristics" className="text-lg font-semibold">{copy.characteristics}</h2>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {attributes.map(([label, enabled]) => (
                      <li key={label} className="flex min-h-12 items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                        <span>{label}</span><span className={cn("flex shrink-0 items-center gap-1 font-semibold", enabled ? "text-emerald-700" : "text-muted-foreground")}>{enabled ? <CheckCircle2 aria-hidden="true" className="size-4" /> : <CircleMinus aria-hidden="true" className="size-4" />}{enabled ? copy.yes : copy.no}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </CardContent>
            </Card>
          </article>
        )}
      </div>
    </main>
  );
}
