import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { buttonVariants } from "@/modules/shared/ui/button";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { applyDemoCatalogQuestionsWorkspace } from "@/modules/admin/data/spaces/demo-catalog-questions";
import { createServerRuleValidationRepository } from "@/modules/shared/lib/rule-validation/server-repository";
import { cn } from "@/modules/shared/lib/utils";
import { getRuleValidationMessages } from "@/modules/admin/screens/catalogue/validation/messages";
import { RuleValidationPanel } from "@/modules/admin/screens/catalogue/validation/rule-validation-panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminStep1Gate } from "@/modules/admin/ui/admin-step1-gate";

export const dynamic = "force-dynamic";

function queryValue(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function RuleValidationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const messages = getRuleValidationMessages(locale);
  const selectedVersionId = queryValue(query.questionnaire);
  const repository = await createServerRuleValidationRepository();
  const result = await repository.loadWorkspace(selectedVersionId);
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: `/${locale}/administration/catalogue/validation` }));
  const workspace = result.status === "success"
    ? applyDemoCatalogQuestionsWorkspace(result.value, selectedVersionId)
    : null;

  return (
    <AdminModulePage
      locale={locale}
      active="catalog"
      path="catalogue/validation"
      querySuffix={selectedVersionId ? `questionnaire=${encodeURIComponent(selectedVersionId)}` : undefined}
      title={messages.title}
      lead={messages.description}
    >
      <AdminStep1Gate locale={locale} current="validation" />
      {result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{result.reason === "FORBIDDEN" ? messages.forbiddenPage : messages.unavailable}</AlertTitle>
          <AlertDescription>
            <Link href={`/${locale}/administration/catalogue/validation`} className={cn(buttonVariants({ variant: "outline" }), "mt-3 min-h-11")}>{messages.retry}</Link>
          </AlertDescription>
        </Alert>
      ) : workspace ? (
        <RuleValidationPanel workspace={workspace} locale={locale} messages={messages} />
      ) : null}
    </AdminModulePage>
  );
}
