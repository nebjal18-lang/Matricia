"use client";

import { useActionState, useId, type ReactNode } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { saveClientProfile, type ClientProfileDraft, type ProfileActionState } from "./actions";
import { formatVersionMessage, type ClientOnboardingMessages } from "./messages";

const initialState: ProfileActionState = { status: "idle" };

export function ClientProfileForm({
  organizationId,
  locale,
  idempotencyKey,
  profile,
  messages,
  saveAction = saveClientProfile,
  expectedProfileVersion,
}: {
  organizationId: string;
  locale: Locale;
  idempotencyKey: string;
  profile: ClientProfileDraft | null;
  messages: ClientOnboardingMessages;
  saveAction?: typeof saveClientProfile;
  expectedProfileVersion?: number;
}) {
  const [state, action, pending] = useActionState(saveAction, initialState);
  const prefix = useId();
  const statusId = `${prefix}-status`;
  const invalid = state.status === "error" && state.reason === "VALIDATION";
  const error = state.status === "error"
    ? state.reason === "VALIDATION" ? messages.profileErrors.validation
      : state.reason === "UNAUTHENTICATED" ? messages.profileErrors.unauthenticated
        : messages.profileErrors.generic
    : null;

  if (state.status === "success") {
    return (
      <div role="status" aria-live="polite" className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p>{formatVersionMessage(messages.saved, state.profileVersion)}</p>
        <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => window.location.reload()}>
          {messages.createAnotherVersion}
        </Button>
      </div>
    );
  }

  const fieldId = (name: string) => `${prefix}-${name}`;
  return (
    <form action={action} className="space-y-7" aria-describedby={statusId} noValidate>
      <input type="hidden" name="organizationId" value={organizationId} />
      {expectedProfileVersion !== undefined ? <input type="hidden" name="expectedProfileVersion" value={expectedProfileVersion} /> : null}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">{messages.sections.company}</legend>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={fieldId("legal-form")} label={messages.fields.legalForm}>
            <Input id={fieldId("legal-form")} name="legalForm" defaultValue={profile?.legal_form ?? ""} required minLength={2} maxLength={120} aria-invalid={invalid} className="min-h-11" />
          </Field>
          <Field id={fieldId("incorporation-date")} label={messages.fields.incorporationDate}>
            <Input id={fieldId("incorporation-date")} name="incorporationDate" type="date" defaultValue={profile?.incorporation_date ?? ""} required aria-invalid={invalid} className="min-h-11" />
          </Field>
          <Field id={fieldId("sector")} label={messages.fields.sector}>
            <Input id={fieldId("sector")} name="sector" defaultValue={profile?.sector ?? ""} required minLength={2} maxLength={120} aria-invalid={invalid} className="min-h-11" />
          </Field>
          <Field id={fieldId("employee-count")} label={messages.fields.employeeCount}>
            <Input id={fieldId("employee-count")} name="employeeCount" type="number" inputMode="numeric" min={0} max={100000000} step={1} defaultValue={profile?.employee_count ?? ""} required dir="ltr" aria-invalid={invalid} className="min-h-11 text-start" />
          </Field>
          <Field id={fieldId("if-number")} label={messages.fields.ifNumber}>
            <Input id={fieldId("if-number")} name="ifNumber" defaultValue={profile?.if_number ?? ""} required minLength={3} maxLength={40} dir="ltr" spellCheck={false} aria-invalid={invalid} className="min-h-11 text-start uppercase" />
          </Field>
          <Field id={fieldId("rc-number")} label={messages.fields.rcNumber}>
            <Input id={fieldId("rc-number")} name="rcNumber" defaultValue={profile?.rc_number ?? ""} required minLength={3} maxLength={40} dir="ltr" spellCheck={false} aria-invalid={invalid} className="min-h-11 text-start uppercase" />
          </Field>
        </div>
        <Field id={fieldId("activity")} label={messages.fields.activity}>
          <Textarea id={fieldId("activity")} name="activity" defaultValue={profile?.activity ?? ""} required minLength={2} maxLength={500} rows={4} aria-invalid={invalid} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">{messages.sections.address}</legend>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={fieldId("registered-city")} label={messages.fields.registeredCity}>
            <Input id={fieldId("registered-city")} name="registeredCity" defaultValue={profile?.registered_city ?? ""} required minLength={2} maxLength={120} autoComplete="address-level2" aria-invalid={invalid} className="min-h-11" />
          </Field>
          <Field id={fieldId("postal-code")} label={messages.fields.postalCode}>
            <Input id={fieldId("postal-code")} name="postalCode" defaultValue={profile?.registered_address.postal_code ?? ""} maxLength={20} autoComplete="postal-code" dir="ltr" aria-invalid={invalid} className="min-h-11 text-start" />
          </Field>
        </div>
        <Field id={fieldId("address-line1")} label={messages.fields.addressLine1}>
          <Input id={fieldId("address-line1")} name="addressLine1" defaultValue={profile?.registered_address.line1 ?? ""} required minLength={3} maxLength={300} autoComplete="street-address" aria-invalid={invalid} className="min-h-11" />
        </Field>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={fieldId("contact-phone")} label={messages.fields.contactPhone}>
            <Input id={fieldId("contact-phone")} name="contactPhone" type="tel" inputMode="tel" defaultValue={profile?.contact.phone ?? ""} required minLength={6} maxLength={40} autoComplete="tel" dir="ltr" aria-invalid={invalid} className="min-h-11 text-start" />
          </Field>
          <Field id={fieldId("contact-email")} label={messages.fields.contactEmail}>
            <Input id={fieldId("contact-email")} name="contactEmail" type="email" inputMode="email" defaultValue={profile?.contact.email ?? ""} required maxLength={320} autoComplete="email" dir="ltr" spellCheck={false} aria-invalid={invalid} className="min-h-11 text-start" />
          </Field>
        </div>
        <Field id={fieldId("website")} label={messages.fields.website}>
          <Input id={fieldId("website")} name="website" type="url" inputMode="url" defaultValue={profile?.website ?? ""} maxLength={500} autoComplete="url" dir="ltr" spellCheck={false} aria-invalid={invalid} className="min-h-11 text-start" />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">{messages.sections.representative}</legend>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <Field id={fieldId("representative-first-name")} label={messages.fields.representativeFirstName}>
            <Input id={fieldId("representative-first-name")} name="representativeFirstName" defaultValue={profile?.representative.first_name ?? ""} required minLength={2} maxLength={120} autoComplete="given-name" aria-invalid={invalid} className="min-h-11" />
          </Field>
          <Field id={fieldId("representative-last-name")} label={messages.fields.representativeLastName}>
            <Input id={fieldId("representative-last-name")} name="representativeLastName" defaultValue={profile?.representative.last_name ?? ""} required minLength={2} maxLength={120} autoComplete="family-name" aria-invalid={invalid} className="min-h-11" />
          </Field>
          <Field id={fieldId("representative-title")} label={messages.fields.representativeTitle}>
            <Input id={fieldId("representative-title")} name="representativeTitle" defaultValue={profile?.representative.title ?? ""} required minLength={2} maxLength={160} autoComplete="organization-title" aria-invalid={invalid} className="min-h-11" />
          </Field>
          <Field id={fieldId("representative-phone")} label={messages.fields.representativePhone}>
            <Input id={fieldId("representative-phone")} name="representativePhone" type="tel" inputMode="tel" defaultValue={profile?.representative.phone ?? ""} required minLength={6} maxLength={40} autoComplete="tel" dir="ltr" aria-invalid={invalid} className="min-h-11 text-start" />
          </Field>
        </div>
        <Field id={fieldId("representative-email")} label={messages.fields.representativeEmail}>
          <Input id={fieldId("representative-email")} name="representativeEmail" type="email" inputMode="email" defaultValue={profile?.representative.email ?? ""} required maxLength={320} autoComplete="email" dir="ltr" spellCheck={false} aria-invalid={invalid} className="min-h-11 text-start" />
        </Field>
        <Field id={fieldId("representative-power")} label={messages.fields.representativePower}>
          <Textarea id={fieldId("representative-power")} name="representativePower" defaultValue={profile?.representative.power ?? ""} required minLength={2} maxLength={500} rows={3} aria-invalid={invalid} />
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">{messages.sections.declarations}</legend>
        <Consent name="accuracyConfirmed" text={messages.fields.accuracyConfirmed} defaultChecked={profile?.declarations.accuracy_confirmed ?? false} invalid={invalid} />
        <Consent name="representationAuthorized" text={messages.fields.representationAuthorized} defaultChecked={profile?.declarations.representation_authorized ?? false} invalid={invalid} />
      </fieldset>

      <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
        {pending ? messages.saving : messages.save}
      </Button>
      <p id={statusId} role={error ? "alert" : "status"} aria-live="polite" className={error ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-primary"}>{error ?? ""}</p>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Consent({ name, text, defaultChecked, invalid }: { name: string; text: string; defaultChecked: boolean; invalid: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 text-sm leading-6 has-[:checked]:border-primary/60 has-[:checked]:bg-primary/5">
      <input name={name} value="yes" type="checkbox" defaultChecked={defaultChecked} required aria-invalid={invalid} className="mt-0.5 size-5 shrink-0 accent-primary" />
      <span>{text}</span>
    </label>
  );
}
