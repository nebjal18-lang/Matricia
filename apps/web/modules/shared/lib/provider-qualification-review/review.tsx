"use client";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Button } from "@/modules/shared/ui/button";
import { loadQualificationQuestionnaireReview } from "./actions";
import { qualificationScorePercent, reviewAnswerText, type QualificationReviewContext, type QualificationReviewReadResult, type QualificationReviewSession } from "./model";

export function QualificationQuestionnaireAnswers({review,locale}:{review:QualificationReviewSession;locale:"fr"|"ar"}){
 const ar=locale==="ar";
 return <section aria-label={ar?"الأسئلة والأجوبة المقدمة":"Questions et réponses déposées"} className="space-y-3 rounded-lg border p-3">
  <h4 className="font-semibold">{ar?review.titleAr:review.titleFr} · {ar?"النسخة":"Version"} {review.version}</h4>
  <p className="text-sm">{ar?"نتيجة المحرك المجمدة":"Score du moteur figé"} : <strong dir="ltr">{qualificationScorePercent(review.engineScoreBasisPoints)} %</strong></p>
  <p className="text-sm text-muted-foreground">{ar?"القرار بشري. نتيجة المحرك لا تعوض مراجعة الأجوبة والوثائق والشروط الإلزامية.":"La décision reste humaine. Le score du moteur ne remplace pas la revue des réponses, des pièces et des contrôles obligatoires."}</p>
  <ol className="space-y-3">{review.questions.map(question=><li key={question.id} className="min-w-0 rounded border p-3">
   <p className="font-medium">{ar?question.labelAr:question.labelFr}</p>
   {!question.applicable?<p className="text-sm text-muted-foreground">{ar?"غير مطبق عند الإيداع؛ تبقى الإجابة السابقة مؤرشفة.":"Non applicable au dépôt ; une éventuelle réponse antérieure reste archivée."}</p>:null}
   <pre dir="auto" className="mt-2 whitespace-pre-wrap break-words font-sans text-sm">{reviewAnswerText(question,locale)}</pre>
  </li>)}</ol>
  <details className="text-xs text-muted-foreground"><summary>{ar?"مرجع النسخة والأدلة":"Références de version et de preuve"}</summary><p className="break-all" dir="ltr">{review.snapshotHash}</p><p className="break-all" dir="ltr">{review.answerManifestHash}</p></details>
 </section>;
}
export function QualificationQuestionnaireReview({qualificationId,locale,required,onReviewed}:{qualificationId:string;locale:"fr"|"ar";required:boolean;onReviewed:(selection:{rowVersion:number;engineScorePercent:string}|null)=>void}){
 const ar=locale==="ar",id=useId();const[context,setContext]=useState<QualificationReviewContext|null>(null),[error,setError]=useState<Extract<QualificationReviewReadResult,{status:"error"}>["reason"]|null>(null),[pending,start]=useTransition();
 function load(page=1,sessionId?:string){setError(null);setContext(current=>current?{...current,selected:null}:null);onReviewed(null);start(async()=>{try{const result=await loadQualificationQuestionnaireReview({qualificationId,page,...(sessionId?{sessionId}:{})});if(result.status==="error"){setError(result.reason);return;}setContext(result.context);onReviewed(result.context.selected?{rowVersion:result.context.qualificationRowVersion,engineScorePercent:qualificationScorePercent(result.context.selected.engineScoreBasisPoints)}:null);}catch{setError("UNAVAILABLE");}});}
 const selected=context?.selected;
 return <fieldset className="space-y-3 rounded-lg border p-3 sm:col-span-2"><legend>{ar?"مراجعة استبيان التأهيل":"Revue du questionnaire de qualification"}</legend>
  <p className="text-sm">{ar?"اختر إيداعا مطابقا للخدمة والمكتبة، ثم راجع الأجوبة المجمدة قبل اتخاذ القرار.":"Choisissez un dépôt applicable au service et à sa bibliothèque, puis examinez les réponses figées avant de décider."}</p>
  <Button type="button" variant="outline" disabled={pending} onClick={()=>load(context?.page??1)}>{pending?(ar?"جار التحميل…":"Chargement…"):(ar?"تحميل الاستبيانات المقدمة":"Charger les questionnaires soumis")}</Button>
  {error?<p role="alert" className="text-sm">{error==="MFA_REQUIRED"?<>{ar?"يلزم التحقق بعامل ثان.":"Une vérification par second facteur est requise."} <Link className="underline" href={`/${locale}/securite/compte`}>{ar?"فتح أمان الحساب":"Ouvrir la sécurité du compte"}</Link></>:error==="FORBIDDEN"?(ar?"ليس لكم حق مراجعة هذا الملف بشكل مستقل.":"Votre rôle ne permet pas la revue indépendante de ce dossier."):error==="UNAUTHENTICATED"?(ar?"يلزم تجديد جلسة الدخول.":"Votre session doit être renouvelée."):(ar?"تعذر تحميل الأدلة. أعد المحاولة؛ لا يعني ذلك غياب الأجوبة.":"Les preuves n’ont pas pu être chargées. Réessayez ; cela ne signifie pas qu’aucune réponse n’a été déposée.")}</p>:null}
  {context?<><label htmlFor={`${id}-session`} className="grid gap-1 text-sm">{ar?"الإيداع المراد مراجعته":"Dépôt à examiner"}<select id={`${id}-session`} value={selected?.id??""} onChange={event=>event.target.value&&load(context.page,event.target.value)} disabled={pending||!context.sessions.length} className="min-h-11 max-w-full rounded border bg-background px-3"><option value="">{ar?"اختر استبيانا مقدما":"Choisissez un questionnaire soumis"}</option>{context.sessions.map(session=><option value={session.id} key={session.id} disabled={!session.available}>{ar?session.titleAr:session.titleFr} · v{session.version} · {new Intl.DateTimeFormat(ar?"ar-MA":"fr-MA",{dateStyle:"medium",timeStyle:"short"}).format(new Date(session.submittedAt))}{!session.available?(ar?" — أدلة غير متاحة":" — preuves indisponibles"):""}</option>)}</select></label>
   {context.total===0?<p role="status" className="text-sm">{ar?"لا يوجد استبيان مقدم مطابق لهذا الملف. اطلب من مقدم الخدمة إكمال مسار التأهيل.":"Aucun questionnaire soumis applicable à ce dossier. Demandez au prestataire de terminer son parcours de qualification."}</p>:null}
   {context.sessions.some(session=>!session.available)?<p role="alert" className="text-sm">{ar?"بعض الإيداعات غير متاحة للمراجعة. أعد التحميل أو اطلب الدعم دون اعتمادها.":"Certains dépôts sont indisponibles à la revue. Rechargez ou demandez une assistance avant de les approuver."}</p>:null}
   <nav className="flex flex-wrap gap-3" aria-label={ar?"صفحات الاستبيانات":"Pages des questionnaires"}>{context.page>1?<Button type="button" variant="outline" disabled={pending} onClick={()=>load(context.page-1)}>{ar?"السابق":"Précédent"}</Button>:null}{context.total>context.page*context.pageSize?<Button type="button" variant="outline" disabled={pending} onClick={()=>load(context.page+1)}>{ar?"التالي":"Suivant"}</Button>:null}</nav>
  </>:null}
  {selected?<><input type="hidden" name="questionnaireSessionId" value={selected.id}/><input type="hidden" name="reviewedManifestHash" value={selected.contextHash}/><QualificationQuestionnaireAnswers review={selected} locale={locale}/><label key={selected.contextHash} className="flex min-h-11 items-start gap-3"><input type="checkbox" name="evidenceConfirmed" value="yes" required={required} className="mt-1 size-5"/><span className="text-sm">{ar?"أؤكد أنني راجعت الأسئلة والأجوبة المقدمة أعلاه مع الأدلة المطلوبة لهذا الملف.":"Je confirme avoir examiné les questions et réponses déposées ci-dessus, ainsi que les pièces obligatoires de ce dossier."}</span></label></>:null}
 </fieldset>;
}
