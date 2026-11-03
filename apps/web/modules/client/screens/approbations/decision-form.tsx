"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/modules/shared/ui/button";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { decideClientApproval, type ApprovalActionState } from "./actions";
import type { ApprovalMessages } from "./messages";
import type { ClientApprovalRequest } from "./model";

const idle: ApprovalActionState = { status: "idle" };

export function ApprovalDecisionForm({
  item,
  locale,
  messages,
  idempotencyKey,
}: {
  item: ClientApprovalRequest;
  locale: Locale;
  messages: ApprovalMessages;
  idempotencyKey: string;
}) {
  const [key] = useState(idempotencyKey);
  const [state, action, pending] = useActionState(decideClientApproval, idle);
  const feedback = state.status === "success" ? messages.success : state.status === "error" ? messages[state.reason === "VALIDATION" ? "validation" : state.reason === "UNAUTHENTICATED" ? "unauthenticated" : state.reason === "MFA_REQUIRED" ? "mfa" : state.reason === "FORBIDDEN" ? "forbidden" : state.reason === "CONFLICT" ? "conflict" : "failed"] : "";
  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="approvalRequestId" value={item.id} />
      <input type="hidden" name="rowVersion" value={item.rowVersion} />
      <input type="hidden" name="idempotencyKey" value={key} />
      <label className="block sm:col-span-2" htmlFor={`${item.id}-reason`}>
        <span className="mb-1 block font-medium">{messages.reason}</span>
        <textarea id={`${item.id}-reason`} name="reason" required minLength={3} maxLength={1000} rows={3} className="min-h-24 w-full rounded-md border bg-background p-3" />
      </label>
      <label className="block" htmlFor={`${item.id}-decision`}>
        <span className="mb-1 block font-medium">{messages.status}</span>
        <select id={`${item.id}-decision`} name="decision" required className="min-h-11 w-full rounded-md border bg-background px-3">
          <option value="APPROVE">{messages.approve}</option>
          <option value="REJECT">{messages.reject}</option>
        </select>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? messages.pending : messages.submit}</Button>
      <p role={state.status === "error" ? "alert" : "status"} className={`sm:col-span-2 min-h-5 text-sm ${state.status === "error" ? "text-destructive" : "text-primary"}`}>{feedback}</p>
      <p className="sm:col-span-2 text-sm text-muted-foreground">{messages.mfaRequired}</p>
      <Link href={`/${locale}/securite/compte`} className="underline sm:col-span-2">{messages.security}</Link>
    </form>
  );
}
