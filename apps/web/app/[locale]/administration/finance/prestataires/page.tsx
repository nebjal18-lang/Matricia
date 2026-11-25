import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { loadMyPlatformAccess, hasPlatformRole, mfaRequiredMessage } from "@/modules/shared/lib/account-security/platform-access";
import { loadBillingWorkspace } from "@/modules/provider/data/billing/workspace";
import { ProviderBillingWorkspace } from "@/modules/provider/screens/facturation/workspace-panel";
import { FinanceDecisionForm } from "@/modules/provider/screens/facturation/workflow-form";
import { FinanceAllocationForm } from "@/modules/provider/screens/facturation/finance-allocation-form";
import { ContextUnlockForm } from "@/modules/shared/ui/context-unlock-nav";
import { AdminStep11Gate } from "@/modules/admin/ui/admin-step11-gate";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";

const uuid = z.string().uuid();
const context = z.object({
  organizations: z.array(z.object({ id: uuid, name: z.string() })),
  accounts: z.array(z.object({ id: uuid, code: z.string(), currency: z.string(), type: z.string() })),
  policies: z.array(
    z.object({
      id: uuid,
      currency: z.string(),
      due_days: z.number(),
      dispute_days: z.number(),
      reference: z.string(),
      created_by: uuid,
      decision: z.boolean().nullable(),
    }),
  ),
  payments: z.array(z.object({ id: uuid, reference: z.string(), currency: z.string(), amount_minor: z.string() })),
  invoices: z.array(
    z.object({ id: uuid, number: z.string(), currency: z.string(), outstanding_minor: z.string(), payment_status: z.string() }),
  ),
});

