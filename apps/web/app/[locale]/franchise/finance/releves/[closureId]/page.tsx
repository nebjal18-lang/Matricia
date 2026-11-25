import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FranchiseAccessPage } from "@/modules/franchise/ui/franchise-access-page";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { statementExport } from "@/modules/franchise/data/documents/model";
import { formatMinor } from "@/modules/franchise/data/governance/model";
import { franchiseMandateName, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; closureId: string }>;
  searchParams: Promise<{ franchiseId?: string; organizationId?: string }>;
}) {
  const [{ locale, closureId }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale) || !z.string().uuid().safeParse(closureId).success) notFound();
  const { space, result: library } = await requireFranchiseLibrary({
    returnPath: `/${locale}/franchise/finance/releves/${closureId}`,
    returnQuery: query,
    locale,
    organizationId: query.organizationId,
    franchiseId: query.franchiseId,
  });
  if (library.status === "error") {
    return (
      <FranchiseAccessPage locale={locale} space={space} reason={library.reason} active="finance" returnPath={space.currentPath} />
    );
  }
  const franchiseId = query.franchiseId ?? library.workspace.mandate.franchiseId;
  if (!z.string().uuid().safeParse(franchiseId).success) notFound();
  const client = await getSupabaseServerClient();
  const response = await client.rpc("franchise_statement_export", {
    p_franchise_id: franchiseId,
    p_closure_id: closureId,
    p_format: "VIEW",
  });
  const parsed = statementExport.safeParse(response.data);
  const ar = locale === "ar";
  const c = franchiseCopy(locale);
  const suffix = `${space.selectedQuery || `?franchiseId=${franchiseId}${query.organizationId ? `&organizationId=${encodeURIComponent(query.organizationId)}` : ""}`}`;
  return (
    <FranchiseAppShell
      languagePath={space.currentPath}
      locale={locale}
      selectedQuery={space.selectedQuery}
      mandates={space.mandates}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="finance"
      title={ar ? "كشف حصة صاحب الامتياز" : "Relevé de la part franchisé"}
      lead={c.finLead}
      kicker={c.kicker}
      mandateName={franchiseMandateName(library)}
    >
      <main className="client-page" dir={ar ? "rtl" : "ltr"}>
        {response.error || !parsed.success ? (
          <p role="alert">
            {ar ? "هذا الكشف غير متاح أو أن صلاحية الوصول انتهت." : "Ce relevé est indisponible ou votre autorisation a expiré."}
          </p>
        ) : (
          <article className="client-card space-y-4">
            <h1>
              {ar ? "كشف حصة صاحب الامتياز" : "Relevé de la part franchisé"} · v{parsed.data.version}
            </h1>
            <p>
              {parsed.data.periodStart} — {parsed.data.periodEnd}
            </p>
            <dl>
              <dt>{ar ? "الإيرادات دون ضرائب" : "Recettes hors taxes"}</dt>
              <dd>{formatMinor(parsed.data.revenueMinor, parsed.data.currency, locale)}</dd>
              <dt>{ar ? "التكاليف والمبالغ المسترجعة" : "Coûts et remboursements"}</dt>
              <dd>{formatMinor(parsed.data.costsMinor, parsed.data.currency, locale)}</dd>
              <dt>{ar ? "الربح القابل للتوزيع" : "Bénéfice distribuable"}</dt>
              <dd>{formatMinor(parsed.data.profitMinor, parsed.data.currency, locale)}</dd>
              <dt>{ar ? "حصتكم" : "Votre part"}</dt>
              <dd>{formatMinor(parsed.data.shareMinor, parsed.data.currency, locale)}</dd>
              <dt>SHA-256</dt>
              <dd className="break-all font-mono" dir="ltr">
                {parsed.data.contentHash}
              </dd>
              <dt>{ar ? "نسخة القاعدة" : "Version de la règle"}</dt>
              <dd dir="ltr">{parsed.data.ruleVersionId}</dd>
              <dt>{ar ? "وقت إقفال الإدخالات" : "Limite des écritures"}</dt>
              <dd>{parsed.data.cutoffAt}</dd>
            </dl>
            <a
              className="franchise-tool franchise-tool-primary"
              href={`/${locale}/franchise/finance/releves/${closureId}/export${suffix}`}
            >
              {ar ? "تصدير CSV بوحدات نقدية دقيقة" : "Exporter en CSV avec montants exacts"}
            </a>
            <h2>{ar ? "مراجع الإثبات" : "Références des preuves"}</h2>
            <ul>
              {parsed.data.proofs.map((proof, index) => (
                <li key={index}>
                  {proof.referenceType} · {proof.referenceId} · <bdi dir="ltr">{proof.proofHash ?? "—"}</bdi>
                </li>
              ))}
            </ul>
            <h2>{ar ? "آخر عمليات الوصول" : "Derniers accès"}</h2>
            <ul>
              {parsed.data.accessHistory.map((event, index) => (
                <li key={index}>
                  <time dateTime={event.at}>{event.at}</time> · {event.action} · {event.outcome}
                </li>
              ))}
            </ul>
          </article>
        )}
        <Link className="franchise-tool" href={`/${locale}/franchise/finance${suffix}`}>
          {ar ? "العودة إلى المالية" : "Retour aux finances"}
        </Link>
      </main>
    </FranchiseAppShell>
  );
}
