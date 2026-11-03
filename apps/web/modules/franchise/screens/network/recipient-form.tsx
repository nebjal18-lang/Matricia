"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { Button } from "@/modules/shared/ui/button";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { acceptFranchiseNetworkInvitation, openFranchiseNetworkInvitation } from "./recipient-actions";
import type { NetworkRecipientState } from "./recipient-model";

const copy = {
  fr: {
    title: "Invitation au réseau professionnel", lead: "Cette invitation permet d’enregistrer l’origine de votre organisation. Elle n’ajoute aucun membre, rôle, qualification ou droit économique. Utilisez l’adresse email destinataire de l’invitation.",
    open: "Ouvrir mon invitation", pending: "Vérification…", select: "Votre organisation autorisée", confirm: "Je confirme le rattachement de l’origine de cette organisation à cette invitation.", accept: "Enregistrer mon organisation", empty: "Aucune organisation active autorisée pour ce parcours. Préparez votre passeport d’entreprise ou demandez le rôle nécessaire, puis revenez sur ce lien.",
    passport: "Préparer mon passeport d’entreprise", success: "Origine enregistrée. Les contrôles de conformité et les règles économiques restent indépendants.", dashboard: "Ouvrir mon espace", security: "Configurer ou vérifier le second facteur", demo: "Invitation de test : remise simulée, aucun email réel envoyé.",
    errors: { VALIDATION: "Vérifiez le lien et les champs du formulaire.", UNAUTHENTICATED: "Connectez-vous avec l’adresse destinataire.", FORBIDDEN: "Cette adresse, ce lien ou cette organisation ne vous autorise pas à accepter l’invitation.", INACTIVE: "Cette invitation est expirée ou son mandat n’est plus actif. Demandez une nouvelle invitation.", CONFLICT: "L’origine de cette organisation est déjà enregistrée. Elle ne peut pas être remplacée par cette invitation.", MFA_REQUIRED: "Le second facteur est requis pour enregistrer ce rattachement.", FAILED: "Le service est momentanément indisponible. Réessayez ; aucun succès n’est confirmé." },
  },
  ar: {
    title: "دعوة إلى الشبكة المهنية", lead: "تتيح الدعوة تسجيل مصدر انضمام مؤسستكم. لا تضيف عضواً أو دوراً أو اعتماداً مهنياً أو حقاً مالياً. استخدموا البريد المستلم للدعوة.",
    open: "فتح دعوتي", pending: "جارٍ التحقّق…", select: "مؤسستكم المخوّلة", confirm: "أؤكّد ربط مصدر انضمام هذه المؤسسة بهذه الدعوة.", accept: "تسجيل مؤسستي", empty: "لا توجد مؤسسة نشطة مخوّلة لهذا المسار. جهّزوا جواز المؤسسة أو اطلبوا الدور اللازم ثم عودوا إلى هذا الرابط.",
    passport: "إعداد جواز مؤسستي", success: "تم تسجيل مصدر الانضمام. تبقى ضوابط المطابقة والقواعد المالية مستقلة.", dashboard: "فتح مساحتي", security: "إعداد عامل التحقّق الثاني أو التحقّق منه", demo: "دعوة اختبار: تسليم محاكى، لم يُرسل بريد حقيقي.",
    errors: { VALIDATION: "تحقّقوا من الرابط وحقول النموذج.", UNAUTHENTICATED: "سجّلوا الدخول بالبريد المستلم للدعوة.", FORBIDDEN: "هذا البريد أو الرابط أو المؤسسة لا يخوّلكم قبول الدعوة.", INACTIVE: "انتهت صلاحية الدعوة أو لم يعد تفويضها نشطاً. اطلبوا دعوة جديدة.", CONFLICT: "مصدر انضمام هذه المؤسسة مسجّل ولا يمكن استبداله بهذه الدعوة.", MFA_REQUIRED: "يلزم عامل التحقّق الثاني لتسجيل هذا الربط.", FAILED: "الخدمة غير متاحة مؤقتاً. أعيدوا المحاولة؛ لم يتم تأكيد أي نجاح." },
  },
} as const;

const idle: NetworkRecipientState = { status: "idle" };
export function NetworkRecipientForm({ locale, invitationId, token, idempotencyKey }: { locale: Locale; invitationId: string; token: string; idempotencyKey: string }) {
  const c = copy[locale], id = useId();
  const [opened, open, pendingOpen] = useActionState(openFranchiseNetworkInvitation, idle);
  const [accepted, accept, pendingAccept] = useActionState(acceptFranchiseNetworkInvitation, idle);
  const returnTo = `/${locale}/rejoindre-reseau?${new URLSearchParams({ invitationId, token })}`;
  const hidden = <><input type="hidden" name="locale" value={locale} /><input type="hidden" name="invitationId" value={invitationId} /><input type="hidden" name="token" value={token} /></>;
  const error = accepted.status === "error" ? accepted : opened.status === "error" ? opened : null;
  return <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-8">
    <h1 className="text-2xl font-semibold">{c.title}</h1><p>{c.lead}</p>
    {accepted.status === "success" ? <div role="status" className="space-y-4"><p>{c.success}</p><Link className="underline" href={`/${locale}/tableau-de-bord?${new URLSearchParams({ organizationId: accepted.organizationId, workspace: accepted.prospectType === "CLIENT" ? "client" : "provider" })}`}>{c.dashboard}</Link></div> : <>
      <form action={open}>{hidden}<Button disabled={pendingOpen} type="submit">{pendingOpen ? c.pending : c.open}</Button></form>
      {opened.status === "opened" ? <>
        {opened.invitation.delivery_mode === "NON_CONTRACTUAL_DEMO" ? <p role="note" className="rounded-md border p-3">{c.demo}</p> : null}
        {opened.invitation.organizations.length ? <form action={accept} className="space-y-4">{hidden}<input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <label className="grid gap-2" htmlFor={`${id}-organization`}>{c.select}<select className="min-h-11 max-w-full rounded-md border bg-background px-3" id={`${id}-organization`} name="organizationId" required>{opened.invitation.organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <label className="flex items-start gap-3"><input type="checkbox" name="confirmed" value="yes" required className="mt-1 size-5 shrink-0" /><span>{c.confirm}</span></label>
          <Button type="submit" disabled={pendingAccept}>{pendingAccept ? c.pending : c.accept}</Button>
        </form> : <div className="space-y-3"><p>{c.empty}</p><Link className="underline" href={`/${locale}/organisation?${new URLSearchParams({ role: opened.invitation.prospect_type === "PROVIDER" ? "fournisseur" : "client", next: returnTo })}`}>{c.passport}</Link></div>}
      </> : null}
      <Link className="block underline" href={`/${locale}/securite/compte?next=${encodeURIComponent(returnTo)}`}>{c.security}</Link>
      {error ? <p role="alert">{c.errors[error.reason]}</p> : null}
    </>}
  </section>;
}
