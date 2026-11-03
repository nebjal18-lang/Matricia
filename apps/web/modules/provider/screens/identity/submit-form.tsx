"use client";
import { useActionState, useId } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { submitProviderLegalIdentity } from "./actions";
import { providerIdentityMessages } from "./messages";
import type { IdentitySubmitState } from "./model";
export function ProviderIdentitySubmitForm({ organizationId, version, locale, requestKey }: { organizationId: string; version: number; locale: Locale; requestKey: string }) {
  const [state, action, pending] = useActionState(submitProviderLegalIdentity, { status: "idle" } as IdentitySubmitState), id = useId(), m = providerIdentityMessages(locale);
  return <form action={action} className="client-stack"><input type="hidden" name="organizationId" value={organizationId}/><input type="hidden" name="expectedProfileVersion" value={version}/><input type="hidden" name="locale" value={locale}/><input type="hidden" name="idempotencyKey" value={requestKey}/><label htmlFor={id} className="flex min-h-11 items-start gap-3"><input id={id} type="checkbox" name="confirmed" value="yes" required/>{m.confirm}</label><button className="client-primary-btn min-h-11" disabled={pending}>{pending ? m.pending : m.review}</button><p role={state.status === "error" ? "alert" : "status"} aria-live="polite">{state.status === "success" ? m.sent : state.status === "error" ? m.errors[state.reason] : ""}</p></form>;
}
