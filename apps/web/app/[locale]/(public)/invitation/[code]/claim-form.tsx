"use client";
import {useActionState} from "react";
import {claimReferral,type ClaimState} from "./actions";
import type {ReferralClaimMessages} from "./messages";
const idle:ClaimState={status:"idle"};
export function ReferralClaimForm({locale,code,organizations,idempotencyKey,m}:{locale:"fr"|"ar";code:string;organizations:{id:string;name:string}[];idempotencyKey:string;m:ReferralClaimMessages}){
 const[state,action,pending]=useActionState(claimReferral,idle);
 return <form action={action} className="grid gap-5"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="referralCode" value={code}/><input type="hidden" name="idempotencyKey" value={idempotencyKey}/><label>{m.organization}<select name="organizationId" required className="mt-2 min-h-11 w-full rounded border bg-background px-3"><option value=""/>{organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label><label className="flex items-start gap-3"><input name="consent" type="checkbox" required className="mt-1 size-5 shrink-0"/><span>{m.consent}</span></label><button type="submit" disabled={pending||state.status==="success"} className="min-h-11 rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-60">{pending?m.pending:m.submit}</button><p role={state.status==="error"?"alert":"status"} aria-live="polite">{state.status==="success"?m.success:state.status==="error"?state.reason==="VALIDATION"?m.invalid:state.reason==="DENIED"?m.denied:m.failed:""}</p></form>;
}
