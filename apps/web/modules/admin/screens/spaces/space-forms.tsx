"use client";

import{ProductionReference}from"./production-reference";
import { useActionState, type ReactNode } from "react";
import Link from "next/link";
import { ActorIntentForm } from "@/modules/admin/screens/spaces/actor-forms";
import {
  requestSpaceMutation,
  submitFranchiseGovernance,
  submitProviderCompany,
  submitProviderDocument,
  submitProviderQualification,
  type AdminActionState,
  type AdminProviderActionState,
  type FranchiseActionState,
} from "./space-actions";
import { decideAdminDispute, type DomainActionState } from "./domain-actions";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

const idle: AdminActionState = { status: "idle" };
const idleProvider: AdminProviderActionState = { status: "idle" };
const idleFranchise: FranchiseActionState = { status: "idle" };
const idleDomain: DomainActionState = { status: "idle" };

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}{required ? " *" : ""}</label>
      {children}
    </div>
  );
}

function Feedback({ state, locale }: { state: { status: string; reason?: string }; locale: Locale }) {
  if (state.status === "success") return <p className="admin-banner" data-tone="ok" role="status">{locale === "ar" ? "تم تسجيل الإجراء." : "Action enregistrée."}</p>;
  if (state.status !== "error") return null;
  return <p className="admin-banner" data-tone="danger" role="alert">{state.reason ?? (locale === "ar" ? "تعذر التنفيذ." : "Exécution refusée.")}</p>;
}

export function SpaceMutationForm({
  locale,
  query,
  space,
  itemId,
  organizationId,
  resourceType,
  title,
  submitLabel,
  fields,
}: {
  locale: Locale;
  query: string;
  space: string;
  itemId: string;
  organizationId?: string;
  resourceType: string;
  title: string;
  submitLabel: string;
  fields?: ReactNode;
}) {
  const [state, action, pending] = useActionState(requestSpaceMutation, idle);
  return (
    <form action={action} className="client-stack">
      <input type="hidden" name="locale" value={locale} /><ProductionReference locale={locale}/>
      <input type="hidden" name="space" value={space} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="organizationId" value={organizationId ?? ""} />
      <input type="hidden" name="resourceId" value={itemId} />
      <input type="hidden" name="resourceType" value={resourceType} />
      <article className="client-card">
        <header><h2>{title}</h2></header>
        <div className="admin-form-grid">
          {fields}
          <Field id={`${space}-reason`} label={locale === "ar" ? "التبرير" : "Justification"} required>
            <textarea id={`${space}-reason`} name="justification" required minLength={10} maxLength={1000} />
          </Field>
        </div>
      </article>
      <div className="admin-form-foot">
        <Link href={`/${locale}/administration/${space}${query}`} className="client-ghost-link">{locale === "ar" ? "إلغاء" : "Annuler"}</Link>
        <button type="submit" name="intent" value="SAVE_DRAFT" className="admin-soft-cta" disabled={pending}>{locale === "ar" ? "حفظ المسودة" : "Enregistrer le brouillon"}</button>
        <button type="submit" className="admin-primary-cta" disabled={pending}>{pending ? "…" : submitLabel}</button>
      </div>
      <Feedback state={state} locale={locale} />
    </form>
  );
}

