import Link from "next/link";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export function SignedScopePendingNotice({ pending, locale, audience, contractId, query }: {
  pending?: boolean; locale: Locale; audience: "client" | "provider"; contractId: string; query: string;
}) {
  if (!pending) return null;
  const ar = locale === "ar";
  const href = audience === "client"
    ? `/${locale}/client/contrats${query}#contrat-${contractId}`
    : `/${locale}/sous-traitant/contrats/${contractId}${query}`;
  return <aside role="status" dir={ar ? "rtl" : "ltr"} className="client-card space-y-2 border-amber-400">
    <p>{ar ? "ملحق موقّع ينتظر التحضير التشغيلي من العميل. تظل حالة النطاق المنفّذ سابقاً محفوظة؛ ولا تعني اكتمال العمل المضاف بالملحق." : "Un avenant signé attend sa préparation opérationnelle par le Client. L’état du périmètre déjà exécuté reste conservé ; il ne signifie pas que le travail ajouté par l’avenant est terminé."}</p>
    <p>{audience === "client" ? (ar ? "راجع العقد وملحقاته لإعداد الالتزامات الجديدة حسب صلاحياتك." : "Consultez le contrat et ses avenants pour préparer les nouvelles obligations selon vos droits.") : (ar ? "تحضير الالتزامات الجديدة من مسؤولية العميل؛ لا تُتاح للمقدّم أي موافقة بدلاً منه." : "La préparation des nouvelles obligations relève du Client ; le prestataire ne peut pas l’approuver à sa place.")}</p>
    <Link className="client-text-link" href={href}>{ar ? "عرض العقد وملحقاته" : "Consulter le contrat et ses avenants"}</Link>
  </aside>;
}
