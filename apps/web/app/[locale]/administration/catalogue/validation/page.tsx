import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { Alert, AlertDescription, AlertTitle } from "@/modules/shared/ui/alert";
import { buttonVariants } from "@/modules/shared/ui/button";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { resolveDemoCatalogQuestionsWorkspace } from "@/modules/admin/data/spaces/demo-catalog-questions";
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
  const retryHref = selectedVersionId
    ? `/${locale}/administration/catalogue/validation?questionnaire=${encodeURIComponent(selectedVersionId)}`
    : `/${locale}/administration/catalogue/validation`;
  if (result.status === "error" && result.reason === "UNAUTHENTICATED") redirect(connexionHref(locale, { next: retryHref }));
  const resolved = resolveDemoCatalogQuestionsWorkspace(
    result.status === "success"
      ? { status: "success", value: result.value }
      : { status: "error", reason: result.reason },
  );

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
      {resolved?.demoFallback ? (
        <Alert className="mb-4">
          <AlertTitle>{locale === "ar" ? "عرض بيانات تجريبية" : "Données de démonstration"}</AlertTitle>
          <AlertDescription>
            {locale === "ar"
              ? "تعذر تحميل إصدارات الاستبيان الأصلية. تُعرض نسخة تجريبية للقراءة والمحاكاة دون أثر حقيقي."
              : "Les versions de questionnaire natives n’ont pas pu être chargées. Une version de démonstration est affichée pour lecture et simulation sans effet réel."}
          </AlertDescription>
        </Alert>
      ) : null}
      {!resolved && result.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{result.reason === "FORBIDDEN" ? messages.forbiddenPage : messages.unavailable}</AlertTitle>
          <AlertDescription>
            <Link href={retryHref} className={cn(buttonVariants({ variant: "outline" }), "mt-3 min-h-11")}>{messages.retry}</Link>
          </AlertDescription>
        </Alert>
      ) : resolved ? (
        <RuleValidationPanel workspace={resolved.workspace} locale={locale} messages={messages} />
      ) : null}
    </AdminModulePage>
  );
}