export function QualificationDecisionForm({
  locale,
  query,
  qualificationId,
  organizationId,
}: {
  locale: Locale;
  query: string;
  qualificationId: string;
  organizationId?: string;
}) {
  const [state, action, pending] = useActionState(submitProviderQualification, idleProvider);
  const ar = locale === "ar";
  return (
    <form action={action} className="client-stack">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="qualificationId" value={qualificationId} />
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
      <article className="client-card">
        <header><h2>{ar ? "قرار التأهيل" : "Décision de qualification"}</h2></header>
        <div className="admin-radio-row" data-cards="true">
          <label data-tone="mint"><input type="radio" name="status" value="APPROVED" defaultChecked /><strong>{ar ? "تأهيل" : "Qualifier"}</strong><small>{ar ? "مطابق للمتطلبات" : "Prestataire conforme aux exigences"}</small></label>
          <label data-tone="violet"><input type="radio" name="status" value="CONDITIONAL" /><strong>{ar ? "بشروط" : "Qualifier sous conditions"}</strong><small>{ar ? "مع تحفظات" : "Sous réserve de la réalisation de conditions"}</small></label>
          <label data-tone="sky"><input type="radio" name="status" value="INFORMATION_REQUIRED" /><strong>{ar ? "طلب تكميل" : "Demander un complément"}</strong><small>{ar ? "وثائق إضافية" : "Informations ou pièces supplémentaires nécessaires"}</small></label>
          <label data-tone="peach"><input type="radio" name="status" value="REJECTED" /><strong>{ar ? "رفض" : "Refuser"}</strong><small>{ar ? "غير مطابق" : "Prestataire non conforme"}</small></label>
        </div>
        <div className="admin-form-grid">
          <Field id="qual-score" label={ar ? "النتيجة %" : "Score %"}>
            <input id="qual-score" name="scorePercent" inputMode="decimal" />
          </Field>
          <Field id="qual-expires" label={ar ? "انتهاء القرار" : "Expiration"}>
            <input id="qual-expires" name="expiresAt" type="datetime-local" />
          </Field>
          <Field id="qual-block" label={ar ? "شروط حاجزة" : "Conditions bloquantes"}>
            <textarea id="qual-block" name="blockingConditions" rows={3} />
          </Field>
          <Field id="qual-reason" label={ar ? "التبرير" : "Justification"} required>
            <textarea id="qual-reason" name="rationale" required minLength={3} maxLength={2000} />
          </Field>
        </div>
        <label className="admin-check">
          <input type="checkbox" name="evidenceConfirmed" value="yes" />
          {ar ? "تم التحقق من الأدلة الإلزامية" : "Contrôles obligatoires confirmés"}
        </label>
      </article>
      <aside className="client-stack">
        <article className="admin-banner" data-tone="warn">
          <strong>{ar ? "تحقق بأربعة أعين" : "Contrôle à quatre yeux"}</strong>
          <p>{ar ? "لا يمكن للمستخدم أن يصادق على ملفه." : "Un utilisateur ne peut pas approuver son propre dossier."}</p>
        </article>
        {organizationId ? (
          <ActorIntentForm locale={locale} organizationId={organizationId} resourceId={qualificationId} resourceType="PROVIDER_QUALIFICATION" intent="RESTRICT_ENTITY" reason="Mode auditeur demandé depuis la décision de qualification." label={ar ? "وضع المدقق" : "Mode auditeur"} />
        ) : null}
      </aside>
      <div className="admin-form-foot">
        <Link href={`/${locale}/administration/qualification${query}`} className="client-ghost-link">{ar ? "إلغاء" : "Annuler"}</Link>
        <button type="submit" className="admin-soft-cta" name="status" value="INFORMATION_REQUIRED" disabled={pending}>{ar ? "طلب تكميل" : "Demander un complément"}</button>
        <button type="submit" className="admin-primary-cta" disabled={pending}>{pending ? "…" : ar ? "إرسال القرار" : "Soumettre la décision"}</button>
      </div>
      <Feedback state={state} locale={locale} />
    </form>
  );
}

