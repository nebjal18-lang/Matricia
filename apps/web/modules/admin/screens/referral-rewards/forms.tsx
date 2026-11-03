"use client";
import{useActionState}from"react";
import Link from"next/link";
import type{Locale}from"@/modules/shared/lib/i18n/locale";
import{Button}from"@/modules/shared/ui/button";
import{decideClientReferralReward,executeClientReferralReward}from"./actions";
import type{ReferralRewardActionState,ReferralRewardQueue}from"./model";
import type{ReferralRewardMessages}from"./messages";
const idle:ReferralRewardActionState={status:"idle"};
function Feedback({state,locale,m}:{state:ReferralRewardActionState;locale:Locale;m:ReferralRewardMessages}){
 const text=state.status==="success"?state.kind==="decision"?m.decisionSaved:m.executionSaved:state.status==="error"?m[state.reason==="UNAUTHENTICATED"?"unauthenticated":state.reason==="MFA_REQUIRED"?"mfa":state.reason==="FORBIDDEN"?"forbidden":state.reason==="CONFLICT"?"conflict":state.reason==="VALIDATION"?"validation":"failed"]:"";
 return <div aria-live="polite"><p role={state.status==="error"?"alert":"status"}>{text}</p>{state.status==="error"&&state.reason==="MFA_REQUIRED"?<Link className="underline" href={`/${locale}/securite/compte`}>{m.security}</Link>:null}</div>;
}
export function ReferralRewardDecisionForm({locale,row,keyValue,m}:{locale:Locale;row:ReferralRewardQueue["rows"][number];keyValue:string;m:ReferralRewardMessages}){
 const[state,action,pending]=useActionState(decideClientReferralReward,idle),id=`reward-${row.source_event_id}-${row.rule_version_id}`;
 return <form action={action} className="mt-4 grid gap-3"><input name="locale" type="hidden" value={locale}/><input name="sourceEventId" type="hidden" value={row.source_event_id}/><input name="ruleVersionId" type="hidden" value={row.rule_version_id}/><input name="idempotencyKey" type="hidden" value={keyValue}/><label htmlFor={`${id}-reason`}>{m.reason}</label><textarea id={`${id}-reason`} name="rationale" minLength={10} maxLength={1000} required rows={3} className="w-full rounded border bg-background p-3"/><label><span className="sr-only">{m.decide}</span><select name="decision" required className="min-h-11 rounded border bg-background px-3"><option value="APPROVED">{m.approve}</option><option value="REJECTED">{m.reject}</option></select></label><Button disabled={pending} type="submit">{pending?m.pending:m.decide}</Button><Feedback state={state} locale={locale} m={m}/></form>;
}
export function ReferralRewardExecutionForm({locale,approvalId,keyValue,m}:{locale:Locale;approvalId:string;keyValue:string;m:ReferralRewardMessages}){
 const[state,action,pending]=useActionState(executeClientReferralReward,idle);
 return <form action={action} className="mt-4 space-y-3"><input name="locale" type="hidden" value={locale}/><input name="approvalId" type="hidden" value={approvalId}/><input name="idempotencyKey" type="hidden" value={keyValue}/><Button disabled={pending} type="submit">{pending?m.pending:m.execute}</Button><Feedback state={state} locale={locale} m={m}/></form>;
}
