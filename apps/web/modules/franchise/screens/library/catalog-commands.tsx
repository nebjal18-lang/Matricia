"use client";
import { namespacedCommandUuid } from "@/modules/shared/lib/catalogue-builder/namespaced-command-uuid";
import { editorialFailureMessage } from "./command-errors";

import { useActionState, useId } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { Label } from "@/modules/shared/ui/label";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import type { FranchiseCatalogRow, FranchiseCategoryNode, FranchiseLibraryWorkspace } from "@/modules/franchise/data/library/workspace-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import {
  archiveFranchiseCatalogServiceAction,
  cloneFranchiseCatalogQuestionnaireAction,
  createFranchiseCategoryAction,
  createFranchiseSubcategoryAction,
  submitFranchiseHierarchyAction,
  duplicateFranchiseCatalogServiceAction,
  publishFranchiseQuestionnaireAction,
  submitFranchiseCatalogPublicationAction,
  submitFranchiseCatalogQuestionnaireAction,
  submitFranchiseCatalogRuleAction,
  type FranchiseServiceActionState,
} from "./actions";

const initial: FranchiseServiceActionState = { status: "idle" };

function actionMessage(state: FranchiseServiceActionState, locale: Locale, success: string) {
  const c = libraryCopy(locale);
  if (state.status === "error") {
    if (state.reason === "MANDATE_REQUIRED" || state.reason === "UNAUTHENTICATED") return editorialFailureMessage(state.reason,locale);
    if (state.reason === "VALIDATION") return locale === "ar" ? "تحققوا من الحقول الإلزامية." : "Confirmez la soumission pour continuer.";
    if (state.reason === "FORBIDDEN") return c.forbidden;
    if (state.reason === "CONFLICT") return c.conflict;
    if (state.reason === "LOCKED") return c.locked;
    return c.unavailable;
  }
  if (state.status === "success") return success;
  return null;
}

export function FranchiseCatalogSubmitForm({
  locale,
  workspace,
  item,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  workspace: FranchiseLibraryWorkspace;
  item: FranchiseCatalogRow;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const action = item.kind === "RULE" ? submitFranchiseCatalogRuleAction : submitFranchiseCatalogQuestionnaireAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const prefix = useId();
  const submittable = item.kind === "RULE"
    ? item.status === "DRAFT"
    : ["DRAFT", "LOCAL_TEST", "FRANCHISE_REVIEW"].includes(item.status);
  if (!item.draftVersionId || item.identityRowVersion == null || item.versionRowVersion == null) return null;
  if (item.kind === "QUESTIONNAIRE" && item.status === "APPROVED") {
    return <FranchiseQuestionnairePublishForm locale={locale} workspace={workspace} item={item} commandIdentity={commandIdentity} organizationId={organizationId} />;
  }
  if (!submittable) return <p className="client-access-note">{item.status === "PUBLISHED" ? c.publishedImmutable : c.locked}</p>;
  const success = item.kind === "RULE" ? c.ruleSubmitted : c.questionnaireSubmitted;
  return (
    <form action={formAction} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={workspace.mandate.libraryId} />
      <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      {item.kind === "RULE"
        ? <input type="hidden" name="ruleId" value={item.id} />
        : <input type="hidden" name="questionnaireId" value={item.id} />}
      <input type="hidden" name="draftVersionId" value={item.draftVersionId} />
      <input type="hidden" name="identityRowVersion" value={String(item.identityRowVersion)} />
      <input type="hidden" name="versionRowVersion" value={String(item.versionRowVersion)} />
      <input type="hidden" name="idempotencyKey" defaultValue={commandIdentity.idempotencyKey} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.submitMatricia} · {c.scope}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.saveDraft : c.submitMatricia}</Button>
      <div id={`${prefix}-status`} role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {actionMessage(state, locale, success)}
      </div>
    </form>
  );
}

