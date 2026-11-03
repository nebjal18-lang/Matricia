"use client";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { PlanOwnerContext } from "@/modules/franchise/data/performance/owner-context";
import { proposeNativePlanOwner, reviewNativePlanOwner, searchNativePlanOwners, type NativeOwnerActionState, type NativeOwnerSearchState } from "./native-owner-actions";
const control = "min-h-11 rounded border px-3";
function Feedback({ state, locale, success }: { state: NativeOwnerActionState | NativeOwnerSearchState; locale: Locale; success?: string }) {
  const ar = locale === "ar";
  return state.status === "success" ? success ? <p role="status">{success}</p> : null : state.status === "error" ? <div role="alert"><p>{state.reason === "VALIDATION" ? ar ? "تحققوا من الحقول." : "Vérifiez les champs." : state.reason === "MFA_REQUIRED" ? ar ? "أكّدوا العامل الثاني للمتابعة." : "Confirmez votre second facteur pour poursuivre." : state.reason === "FORBIDDEN" ? ar ? "يلزم مسؤول إدارة مستقل ومخوّل لهذا التكليف." : "Cette action exige un administrateur indépendant habilité pour ce mandat." : state.reason === "CONFLICT" ? ar ? "تغيرت الحالة. حدّثوا الصفحة قبل إعادة المحاولة." : "La situation a changé. Actualisez la page avant de réessayer." : ar ? "تعذر إتمام الطلب. يمكن إعادة المحاولة بنفس المرجع." : "Le traitement n’a pas abouti. Réessayez avec la même référence."}</p>{state.reason === "MFA_REQUIRED" ? <Link className="min-h-11 underline" href={`/${locale}/securite/compte`}>{ar ? "تأكيد العامل الثاني" : "Vérifier mon second facteur"}</Link> : null}</div> : null;
}
function Propose({ locale, planId, context }: { locale: Locale; planId: string; context: PlanOwnerContext }) {
  const ar = locale === "ar", id = useId(); const [key, setKey] = useState(() => crypto.randomUUID());
  const [search, searchAction, searching] = useActionState(searchNativePlanOwners, { status: "idle" } as NativeOwnerSearchState);
  const candidates = search.status === "success" ? search.context.candidates : context.candidates;
  const count = search.status === "success" ? search.context.candidateCount : context.candidateCount;
  const [state, action, pending] = useActionState(async (prior: NativeOwnerActionState, form: FormData) => { const result = await proposeNativePlanOwner(prior, form); if (result.status === "success") setKey(crypto.randomUUID()); return result; }, { status: "idle" });
  return <details className="rounded border p-3"><summary className="min-h-11 cursor-pointer font-semibold">{ar ? "اقتراح مسؤول مخوّل" : "Proposer un responsable habilité"}</summary>
    <form action={searchAction} className="mt-3 flex flex-wrap gap-3"><input type="hidden" name="planId" value={planId}/><label htmlFor={`${id}-search`}>{ar ? "البحث عن عضو بالاسم" : "Rechercher un membre par son nom"}</label><input className={control} id={`${id}-search`} name="q" maxLength={120}/><button className="franchise-tool" disabled={searching}>{ar ? "بحث" : "Rechercher"}</button><Feedback state={search} locale={locale}/></form>
    {count > candidates.length ? <p>{ar ? `عُرض ${candidates.length} من أصل ${count} عضواً. دقّقوا البحث لاختيار المسؤول.` : `${candidates.length} membres affichés sur ${count}. Affinez la recherche pour choisir le responsable.`}</p> : null}
    <form action={action} className="mt-3 grid gap-3"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="planId" value={planId}/><input type="hidden" name="version" value={context.version}/><input type="hidden" name="idempotencyKey" value={key}/>
      <label htmlFor={`${id}-owner`}>{ar ? "المسؤول من التكليف المعني" : "Responsable du mandat concerné"}</label>
      <select id={`${id}-owner`} name="ownerUserId" defaultValue="" required className={control}><option value="" disabled>{ar ? "اختيار عضو مخوّل" : "Choisir un membre habilité"}</option>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name ?? (ar ? `عضو ${candidate.index}` : `Membre ${candidate.index}`)}</option>)}</select>
      {!candidates.length ? <div><p>{ar ? "لا يوجد عضو مخوّل يطابق البحث. تحقّقوا من العضوية والدور وإسناد التكليف." : "Aucun membre habilité ne correspond à la recherche. Vérifiez l’adhésion, le rôle et l’affectation au mandat."}</p><Link className="inline-flex min-h-11 items-center underline" href={`/${locale}/administration/entreprises/${context.organizationId}`}>{ar ? "فتح ملف المؤسسة للتحقق من الصلاحيات" : "Ouvrir l’organisation pour vérifier les habilitations"}</Link></div> : null}
      <label htmlFor={`${id}-reason`}>{ar ? "سبب إسناد المسؤولية" : "Motif de l’affectation"}</label><textarea id={`${id}-reason`} name="reason" required minLength={10} maxLength={2000} className="min-h-24 rounded border p-3"/>
      <p>{ar ? "يتحقق مسؤول إدارة مستقل ثانٍ من الاقتراح قبل سريان الإسناد." : "Un second administrateur indépendant doit valider la proposition avant son application."}</p>
      <button className="franchise-tool" disabled={pending || !candidates.length}>{ar ? "إحالة الاقتراح للمراجعة" : "Soumettre à la revue indépendante"}</button><Feedback state={state} locale={locale} success={ar ? "سُجل الاقتراح، والإسناد ينتظر مراجعاً مستقلاً." : "Proposition enregistrée ; l’affectation attend un réviseur indépendant."}/>
    </form>
  </details>;
}
function Review({ locale, requestId }: { locale: Locale; requestId: string }) {
  const ar = locale === "ar", id = useId(); const [key, setKey] = useState(() => crypto.randomUUID());
  const [state, action, pending] = useActionState(async (prior: NativeOwnerActionState, form: FormData) => { const result = await reviewNativePlanOwner(prior, form); if (result.status === "success") setKey(crypto.randomUUID()); return result; }, { status: "idle" });
  return <form action={action} className="mt-3 grid gap-3"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="requestId" value={requestId}/><input type="hidden" name="idempotencyKey" value={key}/><label htmlFor={`${id}-decision`}>{ar ? "قرار المراجع المستقل" : "Décision du réviseur indépendant"}</label><select id={`${id}-decision`} name="decision" className={control}><option value="APPROVE">{ar ? "اعتماد الإسناد" : "Approuver l’affectation"}</option><option value="REJECT">{ar ? "رفض الاقتراح" : "Refuser la proposition"}</option></select><label htmlFor={`${id}-reason`}>{ar ? "سبب القرار" : "Motif de décision"}</label><textarea id={`${id}-reason`} name="reason" required minLength={10} maxLength={2000} className="min-h-24 rounded border p-3"/><button className="franchise-tool" disabled={pending}>{ar ? "تسجيل المراجعة" : "Enregistrer la revue"}</button><Feedback state={state} locale={locale} success={ar ? "سُجلت المراجعة." : "Revue enregistrée."}/></form>;
}
export function NativePlanOwnerControls({ locale, planId, context }: { locale: Locale; planId: string; context: PlanOwnerContext }) {
  const ar = locale === "ar";
  const [history, historyAction, loading] = useActionState(searchNativePlanOwners, { status: "idle" } as NativeOwnerSearchState);
  const page = history.status === "success" ? history.context : context;
  return <section className="space-y-3 rounded-lg border p-3" aria-label={ar ? "مسؤول الخطة" : "Responsable du plan"}>
    <h4 className="font-semibold">{context.ownerConfirmed ? ar ? "المسؤول الفعلي" : "Responsable effectif" : ar ? "المسؤول المقترح قبل الاعتماد" : "Responsable suggéré avant validation"} : <span dir="auto">{context.ownerName ?? (context.ownerUserId ? ar ? "عضو التكليف" : "Membre du mandat" : ar ? "غير مسند" : "Non affecté")}</span></h4>
    {!context.ownerActive ? <p role="status">{ar ? "المسؤول غير متاح أو لم يعد مخوّلاً. يتوقف تسجيل التقدم حتى إسناد مسؤول مخوّل عبر مراجعة مستقلة. يبقى سجل الخطة محفوظاً." : "Le responsable est absent ou n’est plus habilité. L’avancement reste bloqué jusqu’à une affectation validée indépendamment. L’historique du plan est conservé."}</p> : null}
    {context.canProposeAssignment ? <Propose locale={locale} planId={planId} context={context}/> : null}
    <ol className="space-y-3">{page.requests.map(request => <li key={request.id} className="rounded border p-3"><p><span dir="auto">{request.ownerName ?? (ar ? "عضو التكليف" : "Membre du mandat")}</span> · {request.decision === "APPROVE" ? ar ? "إسناد معتمد" : "Affectation approuvée" : request.decision === "REJECT" ? ar ? "اقتراح مرفوض" : "Proposition refusée" : ar ? "قيد المراجعة المستقلة" : "En revue indépendante"}</p><time dateTime={request.createdAt}>{request.createdAt.slice(0, 10)}</time>{request.canReview ? <Review locale={locale} requestId={request.id}/> : null}</li>)}</ol>
    {page.nextRequestCursor ? <form action={historyAction}><input type="hidden" name="planId" value={planId}/><input type="hidden" name="before" value={page.nextRequestCursor.before}/><input type="hidden" name="beforeId" value={page.nextRequestCursor.id}/><button className="franchise-tool" disabled={loading}>{ar ? "الإسنادات السابقة" : "Affectations précédentes"}</button><Feedback state={history} locale={locale}/></form> : null}
  </section>;
}
