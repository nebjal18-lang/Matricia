"use client";

import { useActionState, useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { CatalogEntityStatus } from "@/modules/shared/lib/catalogue-builder/model";
import { addReleaseItemAction, createReleaseAction, submitReleaseAction, type BuilderActionState } from "./actions";
import type { BuilderMessages } from "./messages";
import { usePersistentCommandIdentity } from "./use-command-identity";

const initialState: BuilderActionState = { status: "idle" };

function ActionStatus({ state, messages, id }: { state: BuilderActionState; messages: BuilderMessages; id: string }) {
  if (state.status === "error") {
    const key = state.reason === "VALIDATION" ? "validation" : state.reason.toLowerCase() as "unauthenticated" | "forbidden" | "unavailable";
    return <p id={id} role="alert" aria-live="polite" className="min-h-6 text-sm text-destructive">{messages.errors[key]}</p>;
  }
  if (state.status === "success") {
    const message = state.operation === "CREATED" ? messages.successCreated : state.operation === "ITEM_ADDED" ? messages.successAdded : messages.successSubmitted;
    return (
      <div id={id} role="status" aria-live="polite" className="min-h-6 space-y-1 text-sm text-primary">
        <p>{message}</p>
        {state.releaseStatus ? <p>{messages.resultStatus}: {messages.releaseStatuses[state.releaseStatus]}</p> : null}
      </div>
    );
  }
  return <p id={id} role="status" aria-live="polite" className="min-h-6" />;
}

function Confirmation({ name, children }: { name: string; children: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm leading-5">
      <input className="mt-0.5 size-5 shrink-0 accent-primary" type="checkbox" name={name} value="yes" required />
      <span>{children}</span>
    </label>
  );
}

function TechnicalInput({ id, name, label, defaultValue, pattern, type = "text", min }: {
  id: string; name: string; label: string; defaultValue?: string; pattern?: string; type?: "text" | "number"; min?: number;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} min={min} defaultValue={defaultValue} pattern={pattern} required autoComplete="off" dir="ltr" className="min-h-11 font-mono text-sm" />
    </div>
  );
}

