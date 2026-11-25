"use client";

import { useActionState } from "react";
import { createInvitation, type InvitationActionState } from "@/app/[locale]/invitations/actions";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { StableIdempotencyField } from "@/modules/shared/ui/stable-idempotency-field";

const idle: InvitationActionState = { status: "idle" };

export function MemberInviteForm({
  locale,
  organizationId,
}: {
  locale: Locale;
  organizationId: string | null;
}) {
  const [state, action, pending] = useActionState(createInvitation, idle);
  const c = spaceCopy(locale);
  return (
    <form action={action} className="client-stack">
      <input type="hidden" name="locale" value={locale} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="expiryDays" value="7" />
      <StableIdempotencyField rotateToken={state.status === "success" ? state.status : undefined} />
      <label className="client-field">
        <span>{c.inviteEmail}</span>
        <input id="invite-email" name="invitedEmail" type="email" required autoComplete="email" />
      </label>
      <label className="client-field">
        <span>{c.inviteRole}</span>
        <select id="invite-role" name="roleCodes" defaultValue="CLIENT_MEMBER" required>
          <option value="CLIENT_MEMBER">{locale === "ar" ? "عضو" : "Membre"}</option>
          <option value="CLIENT_VIEWER">{locale === "ar" ? "قراءة فقط" : "Lecture seule"}</option>
          <option value="CLIENT_BUYER">{locale === "ar" ? "مشترٍ" : "Acheteur"}</option>
          <option value="CLIENT_ACCOUNTING">{locale === "ar" ? "محاسبة" : "Comptabilité"}</option>
          <option value="CLIENT_ADMIN">{locale === "ar" ? "مسؤول" : "Administrateur"}</option>
        </select>
      </label>
      <label className="client-field">
        <span>{c.inviteMessage}</span>
        <textarea name="message" rows={3} maxLength={500} />
      </label>
      <p className="client-access-note">{organizationId ? c.inviteNote : c.accessNote}</p>
      <button type="submit" className="client-cta" disabled={pending || !organizationId}>{pending ? c.sendingInvite : c.sendInvite}</button>
      {state.status === "success" ? <p className="admin-banner" data-tone="ok" role="status">{locale === "ar" ? "تم إرسال الدعوة." : "Invitation envoyée."}</p> : null}
      {state.status === "error" ? <p className="admin-banner" data-tone="danger" role="alert">{locale === "ar" ? "تعذر إرسال الدعوة." : "L’invitation n’a pas pu être envoyée."}</p> : null}
    </form>
  );
}