export function CompanyDecisionForm({
  locale,
  organizationId,
  rowVersion,
  partnerStatus,
}: {
  locale: Locale;
  organizationId: string;
  rowVersion: string;
  partnerStatus: string;
}) {
  const [state, action, pending] = useActionState(submitProviderCompany, idleProvider);
  const ar = locale === "ar";
  return (
    <form action={action} className="client-stack"><a href={`/${locale}/administration/providers/${organizationId}/identite`}>{ar?"مراجعة الهوية الحالية ووثائقها":"Revoir l’identité courante et ses pièces"}</a>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="expectedRowVersion" value={rowVersion} />
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
      <input type="hidden" name="locale" value={locale} />
      <div className="admin-form-grid">
        <Field id="company-status" label={ar ? "قرار الشركة" : "Décision société"} required>
          <select id="company-status" name="companyStatus" defaultValue="UNDER_REVIEW" required>
            <option value="UNDER_REVIEW">{ar ? "قيد المراجعة" : "En revue"}</option>
            <option value="VERIFIED">{ar ? "موثق" : "Vérifié"}</option>
            <option value="REJECTED">{ar ? "مرفوض" : "Refusé"}</option>
            <option value="SUSPENDED">{ar ? "موقوف" : "Suspendu"}</option>
          </select>
        </Field>
        <Field id="partner-status" label={ar ? "عقد الشريك" : "Contrat partenaire"} required>
          <select id="partner-status" name="partnerContractStatus" defaultValue={partnerStatus} required>
            <option value="NOT_SIGNED">{ar ? "غير موقع" : "Non signé"}</option>
            <option value="PENDING">{ar ? "معلق" : "En attente"}</option>
            <option value="SIGNED">{ar ? "موقع" : "Signé"}</option>
            <option value="EXPIRED">{ar ? "منتهٍ" : "Expiré"}</option>
            <option value="TERMINATED">{ar ? "منتهٍ" : "Résilié"}</option>
          </select>
        </Field>
        <Field id="rule-version" label={ar ? "نسخة القاعدة" : "Version de règle"} required>
          <input id="rule-version" name="ruleVersion" required minLength={3} defaultValue="PROVIDER-COMPANY-V1" />
        </Field>
        <Field id="company-reason" label={ar ? "السبب" : "Motif"} required>
          <textarea id="company-reason" name="reason" required minLength={3} />
        </Field>
      </div>
      <button type="submit" className="admin-primary-cta" disabled={pending}>{pending ? "…" : ar ? "إرسال" : "Soumettre"}</button>
      <Feedback state={state} locale={locale} />
    </form>
  );
}

export function DisputeDecisionForm({
  locale,
  query,
  caseId,
}: {
  locale: Locale;
  query: string;
  caseId: string;
}) {
  const [state, action, pending] = useActionState(decideAdminDispute, idleDomain);
  const ar = locale === "ar";
  return (
    <form action={action} className="client-stack">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
      <article className="client-card">
        <header><h2>{ar ? "قرار النزاع" : "Décision du litige"}</h2></header>
        <div className="admin-form-grid">
          <Field id="dispute-outcome" label={ar ? "النتيجة" : "Décision"} required>
            <select id="dispute-outcome" name="outcome" required defaultValue="MUTUAL_AGREEMENT">
              <option value="MUTUAL_AGREEMENT">{ar ? "اتفاق" : "Accord mutuel"}</option>
              <option value="COMPLIANT">{ar ? "مطابق" : "Conforme"}</option>
              <option value="MINOR_CORRECTION">{ar ? "تصحيح طفيف" : "Correction mineure"}</option>
              <option value="OUT_OF_SCOPE">{ar ? "خارج النطاق" : "Hors périmètre"}</option>
              <option value="CLIENT_ABUSE">{ar ? "إساءة من العميل" : "Abus client"}</option>
              <option value="NON_COMPLIANT_CONFIRMED">{ar ? "عدم مطابقة مؤكد" : "Non-conformité confirmée"}</option>
            </select>
          </Field>
          <Field id="dispute-rule" label={ar ? "نسخة القاعدة" : "Version de règle"} required>
            <input id="dispute-rule" name="ruleVersion" required defaultValue="DISPUTE-RULE-V1" />
          </Field>
          <Field id="dispute-evidence" label={ar ? "معرفات الأدلة" : "Identifiants des preuves"} required>
            <textarea id="dispute-evidence" name="evidenceIds" required minLength={36} placeholder={ar ? "معرّف دليل واحد على الأقل" : "Au moins un identifiant de preuve du dossier"} />
          </Field>
          <Field id="dispute-reason" label={ar ? "التبرير" : "Justification"} required>
            <textarea id="dispute-reason" name="reason" required minLength={10} maxLength={2000} />
          </Field>
        </div>
      </article>
      <div className="admin-form-foot">
        <Link href={`/${locale}/administration/litiges${query}`} className="client-ghost-link">{ar ? "إلغاء" : "Annuler"}</Link>
        <button type="submit" className="admin-primary-cta" disabled={pending}>{pending ? "…" : ar ? "تسجيل القرار" : "Enregistrer la décision"}</button>
      </div>
      <Feedback state={state} locale={locale} />
    </form>
  );
}

