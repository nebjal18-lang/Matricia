"use client";
import {useActionState} from "react";
import { workspaceSecurityHref } from "@/modules/shared/lib/auth/security-href";
import Link from "next/link";
import {Button} from "@/modules/shared/ui/button";
import type {Locale} from "@/modules/shared/lib/i18n/locale";
import type {ClientApprovalRequest} from "./model";
import type {ApprovalMessages} from "./messages";
import{resumeClientCommitment,type ResumeState}from"./resume-actions";
const idle:ResumeState={status:"idle"};
export function ApprovalResumeForm({item,locale,messages:m,organizationId}:{item:ClientApprovalRequest;locale:Locale;messages:ApprovalMessages;organizationId?:string|null}){
 const[state,action,pending]=useActionState(resumeClientCommitment,idle);
 const message=state.status==="completed"?m.commandCompleted:state.status==="pending"?m.commandPending:state.status==="error"?state.reason==="MFA_REQUIRED"?m.mfa:state.reason==="CONFLICT"?m.commandStale:state.reason==="FORBIDDEN"?m.forbidden:state.reason==="UNAUTHENTICATED"?m.unauthenticated:state.reason==="VALIDATION"?m.validation:m.failed:"";
 return<form action={action} className="my-3 space-y-3"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="approvalRequestId" value={item.id}/><input type="hidden" name="rowVersion" value={item.rowVersion}/><Button disabled={pending||state.status==="completed"}>{pending?m.pending:m.resumeCommand}</Button><p role={state.status==="error"?"alert":"status"} aria-live="polite">{message}</p>{state.status==="error"&&state.reason==="MFA_REQUIRED"?<Link className="underline" href={workspaceSecurityHref(locale,`/${locale}/client/actions`,organizationId)}>{m.security}</Link>:null}</form>;
}
