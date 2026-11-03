"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useId } from "react";
import { Alert, AlertDescription } from "@/modules/shared/ui/alert";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import {
  beginTotpEnrollment,
  requestPasswordNonce,
  setOptionalPassword,
  unenrollTotp,
  verifyTotpEnrollment,
  type AccountSecurityResult,
  type EnrollmentState,
  type PasswordState,
  type UnenrollState,
} from "./actions";
import type { AccountSecurityMessages } from "./messages";

const enrollmentInitial: EnrollmentState = { status: "idle" };
const passwordInitial: PasswordState = { status: "idle" };
const unenrollInitial: UnenrollState = { status: "idle" };

function errorMessage(reason: string, messages: AccountSecurityMessages) {
  if (reason === "VALIDATION") return messages.errors.validation;
  if (reason === "UNAUTHENTICATED") return messages.errors.unauthenticated;
  if (reason === "FACTOR_LIMIT") return messages.errors.alreadyEnrolled;
  if (reason === "AUDIT_PENDING") return messages.errors.auditPending;
  if (reason === "AAL2_REQUIRED") return messages.errors.aal2Required;
  if (reason === "MFA_REQUIRED") return messages.errors.mfaRequired;
  if (reason === "PASSWORD_FORBIDDEN") return messages.passwordForbidden;
  return messages.errors.unavailable;
}

function FactorRemoval({ factorId, locale, messages }: { factorId: string; locale: Locale; messages: AccountSecurityMessages }) {
  const [state, action, pending] = useActionState(unenrollTotp, unenrollInitial);
  const confirmId = useId();
  const statusId = useId();
  const error = state.status === "error" ? errorMessage(state.reason, messages) : null;
  return (
    <form action={action} className="space-y-3" aria-describedby={statusId}>
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="locale" value={locale} />
      <label htmlFor={confirmId} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
        <input id={confirmId} name="confirmed" value="yes" type="checkbox" required className="mt-0.5 size-5 accent-primary" />
        <span>{messages.confirmRemoval}</span>
      </label>
      <Button type="submit" variant="destructive" className="min-h-11 w-full sm:w-auto" disabled={pending}>
        {pending ? messages.removingFactor : messages.removeFactor}
      </Button>
      <p id={statusId} role={error ? "alert" : "status"} aria-live="polite" className={error ? "text-sm text-destructive" : "text-sm text-primary"}>
        {error ?? (state.status === "success" ? messages.factorRemoved : "")}
      </p>
    </form>
  );
}