export function FranchisePublishReleaseForm({
  locale,
  workspace,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  workspace: FranchiseLibraryWorkspace;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const [state, action, pending] = useActionState(submitFranchiseCatalogPublicationAction, initial);
  const prefix = useId();
  const ready = workspace.services.some((item) => item.status === "APPROVED");
  const success = state.status === "success" && state.outcome === "IN_REVIEW" ? c.publicationSubmitted : c.publicationScheduled;
  if (!ready) return <p className="client-access-note">{c.noApprovedSnapshot}</p>;
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={workspace.mandate.libraryId} />
      <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="libraryRowVersion" value={String(workspace.mandate.libraryRowVersion)} />
      <input type="hidden" name="idempotencyKey" defaultValue={commandIdentity.idempotencyKey} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.publishConfirm}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.saveDraft : c.publishSnapshot}</Button>
      <div id={`${prefix}-status`} role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {actionMessage(state, locale, success)}
      </div>
    </form>
  );
}

function FranchiseQuestionnairePublishForm({
  locale,
  workspace,
  item,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  workspace: FranchiseLibraryWorkspace;
  item: FranchiseCatalogRow;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const [state, formAction, pending] = useActionState(publishFranchiseQuestionnaireAction, initial);
  const prefix = useId();
  return (
    <form action={formAction} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={workspace.mandate.libraryId} />
      <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="questionnaireId" value={item.id} />
      <input type="hidden" name="draftVersionId" value={item.draftVersionId ?? ""} />
      <input type="hidden" name="versionRowVersion" value={String(item.versionRowVersion ?? 1)} />
      <input type="hidden" name="idempotencyKey" defaultValue={namespacedCommandUuid(commandIdentity.idempotencyKey, "questionnaire-publish")} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.publishConfirm}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.saveDraft : c.publishSnapshot}</Button>
      <div id={`${prefix}-status`} role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {actionMessage(state, locale, c.questionnairePublished)}
      </div>
    </form>
  );
}

export function FranchiseDuplicateServiceForm({
  locale,
  workspace,
  service,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  workspace: FranchiseLibraryWorkspace;
  service: FranchiseCatalogRow;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const [state, action, pending] = useActionState(duplicateFranchiseCatalogServiceAction, initial);
  const prefix = useId();
  if (!service.command) return null;
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={workspace.mandate.libraryId} />
      <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="serviceId" value={service.id} />
      <input type="hidden" name="draftVersionId" value={service.command.draftVersionId} />
      <input type="hidden" name="subcategoryId" value={service.subcategoryId ?? ""} />
      <input type="hidden" name="idempotencyKey" defaultValue={namespacedCommandUuid(commandIdentity.idempotencyKey, "service-duplicate")} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <label className="franchise-field">{c.newCode}
        <input name="code" required defaultValue={`${service.code}_COPY`.slice(0, 80)} dir="ltr" className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </label>
      <label className="franchise-field">{c.newSlug}
        <input name="slug" required defaultValue={`${service.command.slug}-copy`} dir="ltr" className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </label>
      <label className="franchise-field">{c.labelFr}
        <input name="nameFr" required defaultValue={service.nameFr ?? service.title} className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </label>
      <label className="franchise-field">{c.labelAr}
        <input name="nameAr" required defaultValue={service.nameAr ?? service.title} dir="rtl" lang="ar" className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </label>
      <label className="franchise-field">{locale === "ar" ? "سبب التغيير" : "Motif de la version"}
        <input name="changeReason" required minLength={3} maxLength={500} defaultValue={locale === "ar" ? "استنساخ الخدمة" : "Duplication du service"} className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </label>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.duplicateConfirm}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.saveDraft : c.duplicateService}</Button>
      <div id={`${prefix}-dup`} role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {actionMessage(state, locale, c.serviceDuplicated)}
      </div>
    </form>
  );
}

export function FranchiseArchiveServiceForm({
  locale,
  workspace,
  service,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  workspace: FranchiseLibraryWorkspace;
  service: FranchiseCatalogRow;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const [state, action, pending] = useActionState(archiveFranchiseCatalogServiceAction, initial);
  const prefix = useId();
  if (!service.command || service.status === "ARCHIVED" || service.status === "IN_REVIEW") return null;
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={workspace.mandate.libraryId} />
      <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="serviceId" value={service.id} />
      <input type="hidden" name="draftVersionId" value={service.command.draftVersionId} />
      <input type="hidden" name="identityRowVersion" value={String(service.command.identityRowVersion)} />
      <input type="hidden" name="versionRowVersion" value={String(service.command.versionRowVersion)} />
      <input type="hidden" name="idempotencyKey" defaultValue={namespacedCommandUuid(commandIdentity.idempotencyKey, "service-archive")} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <label className="franchise-field">{locale === "ar" ? "سبب التغيير" : "Motif de la version"}
        <input name="changeReason" required minLength={3} maxLength={500} defaultValue={locale === "ar" ? "أرشفة الخدمة" : "Archivage du service"} className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </label>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.archiveConfirm}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11" variant="outline">{pending ? c.saveDraft : c.archiveService}</Button>
      <div id={`${prefix}-arch`} role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {actionMessage(state, locale, c.serviceArchived)}
      </div>
    </form>
  );
}