export default async function ProviderFinanceAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const [{ locale }, q] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const tr = (fr: string, arabic: string) => (ar ? arabic : fr);
  const access = await loadMyPlatformAccess();
  if (access.status === "error") {
    if (access.reason === "UNAUTHENTICATED") {
      redirect(connexionHref(locale, { next: `/${locale}/administration/finance/prestataires` }));
    }
    return <p role="alert">{tr("Lecture des droits indisponible.", "تعذرت قراءة الصلاحيات.")}</p>;
  }
  if (!hasPlatformRole(access.roles, ["SUPER_ADMIN", "MATRICIA_ADMIN", "FINANCE_MANAGER"])) {
    return <p role="alert">{tr("Accès réservé à l’administration financière (SUPER_ADMIN, MATRICIA_ADMIN ou FINANCE_MANAGER).", "الوصول مخصّص للإدارة المالية (SUPER_ADMIN أو MATRICIA_ADMIN أو FINANCE_MANAGER).")}</p>;
  }
  if (!access.requirementSatisfied) {
    return <p role="alert">{mfaRequiredMessage(locale)}</p>;
  }

  const org = q.organizationId && uuid.safeParse(q.organizationId).success ? q.organizationId : undefined;
  const r = await access.client.rpc("get_provider_finance_admin_context_v1", { p_org: org ?? null });
  const parsed = context.safeParse(r.data);
  if (r.error || !parsed.success) {
    return <p role="alert">{tr("Dossiers financiers indisponibles.", "الملفات المالية غير متاحة.")}</p>;
  }
  const c = parsed.data;
  const workspace = org ? await loadBillingWorkspace(org) : null;
  const account = (name: string, label: string, type: string) => (
    <label>
      {label}
      <select required name={name} className="min-h-11 w-full rounded border p-2">
        <option value="">—</option>
        {c.accounts
          .filter((row) => row.type === type)
          .map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.currency}
            </option>
          ))}
      </select>
    </label>
  );

  return (
    <AdminModulePage
      locale={locale}
      active="finance"
      path="finance/prestataires"
      querySuffix={org ? `organizationId=${org}` : undefined}
      title={tr("Finances des prestataires", "مالية مقدمي الخدمات")}
      lead={tr(
        "Déclarations, validation indépendante, contestations et clôture automatisée. Une configuration proposée reste inactive jusqu’à la décision d’un autre responsable Finance avec second facteur.",
        "التصريحات والتحقق المستقل والاعتراضات والإغلاق الآلي. يبقى الإعداد المقترح غير نشط إلى أن يقرره مسؤول مالي مستقل بالعامل الثاني.",
      )}
      hubGroup="finance"
      hubMode="strip"
    >
      <div className="client-page space-y-6">
      {org ? (
        <>
        <details className="client-card p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">{tr("Changer de prestataire", "تغيير مقدّم الخدمة")}</summary>
          <div className="mt-4 space-y-4">
            <AdminStep11Gate locale={locale} query={`?organizationId=${org}`} current="prestataires" />
            <ContextUnlockForm
              locale={locale}
              selectedId={org}
              options={c.organizations.map((row) => ({ id: row.id, label: row.name }))}
              landHash="#allocation"
              labels={{
                field: tr("Prestataire", "مقدم الخدمة"),
                choose: tr("Choisir un prestataire", "اختيار مقدّم خدمة"),
                submit: tr("Ouvrir le dossier", "فتح الملف"),
                pending: tr("Ouverture…", "جارٍ الفتح…"),
                ready: tr("Prestataire confirmé.", "تم تأكيد مقدّم الخدمة."),
                go: tr("Aller à l’allocation", "الانتقال إلى التخصيص"),
              }}
            />
          </div>
        </details>
          <section id="allocation" className="scroll-mt-24 space-y-4">
            <div className="admin-section-head">
              <div>
                <h2>{tr("Allouer les paiements aux factures", "تخصيص المدفوعات للفواتير")}</h2>
                <p>
                  {tr(
                    "Affectez un paiement reçu à une facture ouverte.",
                    "اربطوا دفعة مستلمة بفاتورة مفتوحة.",
                  )}
                </p>
              </div>
            </div>
            <FinanceAllocationForm locale={locale} payments={c.payments} invoices={c.invoices} />
            <details className="client-card p-4">
              <summary className="min-h-11 cursor-pointer font-semibold">{tr("Configuration de clôture gouvernée", "إعداد الإغلاق الخاضع للموافقة")}</summary>
            <section className="mt-4 space-y-3">
              {c.policies.map((policy) => (
                <article key={policy.id} className="rounded border p-3">
                  <p>
                    {policy.currency} · {policy.due_days} {tr("jours pour payer", "يوماً للدفع")} · {policy.dispute_days}{" "}
                    {tr("jours pour contester", "يوماً للاعتراض")} · {policy.reference}
                  </p>
                  {policy.decision === null && policy.created_by !== access.userId ? (
                    <FinanceDecisionForm locale={locale} operation="policyDecision" id={policy.id} choices />
                  ) : (
                    <p>
                      {policy.decision === true
                        ? tr("Approuvée", "معتمدة")
                        : policy.decision === false
                          ? tr("Refusée", "مرفوضة")
                          : tr("Autre responsable Finance requis", "يلزم مسؤول مالي آخر")}
                    </p>
                  )}
                </article>
              ))}
              <FinanceDecisionForm locale={locale} operation="policy">
                <input type="hidden" name="org" value={org} />
                {(
                  [
                    ["currency", tr("Devise ISO", "رمز العملة ISO"), "text"],
                    ["dueDays", tr("Délai de paiement en jours (standard : 7)", "مهلة الدفع بالأيام (المعيار: 7)"), "number"],
                    ["disputeDays", tr("Fenêtre contradictoire en jours", "مهلة الاعتراض بالأيام"), "number"],
                    ["effectiveFrom", tr("Applicable à partir du", "يسري من"), "date"],
                    ["reference", tr("Référence de la règle contractuelle approuvée", "مرجع القاعدة التعاقدية المعتمدة"), "text"],
                  ] as const
                ).map(([name, label, type]) => (
                  <label key={name}>
                    {label}
                    <input className="min-h-11 w-full rounded border p-2" required name={name} type={type} />
                  </label>
                ))}
                {account("receivable", tr("Compte de créance", "حساب الذمم المدينة"), "ASSET")}
                {account("revenue", tr("Compte de produit", "حساب الإيراد"), "REVENUE")}
                {account("tax", tr("Compte de TVA", "حساب الضريبة"), "LIABILITY")}
              </FinanceDecisionForm>
            </section>
            </details>
          </section>

          <details id="dossier" className="client-card scroll-mt-24 p-4">
            <summary className="min-h-11 cursor-pointer font-semibold">{tr("3. Dossier prestataire", "3. ملف مقدّم الخدمة")}</summary>
            <div className="mt-4 space-y-3">
            {workspace ? (
              <ProviderBillingWorkspace value={workspace} locale={locale} organizationId={org} admin />
            ) : (
              <p role="alert">{tr("Lecture du dossier indisponible.", "قراءة الملف غير متاحة.")}</p>
            )}
            </div>
          </details>
        </>
      ) : (
        <>
          <AdminStep11Gate locale={locale} current="prestataires" />
          <section className="admin-panel space-y-3" aria-labelledby="provider-finance-context">
            <h2 id="provider-finance-context">{tr("1. Choisir le prestataire", "1. اختيار مقدّم الخدمة")}</h2>
            <p className="text-sm text-muted-foreground">{tr("Confirmez le prestataire pour ouvrir l’allocation.", "أكّدوا مقدّم الخدمة لفتح التخصيص.")}</p>
            <ContextUnlockForm
              locale={locale}
              selectedId={org}
              options={c.organizations.map((row) => ({ id: row.id, label: row.name }))}
              landHash="#allocation"
              labels={{
                field: tr("Prestataire", "مقدم الخدمة"),
                choose: tr("Choisir un prestataire", "اختيار مقدّم خدمة"),
                submit: tr("Ouvrir le dossier", "فتح الملف"),
                pending: tr("Ouverture…", "جارٍ الفتح…"),
                ready: tr("Prestataire confirmé.", "تم تأكيد مقدّم الخدمة."),
                go: tr("Aller à l’allocation", "الانتقال إلى التخصيص"),
              }}
            />
          </section>
        </>
      )}
      </div>
    </AdminModulePage>
  );
}
