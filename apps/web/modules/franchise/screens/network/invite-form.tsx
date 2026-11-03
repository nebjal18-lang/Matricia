"use client";

import Link from "next/link";
import { NetworkInvitationStatusPanel } from "./invitation-status-panel";
import { networkInvitationCopy } from "./invitation-copy";
import { useActionState, useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { importFranchiseProviders, inviteFranchiseProvider, type FranchiseInviteState } from "./actions";

const idle: FranchiseInviteState = { status: "idle" };
const control = "min-h-11 w-full rounded-md border border-input bg-background px-3";
const sources = {
  fr: [
    { value: "INVITE", label: "Invitation directe" },
    { value: "DIRECT", label: "Contact connu" },
    { value: "REFERRAL", label: "Recommandation" },
    { value: "EVENT", label: "Événement" },
  ],
  ar: [
    { value: "INVITE", label: "دعوة مباشرة" },
    { value: "DIRECT", label: "تواصل معروف" },
    { value: "REFERRAL", label: "توصية" },
    { value: "EVENT", label: "فعالية" },
  ],
} as const;

function Feedback({ state, locale }: { state: FranchiseInviteState; locale: Locale }) {
  const c = franchiseCopy(locale);
  const n = networkInvitationCopy(locale);
  const value = state.status === "success"
    ? `${n.queued} : ${state.created}. ${n.skipped} : ${state.skipped ?? 0}.`
    : state.status === "error"
      ? state.reason === "UNAUTHENTICATED" ? n.session
        : state.reason === "MFA_REQUIRED" ? n.mfa
        : state.reason === "UNAVAILABLE" ? n.unavailable
          : state.reason === "RATE_LIMITED" ? n.rate
            : state.reason === "VALIDATION" ? c.inviteInvalid
        : state.reason === "FORBIDDEN" ? c.inviteForbidden
          : state.reason === "CONFLICT" ? c.inviteConflict
            : c.inviteFailed
      : "";
  return <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-primary"}>{value}</p>;
}

function Hidden({ locale, organizationId, franchiseId, territoryVersionId, ownerUserId, idempotencyKey, prospectType }: { locale: Locale; organizationId: string | null; franchiseId: string; territoryVersionId: string; ownerUserId: string; idempotencyKey: string; prospectType: "CLIENT" | "PROVIDER" }) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="franchiseId" value={franchiseId} />
      <input type="hidden" name="territoryVersionId" value={territoryVersionId} />
      <input type="hidden" name="ownerUserId" value={ownerUserId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="prospectType" value={prospectType} />
    </>
  );
}

export function FranchiseInviteForms({
  locale,
  organizationId,
  franchiseId,
  territoryVersionId,
  ownerUserId,
  keys,
  prospectType = "PROVIDER",
}: {
  locale: Locale;
  organizationId: string | null;
  franchiseId: string;
  territoryVersionId: string;
  ownerUserId: string;
  keys: { invite: string; csv: string };
  prospectType?: "CLIENT" | "PROVIDER";
}) {
  const c = franchiseCopy(locale);
  const prefix = useId();
  const [inviteState, inviteAction, invitePending] = useActionState(inviteFranchiseProvider, idle);
  const [csvState, csvAction, csvPending] = useActionState(importFranchiseProviders, idle);
  const nameLabel = prospectType === "CLIENT" ? c.inviteClientName : c.inviteName;
  const n = networkInvitationCopy(locale);
  const submitLabel = n.submit;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="lg:col-span-2 rounded-md border p-4"><p>{n.explanation}</p><Link className="underline" href={`/${locale}/securite/compte?next=${encodeURIComponent(`/${locale}/franchise/${prospectType === "CLIENT" ? "clients" : "fournisseurs"}/inviter${organizationId ? `?organizationId=${organizationId}` : ""}`)}`}>{n.security}</Link></div>
      <form action={inviteAction} className="franchise-props-form">
        <Hidden locale={locale} organizationId={organizationId} franchiseId={franchiseId} territoryVersionId={territoryVersionId} ownerUserId={ownerUserId} idempotencyKey={keys.invite} prospectType={prospectType} />
        <div>
          <Label htmlFor={`${prefix}-name`}>{nameLabel}</Label>
          <Input id={`${prefix}-name`} name="displayName" required minLength={2} maxLength={200} className={control} />
        </div>
        <div>
          <Label htmlFor={`${prefix}-email`}>{c.inviteEmail}</Label>
          <Input id={`${prefix}-email`} name="contactEmail" type="email" required className={control} dir="ltr" />
        </div>
        <div>
          <Label htmlFor={`${prefix}-org`}>{c.inviteOrg}</Label>
          <Input id={`${prefix}-org`} name="organizationName" maxLength={200} className={control} />
        </div>
        <div>
          <Label htmlFor={`${prefix}-source`}>{c.inviteSource}</Label>
          <select id={`${prefix}-source`} name="sourceCode" defaultValue="INVITE" className={control}>
            {sources[locale].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor={`${prefix}-followup`}>{c.inviteFollowup}</Label>
          <Input id={`${prefix}-followup`} name="nextFollowupAt" type="datetime-local" className={control} />
        </div>
        <InvitationOptions locale={locale} prefix={`${prefix}-single`} />
        <div><Label htmlFor={`${prefix}-phone`}>{n.phone}</Label><Input id={`${prefix}-phone`} name="contactPhone" type="tel" maxLength={40} className={control} dir="ltr" /></div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={invitePending} className="min-h-11">{invitePending ? c.invitePending : submitLabel}</Button>
          <Feedback state={inviteState} locale={locale} />
        </div>
      </form>
      <form action={csvAction} className="franchise-props-form">
        <Hidden locale={locale} organizationId={organizationId} franchiseId={franchiseId} territoryVersionId={territoryVersionId} ownerUserId={ownerUserId} idempotencyKey={keys.csv} prospectType={prospectType} />
        <div className="sm:col-span-2">
          <Label htmlFor={`${prefix}-csv`}>{c.csvLabel}</Label>
          <Textarea id={`${prefix}-csv`} name="csvText" required rows={8} dir="ltr" className="font-mono" placeholder={c.csvPlaceholder} />
        </div>
        <p className="sm:col-span-2 text-sm text-muted-foreground">{c.csvHelp}</p>
        <InvitationOptions locale={locale} prefix={`${prefix}-batch`} />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={csvPending} className="min-h-11">{csvPending ? c.invitePending : n.csv}</Button>
          <Feedback state={csvState} locale={locale} />
        </div>
      </form>
      <NetworkInvitationStatusPanel locale={locale} franchiseId={franchiseId} />
    </div>
  );
}

function InvitationOptions({ locale, prefix }: { locale: Locale; prefix: string }) {
  const n = networkInvitationCopy(locale);
  return <>
    <div><Label htmlFor={`${prefix}-language`}>{n.language}</Label><select id={`${prefix}-language`} name="invitationLocale" defaultValue={locale} className={control}><option value="fr">Français</option><option value="ar">العربية</option></select></div>
    <label className="flex items-start gap-3 sm:col-span-2" htmlFor={`${prefix}-permission`}><input id={`${prefix}-permission`} type="checkbox" name="contactPermissionConfirmed" value="yes" required className="mt-1 size-5 shrink-0" /><span>{n.permission}</span></label>
  </>;
}
