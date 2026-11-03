"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { getDictionary } from "@/modules/shared/lib/i18n/dictionaries";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { createOrRequestOrganization, type OrganizationActionState, type OrganizationField } from "./actions";

const initialState: OrganizationActionState = { status: "idle" };
const roleCodes = ["CLIENT_OWNER", "PROVIDER_OWNER", "FRANCHISE_OWNER"] as const;

function SubmitButton({ pendingLabel, submitLabel }: { pendingLabel: string; submitLabel: string }) {
  const { pending } = useFormStatus();
  return <Button className="min-h-11 w-full" type="submit" disabled={pending} aria-describedby="organization-form-status">{pending ? pendingLabel : submitLabel}</Button>;
}

export function OrganizationForm({ locale, idempotencyKey, defaultRole = "CLIENT_OWNER", returnTo = null }: { locale: Locale; idempotencyKey: string; defaultRole?: (typeof roleCodes)[number]; returnTo?: string | null }) {
  const messages = getDictionary(locale).organization;
  const [state, formAction] = useActionState(createOrRequestOrganization, initialState);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "success") resultRef.current?.focus();
  }, [state]);

  if (state.status === "success") {
    const created = state.outcome === "ORGANIZATION_CREATED";
    return (
      <div ref={resultRef} tabIndex={-1} role="status" className="space-y-5 rounded-xl border border-primary/25 bg-primary/5 p-5 outline-none sm:p-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{created ? messages.createdTitle : messages.requestedTitle}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{created ? messages.createdDescription : messages.requestedDescription}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {!created?<Button asChild><Link href={`/${locale}/organisation/rattachements`}>{locale==="fr"?"Suivre ma demande de rattachement":"متابعة طلب الانضمام"}</Link></Button>:null}
          {created && defaultRole === "CLIENT_OWNER" && returnTo ? (
            <Button asChild><Link href={returnTo}>{messages.resumeDiagnostic}</Link></Button>
          ) : created && defaultRole === "CLIENT_OWNER" ? (
            <Button asChild><Link href={`/${locale}/client/onboarding`}>{messages.continueOnboarding}</Link></Button>
          ) : (
            <Button asChild><Link href={`/${locale}/tableau-de-bord`}>{messages.backToDashboard}</Link></Button>
          )}
          <Button asChild variant="outline"><Link href={`/${locale}/organisation`}>{messages.submitAnother}</Link></Button>
        </div>
      </div>
    );
  }

  const fieldErrors = state.status === "error" && state.reason === "VALIDATION" ? state.fieldErrors : {};
  const errorMessage = state.status === "error" && state.reason !== "VALIDATION"
    ? state.reason === "UNAUTHENTICATED" ? messages.errors.unauthenticated
      : state.reason === "ALREADY_MEMBER" ? messages.errors.alreadyMember
        : state.reason === "IDEMPOTENCY_MISMATCH" ? messages.errors.idempotency
          : state.reason === "FRANCHISE_MANDATE_REQUIRED" ? (locale==="fr"?"Le rattachement Franchisé exige un mandat approuvé avec son périmètre de bibliothèque. Contactez votre interlocuteur Matricia pour cette revue.":"يتطلب الانضمام بصفة صاحب امتياز تفويضاً معتمداً يحدد نطاق المكتبة. تواصلوا مع مسؤول Matricia لمراجعة الطلب.") : messages.errors.generic
    : null;
  const describedBy = (field: OrganizationField, hintId: string) => fieldErrors[field] ? `${hintId} ${field}-error` : hintId;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="space-y-2">
        <Label htmlFor="legalName">{messages.legalNameLabel}</Label>
        <Input id="legalName" name="legalName" minLength={2} maxLength={200} autoComplete="organization" required aria-invalid={Boolean(fieldErrors.legalName)} aria-describedby={describedBy("legalName", "legalName-hint")} aria-errormessage={fieldErrors.legalName ? "legalName-error" : undefined} />
        <p id="legalName-hint" className="text-xs text-muted-foreground">{messages.legalNameHint}</p>
        {fieldErrors.legalName ? <p id="legalName-error" className="text-sm text-destructive">{messages.errors.legalName}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">{messages.displayNameLabel}</Label>
        <Input id="displayName" name="displayName" minLength={2} maxLength={200} required aria-invalid={Boolean(fieldErrors.displayName)} aria-describedby={describedBy("displayName", "displayName-hint")} aria-errormessage={fieldErrors.displayName ? "displayName-error" : undefined} />
        <p id="displayName-hint" className="text-xs text-muted-foreground">{messages.displayNameHint}</p>
        {fieldErrors.displayName ? <p id="displayName-error" className="text-sm text-destructive">{messages.errors.displayName}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ice">{messages.iceLabel}</Label>
        <Input id="ice" name="ice" minLength={8} maxLength={40} autoCapitalize="characters" spellCheck={false} required dir="ltr" className="text-start" aria-invalid={Boolean(fieldErrors.ice)} aria-describedby={describedBy("ice", "ice-hint")} aria-errormessage={fieldErrors.ice ? "ice-error" : undefined} />
        <p id="ice-hint" className="text-xs text-muted-foreground">{messages.iceHint}</p>
        {fieldErrors.ice ? <p id="ice-error" className="text-sm text-destructive">{messages.errors.ice}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerRole">{messages.ownerRoleLabel}</Label>
        <select id="ownerRole" name="ownerRole" defaultValue={defaultRole} required aria-invalid={Boolean(fieldErrors.ownerRole)} aria-describedby={fieldErrors.ownerRole ? "ownerRole-error" : undefined} aria-errormessage={fieldErrors.ownerRole ? "ownerRole-error" : undefined} className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
          {roleCodes.map((role) => <option key={role} value={role}>{messages.roles[role]}</option>)}
        </select>
        {fieldErrors.ownerRole ? <p id="ownerRole-error" className="text-sm text-destructive">{messages.errors.ownerRole}</p> : null}
      </div>
      <SubmitButton pendingLabel={messages.pending} submitLabel={messages.submit} />
      <p id="organization-form-status" role="alert" aria-live="assertive" className="min-h-5 text-sm text-destructive">{errorMessage}</p>
    </form>
  );
}
