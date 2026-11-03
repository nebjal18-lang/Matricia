import Link from "next/link";
import { formatMoneyInput } from "@/modules/shared/lib/money-input";
import type { DecisionContext, EconomicContext } from "./model";

export function EconomicRulePanel({ context, locale }: { context: EconomicContext; locale: "fr" | "ar" }) {
  const ar = locale === "ar", rule = context.rule;
  return <section className="rounded-lg border p-3 space-y-2" dir={ar ? "rtl" : "ltr"} aria-label={ar ? "القاعدة الاقتصادية التعاقدية" : "Règle économique contractuelle"}>
    <h3 className="font-semibold">{ar ? "القاعدة الاقتصادية التعاقدية" : "Règle économique contractuelle"}</h3>
    {rule ? <><p>{ar ? "مبالغ ثابتة من النموذج المعتمد في نسخة العقد الموقعة. يعيد الخادم التحقق منها عند القرار والفوترة." : "Montants fixes issus du modèle approuvé dans la version signée du contrat. Le serveur les vérifie à nouveau lors de la décision et de la facturation."}</p><dl>
      <div><dt>{ar ? "تعويض تعاقدي مستحق للعميل" : "Pénalité contractuelle au bénéfice du client"}</dt><dd dir="ltr">{formatMoneyInput(rule.penalty_minor, rule.currency)} {rule.currency}</dd></div>
      <div><dt>{ar ? "عمولة Matricia" : "Commission Matricia"}</dt><dd dir="ltr">{formatMoneyInput(rule.commission_minor, rule.currency)} {rule.currency}</dd></div>
    </dl><p>{ar ? "هذه معاينة للقاعدة وليست فاتورة أو تحصيلاً. يظل تحصيل حق العميل خاضعاً لتفويض معتمد." : "Cette vue de la règle ne constitue ni une facture ni un encaissement. Le recouvrement au bénéfice du client reste soumis à un mandat approuvé."}</p></> : <p role="status">{ar ? "لا توجد قاعدة اقتصادية معتمدة وموقعة قابلة للتطبيق. يمكن للمراجع المستقل إصدار قرار مهني، بما فيه عدم المطابقة، دون إنشاء عمولة أو تعويض مالي. تُسجّل المتابعة الاقتصادية كاستثناء لمعالجته." : "Aucune règle économique approuvée et signée applicable. Le décideur indépendant peut rendre une décision métier, y compris une non-conformité, sans générer de commission ni de pénalité. La suite économique reste en exception à régulariser."}</p>}
    <p className="text-sm break-all">{ar ? "نسخة العقد" : "Version du contrat"} : <bdi>{context.contract_version_id}</bdi> · {ar ? "الالتزام" : "Obligation"} : <bdi>{context.obligation_key}</bdi></p>
  </section>;
}
export function DecisionRestriction({ context, locale }: { context: DecisionContext; locale: "fr" | "ar" }) {
  const ar = locale === "ar";
  if (context.status === "error" && context.reason === "UNAUTHENTICATED") return <div role="status" className="admin-banner"><p>{ar ? "انتهت الجلسة. سجل الدخول مجدداً للمتابعة." : "Votre session a expiré. Reconnectez-vous pour poursuivre."}</p><Link href={`/${locale}/connexion`}>{ar ? "تسجيل الدخول" : "Se reconnecter"}</Link></div>;
  const message = context.status === "error" ? context.reason === "MFA_REQUIRED" ? (ar ? "يلزم التحقق بعامل ثانٍ لاتخاذ القرار." : "Le second facteur est requis pour décider.") : context.reason === "UNAVAILABLE" ? (ar ? "تعذر تحميل سياق القرار. أعد تحميل الصفحة للمحاولة مجدداً." : "Le contexte de décision est indisponible. Rechargez la page pour réessayer.") : (ar ? "لا تملك صلاحية اتخاذ هذا القرار." : "Vous ne disposez pas de l’habilitation nécessaire pour décider.") : context.restriction === "PARTY_MEMBER" ? (ar ? "يجب أن يكون المراجع مستقلاً عن شركتي العميل ومقدم الخدمة." : "Le décideur doit être indépendant des sociétés cliente et prestataire.") : context.restriction === "STATE" ? (ar ? "مرحلة هذا الملف لا تسمح بقرار جديد. راجع تاريخه." : "L’état de ce dossier ne permet pas une nouvelle décision. Consultez son historique.") : (ar ? "صلاحية القراءة فقط : القرار مخصص لمراجع مستقل مخول." : "Consultation seule : la décision est réservée à un décideur indépendant habilité.");
  return <div role="status" className="admin-banner"><p>{message}</p>{context.status === "error" && context.reason === "MFA_REQUIRED" ? <Link href={`/${locale}/securite/compte`}>{ar ? "إعداد العامل الثاني" : "Configurer le second facteur"}</Link> : null}</div>;
}