export function DocumentDecisionForm({ locale, documentVersionId }: { locale: Locale; documentVersionId: string }) {
  const [state, action, pending] = useActionState(submitProviderDocument, idleProvider);
  const ar = locale === "ar";
  return (
    <form action={action} className="client-stack">
      <input type="hidden" name="documentVersionId" value={documentVersionId} />
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
      <input type="hidden" name="locale" value={locale} />
      <div className="admin-form-grid">
        <Field id="doc-status" label={ar ? "القرار" : "Décision"} required>
          <select id="doc-status" name="status" defaultValue="VERIFIED">
            <option value="VERIFIED">{ar ? "مطابق" : "Vérifié"}</option>
            <option value="REJECTED">{ar ? "مرفوض" : "Rejeté"}</option>
          </select>
        </Field>
        <Field id="doc-rule" label={ar ? "نسخة القاعدة" : "Version de règle"} required>
          <input id="doc-rule" name="ruleVersion" required defaultValue="PROVIDER-DOCUMENT-V1" />
        </Field>
        <Field id="doc-reason" label={ar ? "التبرير" : "Justification"} required>
          <textarea id="doc-reason" name="rationale" required minLength={3} />
        </Field>
      </div>
      <button type="submit" className="admin-primary-cta" disabled={pending}>{pending ? "…" : ar ? "مراجعة" : "Examiner"}</button>
      <Feedback state={state} locale={locale} />
    </form>
  );
}

export function GovernanceDecisionForm({
  locale,
  query,
  approvalRequestId,
  rowVersion,
}: {
  locale: Locale;
  query: string;
  approvalRequestId: string;
  rowVersion: string;
}) {
  const [state, action, pending] = useActionState(submitFranchiseGovernance, idleFranchise);
  const ar = locale === "ar";
  return (
    <form action={action} className="client-stack">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="approvalRequestId" value={approvalRequestId} />
      <input type="hidden" name="rowVersion" value={rowVersion} />
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
      <article className="client-card">
        <header><h2>{ar ? "منطقة القرار" : "Zone de décision"}</h2></header>
        <div className="admin-radio-row">
          <label><input type="radio" name="decision" value="APPROVE" defaultChecked /> {ar ? "موافقة" : "Approuver"}</label>
          <label><input type="radio" name="decision" value="REJECT" /> {ar ? "رفض" : "Refuser"}</label>
        </div>
        <Field id="gov-reason" label={ar ? "التبرير" : "Justification"} required>
          <textarea id="gov-reason" name="reason" required minLength={3} maxLength={1000} />
        </Field>
      </article>
      <div className="admin-form-foot">
        <Link href={`/${locale}/administration/gouvernance${query}`} className="client-ghost-link">{ar ? "إلغاء" : "Annuler"}</Link>
        <button type="submit" className="admin-soft-cta" disabled={pending}>{ar ? "حفظ المسودة" : "Enregistrer le brouillon"}</button>
        <button type="submit" className="admin-primary-cta" disabled={pending}>{pending ? "…" : ar ? "إرسال القرار" : "Soumettre la décision"}</button>
      </div>
      <Feedback state={state} locale={locale} />
    </form>
  );
}

export function SpaceSensitiveActions({
  locale,
  organizationId,
  resourceId,
  resourceType,
}: {
  locale: Locale;
  organizationId?: string;
  resourceId: string;
  resourceType: string;
}) {
  const ar = locale === "ar";
  return (
    <div className="admin-revoke">
      <article data-tone="warn">
        <strong>{ar ? "تعليق" : "Suspendre"}</strong>
        <ActorIntentForm locale={locale} organizationId={organizationId} resourceId={resourceId} resourceType={resourceType} intent="SUSPEND_ENTITY" reason="Suspension demandée depuis le tableau de bord d’administration." label={ar ? "تعليق" : "Suspendre"} tone="soft" />
      </article>
      <article data-tone="danger">
        <strong>{ar ? "أرشفة" : "Archiver"}</strong>
        <ActorIntentForm locale={locale} organizationId={organizationId} resourceId={resourceId} resourceType={resourceType} intent="SUSPEND_ENTITY" reason="Archivage demandé. Aucune suppression définitive." label={ar ? "أرشفة" : "Archiver"} tone="danger" />
      </article>
    </div>
  );
}