export function FranchiseCloneQuestionnaireForm({
  locale,
  workspace,
  item,
  commandIdentity,
  organizationId,
}: {
  locale: Locale;
  workspace: FranchiseLibraryWorkspace;
  item: FranchiseCatalogRow;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  organizationId: string | null;
}) {
  const c = libraryCopy(locale);
  const [state, action, pending] = useActionState(cloneFranchiseCatalogQuestionnaireAction, initial);
  const prefix = useId();
  const release = workspace.releases.find((row) => ["DRAFT", "IN_REVIEW", "APPROVED"].includes(row.status));
  if (!item.draftVersionId) return null;
  if (!release) return <p className="client-access-note">{c.noCloneRelease}</p>;
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={workspace.mandate.libraryId} />
      <input type="hidden" name="franchiseId" value={workspace.mandate.franchiseId} />
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="questionnaireId" value={item.id} />
      <input type="hidden" name="draftVersionId" value={item.draftVersionId} />
      <input type="hidden" name="targetReleaseId" value={release.id} />
      <input type="hidden" name="idempotencyKey" defaultValue={namespacedCommandUuid(commandIdentity.idempotencyKey, "questionnaire-clone")} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <label className="franchise-field">{c.newCode}
        <input name="code" required defaultValue={`${item.code}_COPY`.slice(0, 80)} dir="ltr" className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </label>
      <label className="franchise-field">{locale === "ar" ? "سبب التغيير" : "Motif de la version"}
        <input name="changeReason" required minLength={3} maxLength={500} defaultValue={locale === "ar" ? "استنساخ الاستبيان" : "Clonage du questionnaire"} className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </label>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.cloneConfirm}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.saveDraft : c.cloneQuestionnaire}</Button>
      <div id={`${prefix}-clone`} role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {actionMessage(state, locale, c.questionnaireCloned)}
      </div>
    </form>
  );
}

function HierarchyFields({
  locale, prefix, codeDefault,
}: {
  locale: Locale; prefix: string; codeDefault: string;
}) {
  const c = libraryCopy(locale);
  return (
    <>
      <div>
        <Label htmlFor={`${prefix}-fr`}>{c.labelFr}</Label>
        <Input id={`${prefix}-fr`} name="nameFr" required minLength={2} maxLength={240} dir="ltr" className="min-h-11" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-ar`}>{c.labelAr}</Label>
        <Input id={`${prefix}-ar`} name="nameAr" required minLength={2} maxLength={240} dir="rtl" lang="ar" className="min-h-11" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-code`}>{c.technicalKey}</Label>
        <Input id={`${prefix}-code`} name="code" required defaultValue={codeDefault} pattern="[A-Z][A-Z0-9_-]{1,79}" dir="ltr" className="min-h-11 font-mono" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-dfr`}>{locale === "ar" ? "الوصف (FR)" : "Description (FR)"}</Label>
        <textarea id={`${prefix}-dfr`} name="descriptionFr" required minLength={3} maxLength={1000} dir="ltr" className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-dar`}>{locale === "ar" ? "الوصف (AR)" : "Description (AR)"}</Label>
        <textarea id={`${prefix}-dar`} name="descriptionAr" required minLength={3} maxLength={1000} dir="rtl" lang="ar" className="min-h-11 w-full rounded-md border border-input bg-background px-3" />
      </div>
      <div>
        <Label htmlFor={`${prefix}-reason`}>{locale === "ar" ? "سبب التغيير" : "Motif de la version"}</Label>
        <Input id={`${prefix}-reason`} name="changeReason" required minLength={3} maxLength={500} className="min-h-11" />
      </div>
    </>
  );
}

