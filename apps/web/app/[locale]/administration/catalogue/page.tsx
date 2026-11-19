import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { buttonVariants } from "@/modules/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { presentCatalogEntityLabel } from "@/modules/shared/lib/catalogue-builder/model";
import { createServerCatalogBuilderRepository } from "@/modules/shared/lib/catalogue-builder/server-repository";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { cn } from "@/modules/shared/lib/utils";
import { getBuilderMessages } from "@/modules/shared/catalogue-builders/messages";
import { CatalogueContextForm } from "@/modules/admin/screens/catalogue/catalogue-context-form";
import { CatalogContextRequired } from "@/modules/admin/screens/catalogue/catalog-context-required";
import { ReleaseWorkflow } from "@/modules/admin/screens/catalogue/release-workflow";
import { QuestionBuilder } from "@/modules/shared/catalogue-builders/question-builder";
import { QuestionnaireBuilder } from "@/modules/shared/catalogue-builders/questionnaire-builder";
import { RuleBuilder } from "@/modules/shared/catalogue-builders/rule-builder";
import { getRuleValidationMessages } from "@/modules/admin/screens/catalogue/validation/messages";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminStep1Gate } from "@/modules/admin/ui/admin-step1-gate";
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
  const ready = Boolean(selectedLibrary && selectedService);

  return (
    <AdminModulePage
      locale={locale}
      active="catalog"
      path="catalogue"
      title={c.catalogWorkspaceTitle}
      lead={c.hubCatalogLead}
      querySuffix={context.toString()}
      hubGroup="catalog"
      hubMode="strip"
    >
      <details className="client-card mb-4 p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">{locale === "ar" ? "الخطوة 1 — تجهيز المنصة" : "Étape 1 — préparer la plateforme"}</summary>
        <div className="mt-4">
          <AdminStep1Gate locale={locale} query={contextQuery} current="catalogue" />
        </div>
      </details>
      <nav className="client-tabs mb-2" aria-label={locale === "ar" ? "خطوات الدليل" : "Étapes catalogue"}>
        <a href={`${catalogueHref}#domaines`}>{locale === "ar" ? "1. السياق" : "1. Contexte"}</a>
        <a href={`${catalogueHref}#questions`}>{locale === "ar" ? "2. التركيب" : "2. Composer"}</a>
        <Link href={`/${locale}/administration/catalogue/validation${contextQuery}`}>{locale === "ar" ? "3. القواعد والتحقق" : "3. Règles & validation"}</Link>
        <Link href={`/${locale}/administration/catalogue/revues${contextQuery}`}>{locale === "ar" ? "4. المراجعات" : "4. Revues"}</Link>
        <Link href={`/${locale}/administration/catalogue/publications${contextQuery}`}>{locale === "ar" ? "5. النشر" : "5. Publier"}</Link>
      </nav>
      <div className="mb-4 flex flex-wrap gap-3">
        <Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/administration/catalogue/calendrier${libraryId ? `?${new URLSearchParams({ library: libraryId })}` : ""}`}>
          {locale === "ar" ? "جدول النشر" : "Calendrier des publications"}
        </Link>
        <Link href={`/${locale}/administration/catalogue/validation${contextQuery}`} className={cn(buttonVariants({ variant: "outline" }), "min-h-11")}>
          {validationMessages.title}
        </Link>
      </div>

      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{messages.unavailable}</AlertTitle>
          <AlertDescription><a href={catalogueHref} className={cn(buttonVariants({ variant: "outline" }), "mt-2 min-h-11")}>{messages.retry}</a></AlertDescription>
        </Alert>
      ) : (
        <>
          {ready && selectedLibrary && selectedService ? (
            <details id="domaines" className="client-card scroll-mt-24 p-4">
              <summary className="min-h-11 cursor-pointer font-semibold">
                {presentCatalogEntityLabel(locale, selectedLibrary)} · {presentCatalogEntityLabel(locale, selectedService)}
              </summary>
              <div className="mt-4">
                <CatalogueContextForm
                  locale={locale}
                  organizationId={queryValue(query.organizationId)}
                  libraryId={selectedLibrary.id}
                  serviceId={selectedService.id}
                  libraries={result.value.libraries.map((library) => ({
                    id: library.id,
                    label: presentCatalogEntityLabel(locale, library),
                  }))}
                  services={result.value.services.map((service) => ({
                    id: service.id,
                    label: presentCatalogEntityLabel(locale, service),
                  }))}
                  labels={{
                    library: messages.library,
                    service: messages.service,
                    chooseLibrary: messages.chooseLibrary,
                    chooseService: messages.chooseService,
                    chooseServiceFirst: messages.chooseServiceFirst,
                    open: messages.open,
                  }}
                />
              </div>
            </details>
          ) : (
          <Card id="domaines" className="scroll-mt-24 data-[catalog-focus=true]:ring-2 data-[catalog-focus=true]:ring-ring">
            <CardHeader>
              <CardTitle><h2>{messages.selection}</h2></CardTitle>
              <p className="text-sm text-muted-foreground">{c.catalogSelectContext}</p>
            </CardHeader>
            <CardContent>
              {result.value.libraries.length === 0 ? <p className="text-sm text-muted-foreground">{messages.noLibraries}</p> : (
                <CatalogueContextForm
                  locale={locale}
                  organizationId={queryValue(query.organizationId)}
                  libraryId={selectedLibrary?.id ?? null}
                  serviceId={selectedService?.id ?? null}
                  libraries={result.value.libraries.map((library) => ({
                    id: library.id,
                    label: presentCatalogEntityLabel(locale, library),
                  }))}
                  services={result.value.services.map((service) => ({
                    id: service.id,
                    label: presentCatalogEntityLabel(locale, service),
                  }))}
                  labels={{
                    library: messages.library,
                    service: messages.service,
                    chooseLibrary: messages.chooseLibrary,
                    chooseService: messages.chooseService,
                    chooseServiceFirst: messages.chooseServiceFirst,
                    open: messages.open,
                  }}
                />
              )}
              {selectedLibrary && result.value.services.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{messages.noServices}</p> : null}
            </CardContent>
          </Card>
          )}
          {ready && selectedLibrary && selectedService ? (
            <>
              <details id="questionnaires" className="client-card scroll-mt-24 space-y-4 p-4">
                <summary className="min-h-11 cursor-pointer font-semibold">{locale === "ar" ? "الاستبيانات" : "Questionnaires"}</summary>
                <QuestionnaireBuilder locale={locale} library={selectedLibrary} messages={messages} commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }} />
              </details>
              <details id="questions" className="client-card scroll-mt-24 space-y-4 p-4" open>
                <summary className="min-h-11 cursor-pointer font-semibold">{c.catalogComposeTitle}</summary>
                <QuestionBuilder locale={locale} library={selectedLibrary} service={selectedService} messages={messages} commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }} />
              </details>
              <details id="regles" className="client-card scroll-mt-24 space-y-4 p-4">
                <summary className="min-h-11 cursor-pointer font-semibold">{locale === "ar" ? "القواعد" : "Règles"}</summary>
                <RuleBuilder locale={locale} library={selectedLibrary} messages={messages} commandIdentity={{ idempotencyKey: randomUUID(), correlationId: randomUUID() }} />
              </details>
              <details id="publications" className="client-card scroll-mt-24 space-y-4 p-4">
                <summary className="min-h-11 cursor-pointer font-semibold">{locale === "ar" ? "النشر" : "Publication"}</summary>
                <ReleaseWorkflow
                  locale={locale}
                  library={selectedLibrary}
                  service={selectedService}
                  draftReleases={result.value.draftReleases}
                  approvedVersions={result.value.approvedServiceVersions.filter((item) => item.serviceId === selectedService.id)}
                  messages={messages}
                  commandIdentities={{
                    create: { idempotencyKey: randomUUID(), correlationId: randomUUID() },
                    add: { idempotencyKey: randomUUID(), correlationId: randomUUID() },
                    submit: { idempotencyKey: randomUUID(), correlationId: randomUUID() },
                  }}
                />
              </details>
            </>
          ) : (
            <div id="questions" className="scroll-mt-24">
              <CatalogContextRequired
                title={c.catalogComposeTitle}
                needContext={selectedLibrary ? c.catalogNeedService : c.catalogNeedContext}
                goContext={selectedLibrary ? c.catalogGoService : c.catalogGoContext}
                missing={selectedLibrary ? "service" : "library"}
              />
            </div>
          )}
        </>
      )}
    </AdminModulePage>
  );
}
