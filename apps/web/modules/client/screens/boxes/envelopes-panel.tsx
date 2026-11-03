"use client";
import { useActionState } from "react";
import { saveBoxEnvelopeAction } from "./envelopes-actions";
import type { BoxEnvelopes, EnvelopeState } from "./envelopes-model";
const initial: EnvelopeState = { status: "idle" };
function EnvelopeForm({ data, target, locale, commandId }: { data: BoxEnvelopes; target: BoxEnvelopes["targets"][number]; locale: "fr" | "ar"; commandId: string }) {
  const [state, action, pending] = useActionState(saveBoxEnvelopeAction, initial);
  const ar = locale === "ar", current = data.envelopes.find((item) => item.target_id === target.id);
  const errors = ar ? { VALIDATION: "تحققوا من السقف والسبب.", FORBIDDEN: "يتطلب التعديل مسؤولاً لدى العميل مع مصادقة معززة.", STALE: "تغير التوزيع. أعيدوا تحميل الصفحة.", BUDGET: "يتجاوز مجموع المخصصات ميزانية الصندوق.", COMMITTED: "لا يمكن استرجاع الأرصدة المحجوزة أو المستهلكة.", UNAVAILABLE: "تعذر حفظ التوزيع. أعيدوا المحاولة." } : { VALIDATION: "Vérifiez le plafond et le motif.", FORBIDDEN: "La modification exige un administrateur Client avec authentification renforcée.", STALE: "La répartition a changé. Rechargez la page.", BUDGET: "Le total des enveloppes dépasse le budget de la Box.", COMMITTED: "Les crédits réservés ou consommés ne peuvent pas être réaffectés.", UNAVAILABLE: "La répartition n’a pas pu être enregistrée. Réessayez." };
  return <form action={action} className="grid gap-3 rounded-lg border p-4">
    <h3>{ar ? target.name_ar ?? target.name : target.name}</h3>
    <p>{ar ? "الأرصدة المحجوزة أو المستهلكة" : "Crédits engagés ou consommés"} : <bdi>{current?.used ?? "0"}</bdi></p>
    <input type="hidden" name="boxId" value={data.box_id}/><input type="hidden" name="scope" value={data.scope ?? ""}/><input type="hidden" name="targetId" value={target.id}/><input type="hidden" name="expectedVersion" value={current?.version ?? 0}/><input type="hidden" name="idempotencyKey" value={commandId}/><input type="hidden" name="locale" value={locale}/>
    <label>{ar ? "سقف الأرصدة" : "Plafond de crédits"}<input name="creditLimit" required inputMode="numeric" pattern="[0-9]{1,19}" defaultValue={current?.credit_limit ?? "0"} className="client-input"/></label>
    <label>{ar ? "سبب التوزيع" : "Motif de la répartition"}<textarea name="reason" required minLength={5} maxLength={1000} className="client-input"/></label>
    {state.status === "error" ? <p role="alert">{errors[state.reason ?? "UNAVAILABLE"]}</p> : state.status === "success" ? <p role="status">{ar ? "تم حفظ التوزيع." : "Répartition enregistrée."}</p> : null}
    <button disabled={pending} className="client-button client-button--primary">{ar ? "حفظ المخصصات" : "Enregistrer l’enveloppe"}</button>
  </form>;
}
export function BoxEnvelopesPanel({ data, locale, commandIds }: { data: BoxEnvelopes; locale: "fr" | "ar"; commandIds: Record<string, string> }) {
  if (!data.scope) return null;
  const ar = locale === "ar";
  return <section className="client-card"><h2>{data.scope === "MEMBER" ? ar ? "مخصصات الأعضاء" : "Enveloppes des membres" : ar ? "ميزانيات المجالات" : "Budgets par domaine"}</h2>
    <p>{ar ? "هذه سقوف إنفاق ضمن أرصدة المؤسسة، ولا تنشئ أرصدة إضافية. لا يمكن إعادة توزيع المبالغ المحجوزة أو المستهلكة." : "Ces plafonds répartissent les crédits de l’organisation sans en créer. Seul le disponible peut être réaffecté."}</p>
    {!data.can_manage ? <p>{ar ? "تتطلب إدارة المخصصات مسؤولاً ومصادقة معززة." : "La gestion des enveloppes nécessite un propriétaire ou administrateur et une authentification renforcée."}</p> : null}
    {data.targets.length === 0 ? <p>{ar ? "لا يوجد عضو أو مجال مؤهل لهذا الصندوق." : "Aucun membre ou domaine éligible n’est disponible pour cette Box."}</p> : <div className="grid gap-4 md:grid-cols-2">{data.targets.map((target) => data.can_manage ? <EnvelopeForm key={target.id} data={data} target={target} locale={locale} commandId={commandIds[target.id]}/> : <p key={target.id}>{ar ? target.name_ar ?? target.name : target.name} : <bdi>{data.envelopes.find((item) => item.target_id === target.id)?.credit_limit ?? "0"}</bdi></p>)}</div>}
  </section>;
}
