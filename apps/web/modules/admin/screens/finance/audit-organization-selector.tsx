import Link from "next/link";
import type { FinanceAuditOrganizationContext } from "./audit-organization-context";

export function FinanceAuditOrganizationSelector({ locale, context }: { locale: "fr" | "ar"; context: FinanceAuditOrganizationContext }) {
  const ar = locale === "ar";
  return <section className="admin-panel space-y-3" aria-labelledby="finance-audit-organization-title">
    <h2 id="finance-audit-organization-title" className="text-xl font-semibold">{ar ? "المؤسسة المرجعية لتدقيق الإعداد المالي" : "Organisation de référence pour l’audit de la configuration financière"}</h2>
    <p className="text-sm leading-6">{ar ? "اختاروا المؤسسة التي سيُربط بها تدقيق إنشاء الخطط والباقات والأسعار. لا ينشئ هذا الاختيار محفظة أو دفعة أو اشتراكاً، ولا يغيّر المؤسسة أو صلاحياتكم." : "Choisissez l’organisation à laquelle rattacher l’audit de création des plans, boxes et tarifs. Ce choix ne crée aucun portefeuille, paiement ou abonnement et ne modifie ni l’organisation ni vos droits."}</p>
    {context.state === "UNAVAILABLE" ? <p role="alert">{ar ? "تعذّر تحميل المؤسسات المصرّح بها. تبقى السجلات المالية المعروضة متاحة، لكن لا يمكن تأكيد سياق الإعداد. أعيدوا تحميل الصفحة." : "Impossible de charger les organisations autorisées. Les données financières affichées restent consultables ; le contexte de configuration ne peut pas être confirmé. Rechargez la page."}</p> : context.organizations.length ? <form action={`/${locale}/administration/finance`} method="get" className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm font-medium" htmlFor="finance-audit-organization">{ar ? "المؤسسة" : "Organisation"}<select id="finance-audit-organization" name="organizationId" defaultValue={context.organizationId ?? ""} required className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2">
        <option value="" disabled>{ar ? "اختيار مؤسسة" : "Choisir une organisation"}</option>
        {context.organizations.map(row => <option key={row.id} value={row.id}>{row.display_name || row.legal_name} · {row.legal_name} · {row.status}</option>)}
      </select></label>
      <button className="admin-btn-outline min-h-11" type="submit">{ar ? "استخدام هذا السياق" : "Utiliser ce contexte"}</button>
    </form> : <p role="status">{ar ? "لا توجد مؤسسة مرجعية ظاهرة. أنشئوا المؤسسة أولاً ثم أكملوا مسار الموافقة المعتاد وعُودوا لاختيارها." : "Aucune organisation de référence visible. Créez d’abord l’entreprise, suivez son parcours d’approbation habituel, puis revenez la sélectionner."}</p>}
    {context.state === "INVALID" ? <p role="alert">{ar ? "الاختيار غير صالح أو غير متاح ضمن صلاحياتكم. اختاروا مؤسسة من القائمة؛ لم يُطبّق أي سياق آخر تلقائياً." : "La sélection est invalide ou indisponible dans votre périmètre. Choisissez une organisation dans la liste ; aucun autre contexte n’a été appliqué automatiquement."}</p> : null}
    {context.state === "CHOOSE" ? <p role="status">{ar ? "اختاروا السياق لفتح نماذج الإعداد المتاحة ضمن صلاحياتكم. تظل السجلات الحالية قابلة للقراءة." : "Sélectionnez le contexte pour ouvrir les formulaires de configuration autorisés. Les données existantes restent consultables."}</p> : null}
    {context.state !== "UNAVAILABLE" ? <Link href={`/${locale}/administration/entreprises/nouvelle`} className="inline-flex min-h-11 items-center underline">{ar ? "إنشاء المؤسسة المرجعية" : "Créer l’entreprise de référence"}</Link> : null}
  </section>;
}
