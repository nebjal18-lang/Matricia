"use client";
import {useCallback,useEffect,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import type {Locale} from "@/modules/shared/lib/i18n/locale";
import {loadSelectedQuoteIdentity,proposeSelectedQuoteIdentity,type ReconfirmationParty,type SelectedQuoteIdentityContext} from "@/modules/provider/data/quotes/identity-reconfirmation";

export function reconfirmationError(message:string,locale:Locale):string{
  const tr=(fr:string,ar:string)=>locale==="ar"?ar:fr;
  if(/STALE|MISMATCH/u.test(message))return tr("Le contexte a changé. Actualisez et confirmez à nouveau les identités et l’adresse courantes.","تغير السياق. حدّثوا ثم أكدوا الهويات والعنوان الحاليين مجددا.");
  if(message.includes("CANONICAL_ADDRESS"))return tr("L’adresse doit correspondre à l’identité juridique approuvée. Toute correction nécessite sa revue.","يجب أن يطابق العنوان الهوية القانونية المعتمدة. أي تصحيح يتطلب مراجعتها.");
  if(message.includes("BLOCKED"))return tr("La nouvelle proposition est bloquée par les contrôles d’identité, d’éligibilité ou de situation financière. Consultez les motifs actualisés.","المقترح الجديد محجوب بضوابط الهوية أو الأهلية أو الوضع المالي. راجعوا الأسباب المحدثة.");
  return tr("Opération indisponible. Vérifiez votre authentification renforcée et vos droits de propriétaire ou gestionnaire, puis actualisez.","العملية غير متاحة. تحققوا من المصادقة المعززة وصلاحيات المالك أو المدير ثم حدّثوا.");
}
function blockLabel(code:string,locale:Locale){
  const labels:Record<string,[string,string]>={
    CLIENT_IDENTITY_REVIEW_REQUIRED:["Identité du Client à revérifier","يلزم إعادة مراجعة هوية العميل"],
    PROVIDER_IDENTITY_REVIEW_REQUIRED:["Identité du Prestataire à revérifier","يلزم إعادة مراجعة هوية مقدم الخدمات"],
    ACTIVE_ORGANIZATIONS_REQUIRED:["Les deux organisations doivent être actives","يجب أن تكون الجهتان نشطتين"],
    CLIENT_FINANCIAL_HOLD_ACTIVE:["Situation financière du Client à régulariser","يلزم تسوية الوضع المالي للعميل"],
    PROVIDER_NOT_ELIGIBLE_FOR_NEW_COMMITMENT:["Éligibilité du Prestataire à compléter","يلزم استكمال أهلية مقدم الخدمات"],
  };
  return labels[code]?.[locale==="ar"?1:0]??(locale==="ar"?"مراجعة إضافية مطلوبة قبل الالتزام الجديد":"Une revue supplémentaire est requise avant un nouvel engagement");
}
export function ReconfirmationPartyCard({party,address,label,locale}:{party:ReconfirmationParty|null;address?:string|null;label:string;locale:Locale}){
  return <section className="rounded border p-3"><h4>{label}</h4>{party?<dl className="grid gap-1 text-sm">
    <div><dt>{locale==="ar"?"الاسم القانوني":"Dénomination légale"}</dt><dd>{party.legal_name}</dd></div>
    <div><dt>{locale==="ar"?"البلد":"Pays"}</dt><dd>{party.country_code}</dd></div>
    {["ICE","IF","RC"].map(code=><div key={code}><dt>{code}</dt><dd dir="ltr">{party.identifiers[code]??"—"}</dd></div>)}
    <div><dt>{locale==="ar"?"العنوان":"Adresse"}</dt><dd>{address??party.registered_address??"—"}</dd></div>
  </dl>:<p>{locale==="ar"?"هوية معتمدة غير متاحة حاليا":"Identité approuvée actuellement indisponible"}</p>}</section>;
}
export function SelectedQuoteIdentityReconfirmation(props:{quoteVersionId:string;organizationId:string;locale:Locale}){
  return <SelectedQuoteIdentityDisclosure key={`${props.organizationId}:${props.quoteVersionId}`} {...props}/>;
}
function SelectedQuoteIdentityDisclosure(props:{quoteVersionId:string;organizationId:string;locale:Locale}){
  const[opened,setOpened]=useState(false);
  return <details className="rounded-xl border p-3" onToggle={event=>{if(event.currentTarget.open)setOpened(true);}}><summary className="min-h-11 cursor-pointer">{props.locale==="ar"?"مراجعة هويات العرض المختار وإعادة تأكيدها":"Examiner et reconfirmer les identités du devis retenu"}</summary>{opened?<SelectedQuoteIdentityScope {...props}/>:null}</details>;
}
function SelectedQuoteIdentityScope({quoteVersionId,organizationId,locale}:{quoteVersionId:string;organizationId:string;locale:Locale}){
  const tr=(fr:string,ar:string)=>locale==="ar"?ar:fr;
  const[context,setContext]=useState<SelectedQuoteIdentityContext|null>(null),[page,setPage]=useState(1),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const sequence=useRef(0),mounted=useRef(true),commandKeys=useRef(new Map<string,{idempotencyKey:string;correlationId:string}>());
  const load=useCallback(async()=>{
    const request=++sequence.current;setLoading(true);
    try{const value=await loadSelectedQuoteIdentity(quoteVersionId,organizationId,page);if(mounted.current&&request===sequence.current){setContext(value);setError("");}}
    catch(e){if(mounted.current&&request===sequence.current)setError(reconfirmationError(e instanceof Error?e.message:String(e),locale));}
    finally{if(mounted.current&&request===sequence.current)setLoading(false);}
  },[quoteVersionId,organizationId,page,locale]);
  const invalidate=useCallback(()=>{sequence.current++;},[]);
  useEffect(()=>{mounted.current=true;void Promise.resolve().then(load);return()=>{mounted.current=false;invalidate();};},[load,invalidate]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!context||busy||loading||!context.can_propose_provider||context.blocked_reasons.length)return;
    const form=new FormData(event.currentTarget),registeredAddress=String(form.get("registeredAddress")??""),reason=String(form.get("reason")??"");
    const signature=JSON.stringify([quoteVersionId,context.context_hash,registeredAddress.trim(),reason.trim()]);
    if(!commandKeys.current.has(signature))commandKeys.current.set(signature,{idempotencyKey:crypto.randomUUID(),correlationId:crypto.randomUUID()});
    setBusy(true);setError("");setNotice("");
    try{await proposeSelectedQuoteIdentity({quoteVersionId,contextHash:context.context_hash,registeredAddress,reason,confirmed:form.get("confirmed")==="yes",...commandKeys.current.get(signature)!});
      if(!mounted.current)return;setNotice(tr("Proposition enregistrée, en attente d’une décision distincte du Client. Le devis retenu et ses conditions restent conservés.","سجل المقترح وينتظر قرارا مستقلا من العميل. يظل العرض المختار وشروطه محفوظين."));await load();
    }catch(e){if(mounted.current)setError(reconfirmationError(e instanceof Error?e.message:String(e),locale));}
    finally{if(mounted.current)setBusy(false);}
  }
  const effective=context?.effective_proposal;
  return <section className="grid gap-4 rounded-xl border p-4" aria-label={tr("Identités du devis retenu","هويات العرض المختار")} dir={locale==="ar"?"rtl":"ltr"}>
    <h3>{tr("Reconfirmer les identités du devis retenu","إعادة تأكيد هويات العرض المختار")}</h3>
    <p>{tr("Une identité actualisée est une proposition séparée, soumise au Client. Les prix, prestations et décisions du devis retenu restent inchangés.","الهوية المحدثة مقترح منفصل يعرض على العميل. تبقى أسعار العرض المختار وخدماته وقراراته محفوظة.")}</p>
    <button type="button" className="min-h-11 rounded border px-3" disabled={busy||loading} onClick={()=>void load()}>{tr("Actualiser les identités et décisions","تحديث الهويات والقرارات")}</button>
    {loading?<p role="status">{tr("Chargement du contexte vérifié…","جار تحميل السياق المتحقق منه…")}</p>:null}
    {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
    {context?<>
      <div className="grid gap-3 md:grid-cols-2"><ReconfirmationPartyCard party={context.current_client_party} locale={locale} label={tr("Client actuel vérifié","العميل الحالي المتحقق منه")}/><ReconfirmationPartyCard party={context.provider_party_base} address={context.canonical_provider_address} locale={locale} label={tr("Prestataire actuel à confirmer","مقدم الخدمات الحالي للتأكيد")}/></div>
      <p>{tr("Adresse du devis initial","عنوان العرض الأصلي")} : {context.previous_provider_address??"—"}</p>
      {context.original_provider_current?<p>{tr("L’identité d’origine du prestataire correspond encore au contexte courant.","ما زالت الهوية الأصلية لمقدم الخدمات تطابق السياق الحالي.")}</p>:<p>{tr("L’identité d’origine doit être reconfirmée avant un nouvel engagement.","يلزم إعادة تأكيد الهوية الأصلية قبل التزام جديد.")}</p>}
      {context.blocked_reasons.length?<div role="status"><ul>{context.blocked_reasons.map(code=><li key={code}>{blockLabel(code,locale)}</li>)}</ul><Link className="underline" href={`/${locale}/sous-traitant/qualification?organizationId=${encodeURIComponent(organizationId)}`}>{tr("Consulter la qualification de cette organisation","مراجعة تأهيل هذه الجهة")}</Link></div>:null}
      {effective?<article className="rounded border p-3"><h4>{tr("Accord Client actuellement applicable","اتفاق العميل الساري حاليا")}</h4><ReconfirmationPartyCard party={effective.client_party} label={tr("Client confirmé","العميل المؤكد")} locale={locale}/><ReconfirmationPartyCard party={effective.provider_party} label={tr("Prestataire confirmé","مقدم الخدمات المؤكد")} locale={locale}/><p>{effective.decision_reason}</p></article>:null}
      {context.can_propose_provider?<ReconfirmationProposalForm key={context.context_hash} context={context} locale={locale} busy={busy} loading={loading} onSubmit={submit}/>:<p>{tr("Seuls le propriétaire ou le gestionnaire du Prestataire peuvent proposer cette reconfirmation avec une authentification renforcée.","يمكن فقط لمالك مقدم الخدمات أو مديره اقتراح إعادة التأكيد بمصادقة معززة.")}</p>}
      <h4>{tr("Historique des propositions","سجل المقترحات")}</h4>
      {context.proposals.length?<ol className="grid gap-3">{context.proposals.map(proposal=><li key={proposal.id} className="rounded border p-3"><p>{proposal.provider_reason}</p><p>{proposal.effective?tr("Accord actuellement applicable","اتفاق سار حاليا"):proposal.decision==="ACCEPT"?tr("Accord historique","اتفاق سابق"):proposal.decision==="DECLINE"?tr("Refus du Client","رفض العميل"):proposal.current?tr("En attente du Client","في انتظار العميل"):tr("Contexte remplacé : nouvelle proposition nécessaire","استبدل السياق: يلزم مقترح جديد")}</p><ReconfirmationPartyCard party={proposal.client_party} label={tr("Client proposé","العميل المقترح")} locale={locale}/><ReconfirmationPartyCard party={proposal.provider_party} label={tr("Prestataire proposé","مقدم الخدمات المقترح")} locale={locale}/>{proposal.decision_reason?<p>{proposal.decision_reason}</p>:null}<p>{tr("Proposée le (UTC)","تاريخ الاقتراح (UTC)")} : <time>{proposal.proposed_at.replace("T"," ")}</time></p></li>)}</ol>:<p>{tr("Aucune proposition enregistrée.","لا يوجد مقترح مسجل.")}</p>}
      <nav className="flex flex-wrap gap-3" aria-label={tr("Pages des propositions","صفحات المقترحات")}><button className="min-h-11 rounded border px-3" type="button" disabled={page===1||busy||loading} onClick={()=>setPage(page-1)}>{tr("Précédent","السابق")}</button><span>{context.page} · {context.total}</span><button className="min-h-11 rounded border px-3" type="button" disabled={!context.has_next||busy||loading} onClick={()=>setPage(page+1)}>{tr("Suivant","التالي")}</button></nav>
    </>:null}
  </section>;
}

export function ReconfirmationProposalForm({context,locale,busy,loading,onSubmit}:{context:SelectedQuoteIdentityContext;locale:Locale;busy:boolean;loading:boolean;onSubmit:(event:FormEvent<HTMLFormElement>)=>void}){
  const tr=(fr:string,ar:string)=>locale==="ar"?ar:fr;
  return <form key={context.context_hash} onSubmit={onSubmit} className="grid gap-3">
        <label>{tr("Adresse contractuelle à confirmer","العنوان التعاقدي للتأكيد")}<textarea name="registeredAddress" className="block w-full rounded border p-2" required minLength={5} maxLength={1000} readOnly={Boolean(context.canonical_provider_address)} defaultValue={context.canonical_provider_address??""}/></label>
        {context.canonical_provider_address?<small>{tr("Adresse juridique approuvée. Toute correction passe par sa revue.","عنوان قانوني معتمد. أي تصحيح يمر بمراجعته.")}</small>:null}
        <label>{tr("Motif de la reconfirmation","سبب إعادة التأكيد")}<textarea name="reason" className="block w-full rounded border p-2" required minLength={10} maxLength={1000}/></label>
        <label><input type="checkbox" name="confirmed" value="yes" required/> {tr("J’ai examiné les deux identités affichées et je confirme l’adresse du Prestataire pour cette proposition.","راجعت الهويتين المعروضتين وأؤكد عنوان مقدم الخدمات لهذا المقترح.")}</label>
        <button className="min-h-11 rounded border px-3" disabled={busy||loading||context.blocked_reasons.length>0}>{busy?tr("Enregistrement…","جار التسجيل…"):tr("Proposer ces identités au Client","اقتراح هذه الهويات على العميل")}</button>
      </form>;
}