export function ReleaseWorkflow({ locale, library, service, draftReleases, approvedVersions, messages, commandIdentities }: {
  locale: Locale;
  library: { id: string; code: string; rowVersion: number; status: CatalogEntityStatus };
  service: { id: string; code: string; status: CatalogEntityStatus };
  draftReleases: Array<{ id: string; key: string }>;
  approvedVersions: Array<{ id: string; version: number; nameFr: string; nameAr: string }>;
  messages: BuilderMessages;
  commandIdentities: {
    create: { idempotencyKey: string; correlationId: string };
    add: { idempotencyKey: string; correlationId: string };
    submit: { idempotencyKey: string; correlationId: string };
  };
}) {
  const [createState, createAction, creating] = useActionState(createReleaseAction, initialState);
  const [addState, addAction, adding] = useActionState(addReleaseItemAction, initialState);
  const [submitState, submitAction, submitting] = useActionState(submitReleaseAction, initialState);
  const prefix = useId();
  const [createIdempotencyRef, createCorrelationRef, prepareCreate] = usePersistentCommandIdentity("CREATE_RELEASE", createState.status === "success" && createState.operation === "CREATED", commandIdentities.create);
  const [addIdempotencyRef, addCorrelationRef, prepareAdd] = usePersistentCommandIdentity("ADD_RELEASE_ITEM", addState.status === "success" && addState.operation === "ITEM_ADDED", commandIdentities.add);
  const [submitIdempotencyRef, submitCorrelationRef, prepareSubmit] = usePersistentCommandIdentity("SUBMIT_RELEASE", submitState.status === "success" && submitState.operation === "SUBMITTED", commandIdentities.submit);

  return (
    <section aria-labelledby={`${prefix}-title`} className="space-y-5">
      <div>
        <h2 id={`${prefix}-title`} className="text-2xl font-semibold tracking-tight">{messages.releaseTitle}</h2>
        <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">{messages.releaseDescription}</p>
        <p className="mt-2 break-words text-sm font-medium">{messages.selectedContext}: <bdi dir="ltr" className="font-mono">{library.code}</bdi> — {messages.entityStatuses[library.status]} / <bdi dir="ltr" className="font-mono">{service.code}</bdi> — {messages.entityStatuses[service.status]}</p>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle><h3>{messages.createTitle}</h3></CardTitle><CardDescription><bdi dir="ltr" className="font-mono">{library.code}</bdi> — {messages.entityStatuses[library.status]}</CardDescription></CardHeader>
          <CardContent>
            <form action={createAction} onSubmitCapture={prepareCreate} aria-describedby={`${prefix}-create-status`} className="space-y-4">
              <input type="hidden" name="locale" value={locale} /><input type="hidden" name="libraryId" value={library.id} /><input type="hidden" name="expectedLibraryRowVersion" value={library.rowVersion} />
              <input ref={createIdempotencyRef} type="hidden" name="idempotencyKey" defaultValue={commandIdentities.create.idempotencyKey} /><input ref={createCorrelationRef} type="hidden" name="correlationId" defaultValue={commandIdentities.create.correlationId} />
              <TechnicalInput id={`${prefix}-release-key`} name="releaseKey" label={messages.releaseKey} pattern="[A-Z][A-Z0-9_.-]{2,119}" />
              <div className="min-w-0 space-y-2"><Label htmlFor={`${prefix}-source-note`}>{locale === "ar" ? "مصدر ومحتوى الإصدار" : "Source et contenu de la publication"}</Label><Input id={`${prefix}-source-note`} name="sourceNote" required minLength={3} maxLength={500} className="min-h-11" /></div>
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-approval`}>{messages.centralApproval}</Label>
                <select id={`${prefix}-approval`} name="requiresCentralApproval" defaultValue="yes" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="yes">{messages.approvalYes}</option><option value="no">{messages.approvalNo}</option>
                </select>
              </div>
              <Confirmation name="confirmed">{messages.confirmCreate}</Confirmation>
              <Button type="submit" className="min-h-11 w-full" disabled={creating}>{creating ? messages.creating : messages.create}</Button>
              <ActionStatus state={createState} messages={messages} id={`${prefix}-create-status`} />
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><h3>{messages.addTitle}</h3></CardTitle><CardDescription><bdi dir="ltr" className="font-mono">{service.code}</bdi> — {messages.entityStatuses[service.status]}</CardDescription></CardHeader>
          <CardContent>
            <form action={addAction} onSubmitCapture={prepareAdd} aria-describedby={`${prefix}-add-status`} className="space-y-4">
              <input type="hidden" name="locale" value={locale} /><input ref={addIdempotencyRef} type="hidden" name="idempotencyKey" defaultValue={commandIdentities.add.idempotencyKey} /><input ref={addCorrelationRef} type="hidden" name="correlationId" defaultValue={commandIdentities.add.correlationId} />
              <div className="space-y-2"><Label htmlFor={`${prefix}-add-release`}>{messages.releaseId}</Label><select id={`${prefix}-add-release`} name="releaseId" required defaultValue="" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"><option value="" disabled>{locale === "ar" ? "اختر مسودة الإصدار" : "Choisir une publication en brouillon"}</option>{draftReleases.map(release => <option key={release.id} value={release.id}>{release.key}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor={`${prefix}-approved-version`}>{locale === "ar" ? "النسخة المعتمدة" : "Version approuvée"}</Label><select id={`${prefix}-approved-version`} name="versionId" required defaultValue="" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"><option value="" disabled>{locale === "ar" ? "اختر نسخة" : "Choisir une version"}</option>{approvedVersions.map(version => <option key={version.id} value={version.id}>{locale === "ar" ? version.nameAr : version.nameFr} · v{version.version}</option>)}</select></div>
              <Confirmation name="confirmed">{messages.confirmAdd}</Confirmation>
              <Button type="submit" className="min-h-11 w-full" disabled={adding || draftReleases.length === 0 || approvedVersions.length === 0}>{adding ? messages.adding : messages.add}</Button>
              <ActionStatus state={addState} messages={messages} id={`${prefix}-add-status`} />
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><h3>{messages.submitTitle}</h3></CardTitle><CardDescription>{messages.releaseDescription}</CardDescription></CardHeader>
          <CardContent>
            <form action={submitAction} onSubmitCapture={prepareSubmit} aria-describedby={`${prefix}-submit-status`} className="space-y-4">
              <input type="hidden" name="locale" value={locale} /><input ref={submitIdempotencyRef} type="hidden" name="idempotencyKey" defaultValue={commandIdentities.submit.idempotencyKey} /><input ref={submitCorrelationRef} type="hidden" name="correlationId" defaultValue={commandIdentities.submit.correlationId} />
              <div className="space-y-2"><Label htmlFor={`${prefix}-submit-release`}>{messages.releaseId}</Label><select id={`${prefix}-submit-release`} name="releaseId" required defaultValue="" className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2"><option value="" disabled>{locale === "ar" ? "اختر مسودة الإصدار" : "Choisir une publication en brouillon"}</option>{draftReleases.map(release => <option key={release.id} value={release.id}>{release.key}</option>)}</select></div>
              <Confirmation name="confirmed">{messages.confirmSubmit}</Confirmation>
              <Button type="submit" className="min-h-11 w-full" disabled={submitting || draftReleases.length === 0}>{submitting ? messages.submitting : messages.submit}</Button>
              <ActionStatus state={submitState} messages={messages} id={`${prefix}-submit-status`} />
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
