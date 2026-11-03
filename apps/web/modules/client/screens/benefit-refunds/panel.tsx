"use client";
import {useActionState,useId} from "react";
import { workspaceSecurityHref } from "@/modules/shared/lib/auth/security-href";
import Link from "next/link";
import {manageBenefitRefund} from "./actions";
import type {RefundRow,RefundState} from "./model";
import {formatMoneyInput} from "@/modules/shared/lib/money-input";
import type {Locale} from "@/modules/shared/lib/i18n/locale";
const initial:RefundState={status:"idle"};
export function BenefitRefundCard({row,locale,requestKey,finance=false}:{row:RefundRow;locale:Locale;requestKey:string;finance?:boolean}){
 const[state,action,pending]=useActionState(manageBenefitRefund,initial),id=useId(),ar=locale==="ar";
 const date=(value:string)=>new Intl.DateTimeFormat(ar?"ar-MA":"fr-MA",{dateStyle:"medium",timeZone:"Africa/Casablanca"}).format(new Date(value));
 const messages=ar?{VALIDATION:"تحقق من الحقول والتأكيد.",FORBIDDEN:"غير مسموح أو يلزم التحقق بخطوتين.",STALE:"تغيرت البيانات. حدّث الصفحة قبل المراجعة.",POLICY:"تنتظر العملية سياسة معتمدة أو تحققاً من المصدر المحاسبي.",EXPIRED:"انتهت مهلة الاسترجاع أو صلاحية الدفعة الأصلية.",FAILED:"تعذر تسجيل العملية. أعد المحاولة بنفس الطلب."}:{VALIDATION:"Vérifiez les champs et la confirmation.",FORBIDDEN:"Accès refusé ou authentification multifacteur requise.",STALE:"Les données ont changé. Actualisez avant la revue.",POLICY:"Une politique approuvée ou une vérification de la source comptable est requise.",EXPIRED:"Le délai de retour ou le lot d’origine a expiré.",FAILED:"L’opération n’a pas abouti. Réessayez avec la même demande."};
 const success=state.outcome==="BENEFIT_REFUND_REQUESTED"?(ar?"تم إرسال الطلب للمراجعة المالية المستقلة.":"Demande transmise à la revue Finance indépendante."):state.outcome==="BENEFIT_REFUNDED"?(ar?"أعيدت الأرصدة وعُكست الإيرادات المنسوبة.":"Crédits restitués et revenus attribués contrepassés."):(ar?"تم رفض الطلب مع تسجيل السبب.":"Demande refusée avec motif enregistré.");
 const canDecide=finance&&row.request?.can_decide;
 return <article className="rounded-xl border bg-white p-4 shadow-sm grid gap-3"dir={ar?"rtl":"ltr"}>
  <h2 className="text-lg font-semibold">{ar?row.name_ar:row.name_fr}</h2><p>{row.organization_name} · {row.quantity} {ar?"رصيد":"crédits"}</p>
  <p>{row.status==="REFUNDED"?(ar?"تم الاسترجاع":"Remboursé en crédits"):(ar?"تم الاستهلاك":"Consommé")}</p>
  <p>{ar?"تعود الأرصدة إلى دفعاتها الأصلية مع الاحتفاظ بالمصدر والمكتبة وتاريخ الانتهاء. لا تمدد الصلاحية ولا تنفذ دفعة نقدية.":"Les crédits reviennent dans leurs lots d’origine, avec leur financement, leur bibliothèque et leur échéance. La validité est conservée et le retour s’effectue en crédits."}</p>
  <ul className="grid gap-1">{row.original_lots.map(lot=><li key={lot.id}>{lot.quantity} {ar?"رصيد · تنتهي في":"crédits · échéance"} {date(lot.expires_at)}</li>)}</ul>
  {finance&&row.economic_reversals?<div><h3 className="font-semibold">{row.status==="REFUNDED"?(ar?"الإيرادات المنسوبة المعكوسة":"Revenus attribués contrepassés"):(ar?"الإيرادات المنسوبة المطلوب عكسها":"Revenus attribués à contrepasser")}</h3>{row.economic_reversals.length===0?<p>{ar?"لم ينسب إيراد محاسبي لهذه العملية.":"Aucun revenu comptable attribué à cette consommation."}</p>:<ul>{row.economic_reversals.map(entry=><li key={entry.id}>{entry.library_code} · {entry.book_organization} · <bdi>{formatMoneyInput(entry.amount_minor,entry.currency)} {entry.currency}</bdi></li>)}</ul>}</div>:null}
  {row.policy_reference?<p>{ar?"السياسة المعتمدة: ":"Politique approuvée : "}{row.policy_reference}</p>:null}
  {row.request?<div className="grid gap-2"><p>{ar?"سبب الطلب: ":"Motif de la demande : "}{row.request.reason}</p><p>{row.request.approved===true?(ar?"وافقت المالية":"Finance a approuvé"):row.request.approved===false?(ar?"رفضت المالية":"Finance a refusé"):(ar?"في انتظار مراجعة مالية مستقلة":"Revue Finance indépendante en attente")}</p>{row.request.decision_reason?<p>{row.request.decision_reason}</p>:null}</div>:null}
  {row.request?.source_stale&&row.status==="CONSUMED"?<p>{ar?"تغيرت المصادر المحاسبية. يلزم طلب جديد قبل الموافقة.":"Les sources comptables ont changé. Une nouvelle demande est nécessaire avant approbation."}</p>:null}
  {row.refunded?<p role="status">{ar?"الأرصدة المعادة: ":"Crédits restitués : "}{row.refunded.quantity} · {date(row.refunded.created_at)}</p>:null}
  {!row.policy_ready&&row.status==="CONSUMED"?<p>{ar?"يلزم اعتماد سياسة الاسترجاع لهذه الميزة قبل تقديم الطلب.":"Une politique de retour approuvée est nécessaire pour cet avantage avant de déposer une demande."}</p>:null}
  {row.requires_mfa&&row.status==="CONSUMED"?<Link href={workspaceSecurityHref(locale,`/${locale}/${finance?"administration":"client"}/avantages/remboursements`,row.organization_id,finance?"administration":"client")}>{ar?"تفعيل التحقق بخطوتين":"Activer l’authentification multifacteur"}</Link>:null}
  {(row.can_request&&!finance)||canDecide?<form action={action}className="grid gap-3">
   {Object.entries({locale,redemptionId:row.id,organizationId:row.organization_id,rowVersion:row.row_version,idempotencyKey:requestKey,...(canDecide&&row.request?{requestId:row.request.id,contentHash:row.request.content_hash}:{intent:"request"})}).map(([name,value])=><input key={name}type="hidden"name={name}value={value}/>)}
   <label htmlFor={`${id}-reason`}>{canDecide?(ar?"سبب القرار المالي":"Motif de la décision Finance"):(ar?"سبب طلب استرجاع الأرصدة":"Motif de la demande de retour en crédits")}</label>
   <textarea id={`${id}-reason`}name="reason"required minLength={10}maxLength={2000}rows={4}className="rounded border p-2"/>
   <label className="flex gap-2 items-start"><input name="confirmed"type="checkbox"value="yes"required/><span>{canDecide?(ar?"راجعت الدفعات والأدلة الأصلية وأتحمل مسؤولية قراري المستقل.":"J’ai vérifié les lots et preuves d’origine et j’assume cette décision indépendante."):(ar?"أؤكد سبب الطلب وأفهم أنه يخضع للمراجعة المالية المستقلة.":"Je confirme ce motif et comprends que ma demande exige une revue Finance indépendante.")}</span></label>
   {canDecide?<div className="flex flex-wrap gap-3">{!row.request?.source_stale?<button name="intent"value="approve"type="submit"disabled={pending}className="rounded bg-emerald-700 text-white p-2">{ar?"الموافقة وإعادة الأرصدة":"Approuver et restituer les crédits"}</button>:null}<button name="intent"value="reject"type="submit"disabled={pending}className="rounded border p-2">{ar?"رفض الطلب":"Refuser la demande"}</button></div>:<button type="submit"disabled={pending}className="rounded bg-emerald-700 text-white p-2">{ar?"طلب استرجاع الأرصدة":"Demander un retour en crédits"}</button>}
  </form>:null}
  {state.status==="success"?<p role="status">{success}</p>:state.status==="error"?<p role="alert">{messages[state.reason??"FAILED"]}</p>:null}
 </article>;
}