export function AccountSecurityPanel({ locale, security, messages, nextPath }: { nextPath?: string; locale: Locale; security: Extract<AccountSecurityResult, { status: "success" }>; messages: AccountSecurityMessages }) {
  const router = useRouter();
  const [enrollment, beginAction, beginning] = useActionState(beginTotpEnrollment, enrollmentInitial);
  const [verification, verifyAction, verifying] = useActionState(async (previous: EnrollmentState, form: FormData) => { const result = await verifyTotpEnrollment(previous,form); if (result.status === "success") { if (result.nextPath) router.replace(result.nextPath); router.refresh(); } return result; }, enrollmentInitial);
  const [nonce, nonceAction, requestingNonce] = useActionState(requestPasswordNonce, passwordInitial);
  const [password, passwordAction, savingPassword] = useActionState(setOptionalPassword, passwordInitial);
  const enrollmentStatusId = useId();
  const passwordStatusId = useId();
  const enrollmentError = enrollment.status === "error" ? errorMessage(enrollment.reason, messages) : null;
  const verificationError = verification.status === "error" ? errorMessage(verification.reason, messages) : null;
  const passwordError = password.status === "error" ? errorMessage(password.reason, messages) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{messages.policyTitle}</CardTitle>
          <CardDescription>{security.mfaRequired ? messages.policyRequired : messages.policyOptional}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant={security.requirementSatisfied ? "default" : "destructive"}>
            <AlertDescription>{security.requirementSatisfied ? messages.policySatisfied : messages.policyUnsatisfied}</AlertDescription>
          </Alert>
          {security.matchedRoleCodes.length > 0 ? (
            <div><p className="mb-2 text-sm text-muted-foreground">{messages.matchedRoles}</p><div className="flex flex-wrap gap-2">{security.matchedRoleCodes.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}</div></div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{messages.passwordTitle}</CardTitle><CardDescription>{messages.passwordDescription}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {!security.passwordAllowed ? <Alert variant="destructive"><AlertDescription>{messages.passwordForbidden}</AlertDescription></Alert> : (
            <>
              <form action={nonceAction}>
                <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={requestingNonce}>{requestingNonce ? messages.requestingNonce : messages.requestNonce}</Button>
              </form>
              {nonce.status === "nonce_sent" ? <p role="status" className="text-sm text-primary">{messages.nonceSent}</p> : null}
              <form action={passwordAction} className="space-y-4" aria-describedby={passwordStatusId}>
                <div className="space-y-2"><Label htmlFor="password-nonce">{messages.nonce}</Label><Input id="password-nonce" name="nonce" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required dir="ltr" className="min-h-11" /></div>
                <div className="space-y-2"><Label htmlFor="new-password">{messages.password}</Label><Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} className="min-h-11" /><p className="text-xs text-muted-foreground">{messages.passwordHint}</p></div>
                <div className="space-y-2"><Label htmlFor="password-confirmation">{messages.confirmation}</Label><Input id="password-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={72} className="min-h-11" /></div>
                <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={savingPassword || nonce.status !== "nonce_sent"}>{savingPassword ? messages.savingPassword : messages.savePassword}</Button>
                <p id={passwordStatusId} role={passwordError ? "alert" : "status"} aria-live="polite" className={passwordError ? "text-sm text-destructive" : "text-sm text-primary"}>{passwordError ?? (password.status === "success" ? messages.passwordSaved : "")}</p>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>{messages.mfaTitle}</CardTitle><CardDescription>{messages.mfaDescription}</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <form action={beginAction}>
            <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={beginning}>{beginning ? messages.startingMfa : messages.startMfa}</Button>
          </form>
          {enrollmentError ? <p role="alert" className="text-sm text-destructive">{enrollmentError}</p> : null}
          {enrollment.status === "enrollment" && verification.status !== "success" ? (
            <div className="grid gap-5 rounded-xl border bg-muted/30 p-4 md:grid-cols-[220px_1fr]">
              <div><p className="mb-3 text-sm font-medium">{messages.scanQr}</p><Image src={enrollment.qrCode} alt="QR TOTP" width={220} height={220} unoptimized className="rounded-lg bg-white p-2" /></div>
              <div className="space-y-4">
                <div><p className="text-sm font-medium">{messages.manualSecret}</p><code dir="ltr" className="mt-2 block break-all rounded bg-background p-3 text-sm">{enrollment.secret}</code><p className="mt-2 text-xs text-muted-foreground">{messages.secretWarning}</p></div>
                <form action={verifyAction} className="space-y-3" aria-describedby={enrollmentStatusId}>
                  <input type="hidden" name="next" value={nextPath ?? ""} /><input type="hidden" name="factorId" value={enrollment.factorId} /><input type="hidden" name="locale" value={locale} />
                  <Label htmlFor="totp-code">{messages.totpCode}</Label><Input id="totp-code" name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required dir="ltr" className="min-h-11" />
                  <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={verifying}>{verifying ? messages.verifyingMfa : messages.verifyMfa}</Button>
                  <p id={enrollmentStatusId} role={verificationError ? "alert" : "status"} aria-live="polite" className={verificationError ? "text-sm text-destructive" : "text-sm text-primary"}>{verificationError ?? ""}</p>
                </form>
              </div>
            </div>
          ) : null}
          {verification.status === "success" ? <p role="status">{messages.mfaVerified}</p> : null}
          <section aria-labelledby="configured-factors"><h2 id="configured-factors" className="text-lg font-semibold">{messages.existingFactors}</h2>
            {security.factors.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{messages.noFactors}</p> : <ul className="mt-3 grid gap-4">{security.factors.map((factor) => <li key={factor.id} className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{factor.friendlyName}</p><p className="text-sm text-muted-foreground">{messages.createdAt} {new Intl.DateTimeFormat(locale === "fr" ? "fr-MA" : "ar-MA", { dateStyle: "medium" }).format(new Date(factor.createdAt))}</p></div><Badge variant={factor.status === "verified" ? "default" : "secondary"}>{factor.status === "verified" ? messages.verified : messages.unverified}</Badge></div>{factor.status === "verified" ? <FactorChallenge factorId={factor.id} locale={locale} messages={messages} nextPath={nextPath} /> : null}<FactorRemoval factorId={factor.id} locale={locale} messages={messages} /></li>)}</ul>}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

function FactorChallenge({ factorId, locale, messages, nextPath }: { factorId: string; locale: Locale; messages: AccountSecurityMessages; nextPath?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (previous: EnrollmentState, form: FormData) => {
    const result = await verifyTotpEnrollment(previous,form);
    if (result.status === "success") { if (result.nextPath) router.replace(result.nextPath); router.refresh(); }
    return result;
  }, enrollmentInitial);
  return <form action={action} className="grid gap-3"><input type="hidden" name="factorId" value={factorId}/><input type="hidden" name="locale" value={locale}/><input type="hidden" name="next" value={nextPath ?? ""}/><label htmlFor={`challenge-${factorId}`}>{messages.totpCode}</label><Input id={`challenge-${factorId}`} name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required dir="ltr" className="min-h-11"/><Button disabled={pending}>{pending ? messages.verifyingMfa : messages.verifyMfa}</Button>{state.status === "error" ? <p role="alert">{errorMessage(state.reason,messages)}</p> : state.status === "success" ? <p role="status">{messages.mfaVerified}</p> : null}</form>;
}