export function FranchiseCategoryCreateForm({
  locale, libraryId, franchiseId, organizationId, commandIdentity,
}: {
  locale: Locale;
  libraryId: string;
  franchiseId?: string;
  organizationId: string | null;
  commandIdentity: { idempotencyKey: string; correlationId: string };
}) {
  const c = libraryCopy(locale);
  const [state, action, pending] = useActionState(createFranchiseCategoryAction, initial);
  const prefix = useId();
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={libraryId} />
      {franchiseId ? <input type="hidden" name="franchiseId" value={franchiseId} /> : null}
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="idempotencyKey" defaultValue={commandIdentity.idempotencyKey} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <HierarchyFields locale={locale} prefix={prefix} codeDefault="CAT_NEW" />
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.scope}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.saveDraft : c.createCategory}</Button>
      <div role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {actionMessage(state, locale, c.categoryCreated)}
      </div>
    </form>
  );
}

export function FranchiseSubcategoryCreateForm({
  locale, libraryId, franchiseId, organizationId, commandIdentity, categories,
}: {
  locale: Locale;
  libraryId: string;
  franchiseId?: string;
  organizationId: string | null;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  categories: FranchiseCategoryNode[];
}) {
  const c = libraryCopy(locale);
  const [state, action, pending] = useActionState(createFranchiseSubcategoryAction, initial);
  const prefix = useId();
  if (categories.length === 0) return <p className="client-access-note">{c.emptyCategories}</p>;
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={libraryId} />
      {franchiseId ? <input type="hidden" name="franchiseId" value={franchiseId} /> : null}
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="idempotencyKey" defaultValue={namespacedCommandUuid(commandIdentity.idempotencyKey, "subcategory-create")} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <div>
        <Label htmlFor={`${prefix}-parent`}>{c.category}</Label>
        <select id={`${prefix}-parent`} name="categoryId" required className="min-h-11 w-full rounded-md border border-input bg-background px-3">
          {categories.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <HierarchyFields locale={locale} prefix={prefix} codeDefault="SUB_NEW" />
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.scope}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.saveDraft : c.createSubcategory}</Button>
      <div role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {actionMessage(state, locale, c.subcategoryCreated)}
      </div>
    </form>
  );
}

export function FranchiseHierarchySubmitForm({
  locale, libraryId, franchiseId, organizationId, commandIdentity, objectType, item,
}: {
  locale: Locale;
  libraryId: string;
  franchiseId?: string;
  organizationId: string | null;
  commandIdentity: { idempotencyKey: string; correlationId: string };
  objectType: "CATEGORY" | "SUBCATEGORY";
  item: { id: string; title: string; status?: string; draftVersionId?: string | null; identityRowVersion?: number; versionRowVersion?: number };
}) {
  const c = libraryCopy(locale);
  const [state, action, pending] = useActionState(submitFranchiseHierarchyAction, initial);
  if (item.status !== "DRAFT" || !item.draftVersionId || !item.identityRowVersion || !item.versionRowVersion) return null;
  return (
    <form action={action} className="franchise-props-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="libraryId" value={libraryId} />
      {franchiseId ? <input type="hidden" name="franchiseId" value={franchiseId} /> : null}
      {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
      <input type="hidden" name="objectType" value={objectType} />
      <input type="hidden" name="objectId" value={item.id} />
      <input type="hidden" name="draftVersionId" value={item.draftVersionId} />
      <input type="hidden" name="identityRowVersion" value={String(item.identityRowVersion)} />
      <input type="hidden" name="versionRowVersion" value={String(item.versionRowVersion)} />
      <input type="hidden" name="idempotencyKey" defaultValue={namespacedCommandUuid(commandIdentity.idempotencyKey, objectType === "CATEGORY" ? "category-submit" : "subcategory-submit")} />
      <input type="hidden" name="correlationId" defaultValue={commandIdentity.correlationId} />
      <p className="client-access-note">{item.title}</p>
      <label className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
        <input className="mt-0.5 size-5" type="checkbox" name="confirmed" value="yes" required />
        <span>{c.submitMatricia} · {c.scope}</span>
      </label>
      <Button type="submit" disabled={pending} className="min-h-11">{pending ? c.saveDraft : c.submitMatricia}</Button>
      <div role={state.status === "error" ? "alert" : "status"} aria-live="polite">
        {actionMessage(state, locale, c.hierarchySubmitted)}
      </div>
    </form>
  );
}
