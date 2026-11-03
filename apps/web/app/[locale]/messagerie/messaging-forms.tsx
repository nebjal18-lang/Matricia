"use client";
import { useActionState, useEffect, useId, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/modules/shared/ui/button";
import { Label } from "@/modules/shared/ui/label";
import type { ThreadOption } from "@/modules/shared/lib/internal-messaging/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { openThreadAction, sendMessageAction, type MessagingActionState } from "./actions";
import type { MessagingMessages } from "./messages";

const idle: MessagingActionState = { status: "idle" };
const control = "min-h-11 w-full rounded-md border bg-background px-3 text-base";
function Feedback({ state, m }: { state: MessagingActionState; m: MessagingMessages }) { const text = state.status === "success" ? (state.outcome === "OPENED" ? m.opened : m.success) : state.status === "error" ? (state.reason === "VALIDATION" ? m.validation : state.reason === "FORBIDDEN" ? m.forbidden : m.failed) : ""; return <p aria-live="polite" role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-primary"}>{text}</p>; }

export function OpenThreadForm({ options, locale, m, successBase, successSuffix, organizationId }: { options: ThreadOption[]; locale: Locale; m: MessagingMessages; successBase?: string; successSuffix?: string; organizationId?: string }) {
  const id = useId(), router = useRouter(), [state, action, pending] = useActionState(openThreadAction, idle), key = useMemo(() => crypto.randomUUID(), []);
  useEffect(() => { if (state.status === "success") router.push(successBase ? `${successBase}/${state.threadId}${successSuffix ?? ""}` : `/${locale}/messagerie?${new URLSearchParams({fil:state.threadId,...(organizationId?{organizationId}:{})})}`); }, [state, router, locale, successBase, successSuffix, organizationId]);
  if (options.length === 0) return null;
  const optionLabel=(option:ThreadOption|undefined)=>!option?"":option.context?`${option.context==="CONTRACT"?(locale==="ar"?"ملف عقد":"Dossier contractuel"):(locale==="ar"?"استشارة":"Consultation")} · ${option.rfqId.slice(0,8).toUpperCase()}`:option.label;
  return <form action={action} className="space-y-3 rounded-xl border bg-card p-4"><h2 className="font-semibold">{m.openTitle}</h2><input type="hidden" name="locale" value={locale}/><input type="hidden" name="idempotencyKey" value={key}/><div><Label htmlFor={`${id}-rfq`}>{locale==="ar"?"الملف المصرح به":"Dossier autorisé"}</Label><select id={`${id}-rfq`} name="option" className={control} onChange={event => { const option = options[Number(event.currentTarget.value)], form = event.currentTarget.form; if (option && form) { (form.elements.namedItem("rfqId") as HTMLInputElement).value = option.rfqId; (form.elements.namedItem("providerOrganizationId") as HTMLInputElement).value = option.providerOrganizationId; } }}><option value="0">{optionLabel(options[0])}</option>{options.slice(1).map((option, index) => <option key={`${option.rfqId}-${option.providerOrganizationId}`} value={index + 1}>{optionLabel(option)}</option>)}</select><input type="hidden" name="rfqId" defaultValue={options[0]?.rfqId}/><input type="hidden" name="providerOrganizationId" defaultValue={options[0]?.providerOrganizationId}/></div><div><Label htmlFor={`${id}-subject`}>{m.subject}</Label><input id={`${id}-subject`} name="subject" required minLength={3} maxLength={160} className={control} aria-describedby={`${id}-help`}/><p id={`${id}-help`} className="mt-1 text-xs text-muted-foreground">{m.subjectHelp}</p></div><Button disabled={pending} className="min-h-11 w-full">{pending ? m.opening : m.open}</Button><Feedback state={state} m={m}/></form>;
}

export function SendMessageForm({ threadId, senderOrganizationId, locale, m, locked }: { threadId: string; senderOrganizationId: string; locale: Locale; m: MessagingMessages; locked: boolean }) {
  const id = useId(), formRef = useRef<HTMLFormElement>(null), [state, action, pending] = useActionState(sendMessageAction, idle), initialKey = useMemo(() => crypto.randomUUID(), []), key = state.status === "success" ? state.nextIdempotencyKey : initialKey;
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state]);
  return <form ref={formRef} action={action} className="space-y-3 border-t pt-4"><input type="hidden" name="locale" value={locale}/><input type="hidden" name="threadId" value={threadId}/><input type="hidden" name="senderOrganizationId" value={senderOrganizationId}/><input type="hidden" name="idempotencyKey" value={key}/><Label htmlFor={`${id}-body`}>{m.message}</Label><textarea id={`${id}-body`} name="body" required maxLength={4000} rows={4} className={`${control} py-3`} aria-describedby={`${id}-help`} disabled={locked}/><p id={`${id}-help`} className="text-xs text-muted-foreground">{locked ? m.locked : m.messageHelp}</p><Button disabled={pending || locked} className="min-h-11 w-full sm:w-auto">{pending ? m.sending : m.send}</Button><Feedback state={state} m={m}/></form>;
}
