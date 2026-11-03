import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { buttonVariants } from "@/modules/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Label } from "@/modules/shared/ui/label";
import { createServerCatalogBuilderRepository } from "@/modules/shared/lib/catalogue-builder/server-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { cn } from "@/modules/shared/lib/utils";
import { getBuilderMessages } from "@/modules/admin/screens/catalogue/messages";
import { ReleaseWorkflow } from "@/modules/admin/screens/catalogue/release-workflow";
import { QuestionBuilder } from "@/modules/admin/screens/catalogue/question-builder";
import { RuleBuilder } from "@/modules/admin/screens/catalogue/rule-builder";
import { QuestionnaireBuilder } from "@/modules/admin/screens/catalogue/questionnaire-builder";
import { getRuleValidationMessages } from "@/modules/admin/screens/catalogue/validation/messages";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminHubStrip } from "@/modules/admin/screens/spaces/boards";
import { adminCopy } from "@/modules/admin/data/spaces/copy";

export const dynamic = "force-dynamic";

function queryValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function CatalogueReleaseAdministrationPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const libraryId = queryValue(query.library);
  const selectedServiceId = queryValue(query.service);
  const context = new URLSearchParams();
  for (const key of ["organizationId", "library", "service"] as const) {
    const value = queryValue(query[key]);
    if (value) context.set(key, value);
  }
  const contextQuery = context.size ? `?${context.toString()}` : "";
  const catalogueHref = `/${locale}/administration/catalogue${contextQuery}`;
  const repository = await createServerCatalogBuilderRepository();
  const result = await repository.loadWorkspace(libraryId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: catalogueHref }));
  const messages = getBuilderMessages(locale);
  const validationMessages = getRuleValidationMessages(locale);
  const c = adminCopy(locale);

  const selectedLibrary = result.status === "success" ? result.value.libraries.find((item) => item.id === libraryId) : undefined;
  const selectedService = result.status === "success" ? result.value.services.find((item) => item.id === selectedServiceId) : undefined;

  return (
    <AdminModulePage locale={locale} active="catalog" path="catalogue" title={messages.title} lead={c.hubCatalogLead} querySuffix={context.toString()}>
      <Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/administration/catalogue/calendrier${libraryId ? `?${new URLSearchParams({ library: libraryId })}` : ""}`}>{locale === "ar" ? "جدول النشر" : "Calendrier des publications"}</Link>
      <div className="client-page admin-hub-wrap"><AdminHubStrip locale={locale} query={contextQuery} groupId="catalog" /></div>
      <p>
        <Link href={`/${locale}/administration/catalogue/validation${contextQuery}`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>{validationMessages.title}</Link>
      </p>
      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{messages.unavailable}</AlertTitle>
          <AlertDescription><a href={catalogueHref} className={cn(buttonVariants({ variant: "outline" }), "mt-2 min-h-11")}>{messages.retry}</a></AlertDescription>
        </Alert>
      ) : (
        <>
          <Card id="domaines" className="scroll-mt-24">
            <CardHeader><CardTitle><h2>{messages.selection}</h2></CardTitle></CardHeader>
            <CardContent>
              {result.value.libraries.length === 0 ? <p className="text-sm text-muted-foreground">{messages.noLibraries}</p> : (
                <form method="get" className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  {queryValue(query.organizationId) ? <input type="hidden" name="organizationId" value={queryValue(query.organizationId)!} /> : null}
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="catalogue-library">{messages.library}</Label>
                    <select id="catalogue-library" name="library" defaultValue={libraryId ?? ""} dir={libraryId ? "ltr" : locale === "ar" ? "rtl" : "ltr"} required className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="" dir={locale === "ar" ? "rtl" : "ltr"}>{messages.chooseLibrary}</option>
                      {result.value.libraries.map((library) => <option key={library.id} value={library.id} dir="ltr">{library.code}</option>)}
                    </select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="catalogue-service">{messages.service}</Label>
                    <select id="catalogue-service" name="service" defaultValue={selectedService?.id ?? ""} dir={selectedService ? "ltr" : locale === "ar" ? "rtl" : "ltr"} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="" dir={locale === "ar" ? "rtl" : "ltr"}>{selectedLibrary ? messages.chooseService : messages.chooseLibrary}</option>
                      {result.value.services.map((service) => <option key={service.id} value={service.id} dir="ltr">{service.code}</option>)}
                    </select>
                  </div>
                  <button type="submit" className={cn(buttonVariants(), "min-h-11 w-full md:w-auto")}>{messages.open}</button>
                </form>
              )}
              {selectedLibrary && result.value.services.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{messages.noServices}</p> : null}
            </CardContent>
          </Card>

          {selectedLibrary && selectedService ? <>
            <div id="questionnaires" className="scroll-mt-24">
              <QuestionnaireBuilder locale={locale} library={selectedLibrary} messages={messages} commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }} />
            </div>
            <div id="questions" className="scroll-mt-24">
              <QuestionBuilder locale={locale} library={selectedLibrary} service={selectedService} messages={messages} commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }} />
            </div>
            <RuleBuilder locale={locale} library={selectedLibrary} messages={messages} commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }} />
            <ReleaseWorkflow locale={locale} library={selectedLibrary} service={selectedService} draftReleases={result.value.draftReleases} approvedVersions={result.value.approvedServiceVersions.filter((item) => item.serviceId === selectedService.id)} messages={messages} commandIdentities={{
              create: { idempotencyKey: randomUUID(), correlationId: randomUUID() },
              add: { idempotencyKey: randomUUID(), correlationId: randomUUID() },
              submit: { idempotencyKey: randomUUID(), correlationId: randomUUID() },
            }} />
          </> : null}
        </>
      )}
    </AdminModulePage>
  );
}
