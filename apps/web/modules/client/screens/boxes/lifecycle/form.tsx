"use client";
import{useActionState,useId}from"react";
import { workspaceSecurityHref } from "@/modules/shared/lib/auth/security-href";
import Link from"next/link";
import{benefitLifecycleAction}from"./actions";
import type{MemberBoxActionState}from"../member/model";
import type{LifecycleMessages}from"./messages";
const idle:MemberBoxActionState={status:"idle"};
export function LifecycleForm({locale,operation,fields,label,keyValue,aal2,m,organizationId}:{locale:"fr"|"ar";operation:"join"|"confirm"|"cancel"|"execute"|"expire";fields:Record<string,string>;label:string;keyValue:string;aal2:boolean;m:LifecycleMessages;organizationId?:string}){
 const[state,action,pending]=useActionState(benefitLifecycleAction,idle),id=useId();
 return <form action={action}className="mt-3 grid gap-3 rounded border p-4"><input type="hidden"name="locale"value={locale}/><input type="hidden"name="operation"value={operation}/><input type="hidden"name="idempotencyKey"value={keyValue}/>{Object.entries(fields).map(([name,value])=><input key={name}type="hidden"name={name}value={value}/>)}{operation==="join"?<label htmlFor={`${id}-units`}>{m.units}<input id={`${id}-units`}className="min-h-11 w-full rounded border bg-background px-3"name="units"inputMode="numeric"pattern="[1-9][0-9]{0,17}"defaultValue="1"required/></label>:null}{operation==="confirm"?<label htmlFor={`${id}-date`}>{m.expires}<input id={`${id}-date`}className="min-h-11 w-full rounded border bg-background px-3"name="expiresAt"type="datetime-local"required/></label>:null}<button className="min-h-11 rounded border px-4 py-2 disabled:opacity-50"disabled={!aal2||pending}>{pending?m.pending:label}</button><div aria-live="polite">{state.status==="success"?<p role="status">{m.success}</p>:state.status==="error"?<p role="alert">{m.errors[state.reason]}</p>:null}{state.status==="error"&&state.reason==="MFA_REQUIRED"?<Link className="underline"href={workspaceSecurityHref(locale,`/${locale}/client/avantages/execution`,organizationId)}>{m.security}</Link>:null}</div></form>;
}
