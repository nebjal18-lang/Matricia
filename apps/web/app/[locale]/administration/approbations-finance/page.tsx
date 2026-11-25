import { notFound, redirect } from "next/navigation";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { FinanceApprovalPanel } from "@/modules/admin/screens/approbations-finance/panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminStep11Gate } from "@/modules/admin/ui/admin-step11-gate";

const id = z.string().uuid();
const request = z.object({ id, status: z.string(), row_version: z.number().int().positive(), resource_type: z.string(), resource_id: z.string() });
const forecast = z.object({ id, mission_id: id, estimated_commission_minor: z.union([z.number(), z.string()]).transform(String), currency: z.string() });
const campaign = z.object({ id, title_fr: z.string(), title_ar: z.string(), row_version: z.number().int().positive() });
const mission = z.object({ id });
const payable = z.object({ id, mission_id: id, commission_amount_minor: z.union([z.number(), z.string()]).transform(String), currency: z.string() });

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = await getSupabaseServerClient();
  const { data: auth } = await c.auth.getUser();
  if (!auth.user) redirect(connexionHref(locale, { next: `/${locale}/administration/approbations-finance` }));
  const [q, f, mc, mi, pe] = await Promise.all([
    c.from("business_approval_requests").select("id,status,row_version,resource_type,resource_id").order("requested_at", { ascending: false }).limit(300),
    c.from("provider_commission_forecasts").select("id,mission_id,estimated_commission_minor,currency").order("created_at", { ascending: false }).limit(300),
    c.from("marketing_campaigns").select("id,title_fr,title_ar,row_version").eq("status", "VALIDATED_BY_RULES").order("created_at", { ascending: false }).limit(200),
    c.from("missions").select("id").in("status", ["ACTIVE", "DELIVERY_SUBMITTED", "ACCEPTANCE_IN_PROGRESS"]).limit(200),
    c.from("provider_payable_events").select("id,mission_id,commission_amount_minor,currency").eq("event_type", "COMMISSION_ACCRUAL").limit(300),
  ]);
  const requests = z.array(request).safeParse(q.data);
  const forecasts = z.array(forecast).safeParse(f.data);
  const campaigns = z.array(campaign).safeParse(mc.data);
  const missions = z.array(mission).safeParse(mi.data);
  const payables = z.array(payable).safeParse(pe.data);
  const ar = locale === "ar";
  const failed = [q, f, mc, mi, pe].some((x) => x.error) || !requests.success || !forecasts.success || !campaigns.success || !missions.success || !payables.success;
  return (
    <AdminModulePage
      locale={locale}
      active="finance"
      path="approbations-finance"
      title={ar ? "موافقات الأعمال والعمولات" : "Approbations métier et commissions"}
      lead={ar ? "الخطوة 11 — موافقات مالية بالعامل الثاني ومبالغ دقيقة." : "Étape 11 — approbations financières avec second facteur et montants exacts."}
    >
      <AdminStep11Gate locale={locale} current="approbations" />
      {failed ? (
        <p role="alert">{ar ? "تعذر تحميل البيانات المصرح بها." : "Impossible de charger les données autorisées."}</p>
      ) : (
        <FinanceApprovalPanel locale={locale} requests={requests.data} forecasts={forecasts.data} campaigns={campaigns.data} missions={missions.data} payables={payables.data} />
      )}
    </AdminModulePage>
  );
}
