"use client";

import { useActionState } from "react";
import { Button } from "@/modules/shared/ui/button";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { loadFranchiseNetworkInvitationStatus } from "./invitation-status-action";
import type { NetworkInvitationStatusState } from "./invitation-status-model";

const copy = {
  fr: { title: "Suivi réel des invitations", load: "Actualiser le suivi", pending: "Chargement…", empty: "Aucune invitation dans ce mandat.", pageEmpty: "Aucune invitation sur cette page. Revenez à la page précédente.", session: "Session expirée. Reconnectez-vous pour consulter le suivi.", error: "Suivi indisponible. Réessayez ; aucun état vide n’est confirmé.", forbidden: "Ce compte n’est pas autorisé à consulter les invitations de ce mandat.", previous: "Précédent", next: "Suivant", demo: "Test : remise simulée, aucun email réel", statuses: { QUEUED: "En attente d’envoi", SENT: "Acceptée par le fournisseur d’email", OPENED: "Ouverte par le destinataire vérifié", REGISTERED: "Organisation enregistrée", EXPIRED: "Expirée", REVOKED: "Révoquée" } },
  ar: { title: "التتبّع الفعلي للدعوات", load: "تحديث التتبّع", pending: "جارٍ التحميل…", empty: "لا توجد دعوات في هذا التفويض.", pageEmpty: "لا توجد دعوات في هذه الصفحة. عودوا إلى الصفحة السابقة.", session: "انتهت الجلسة. سجّلوا الدخول للاطّلاع على التتبّع.", error: "التتبّع غير متاح. أعيدوا المحاولة؛ لم تُؤكّد قائمة فارغة.", forbidden: "هذا الحساب غير مخوّل للاطّلاع على دعوات هذا التفويض.", previous: "السابق", next: "التالي", demo: "اختبار: تسليم محاكى دون بريد حقيقي", statuses: { QUEUED: "في انتظار الإرسال", SENT: "قبلها مزوّد البريد", OPENED: "فتحها المستلم المتحقّق منه", REGISTERED: "تم تسجيل المؤسسة", EXPIRED: "منتهية الصلاحية", REVOKED: "ملغاة" } },
} as const;

export function NetworkInvitationStatusPanel({ locale, franchiseId }: { locale: Locale; franchiseId: string }) {
  const [state, action, pending] = useActionState(loadFranchiseNetworkInvitationStatus, { status: "idle" } as NetworkInvitationStatusState);
  const c = copy[locale];
  return <section className="space-y-4 rounded-xl border bg-card p-5 lg:col-span-2">
    <h2 className="text-lg font-semibold">{c.title}</h2>
    <form action={action} className="flex flex-wrap gap-3"><input type="hidden" name="franchiseId" value={franchiseId} />
      <Button type="submit" name="page" value={state.status === "success" ? state.page : 1} disabled={pending}>{pending ? c.pending : c.load}</Button>
      {state.status === "success" && state.page > 1 ? <Button type="submit" name="page" value={state.page - 1} variant="outline" disabled={pending}>{c.previous}</Button> : null}
      {state.status === "success" && state.page * 25 < state.total ? <Button type="submit" name="page" value={state.page + 1} variant="outline" disabled={pending}>{c.next}</Button> : null}
    </form>
    {state.status === "error" ? <p role="alert">{state.reason === "FORBIDDEN" ? c.forbidden : state.reason === "UNAUTHENTICATED" ? c.session : c.error}</p> : null}
    {state.status === "success" ? state.rows.length ? <ul className="grid gap-3" aria-live="polite">{state.rows.map(i => <li key={i.id} className="flex flex-wrap justify-between gap-3 rounded-md border p-3"><span dir="ltr" className="min-w-0 break-all">{i.contact_email}</span><span>{c.statuses[i.status]}</span>{i.delivery_mode === "NON_CONTRACTUAL_DEMO" ? <span className="w-full text-sm">{c.demo}</span> : null}</li>)}</ul> : <p role="status">{state.total > 0 ? c.pageEmpty : c.empty}</p> : null}
  </section>;
}
