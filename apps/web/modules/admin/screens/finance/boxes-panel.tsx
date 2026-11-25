"use client";
import { commerceIdle } from "@/modules/admin/screens/finance/commerce-state";

import { useActionState, type ReactNode } from "react";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import type { AdminBoxesDashboard } from "@/modules/admin/data/boxes/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import {
  activateBenefitAction,
  activateBoxAction,
  createBenefitAction,
  createBoxAction,
  ensureWalletAction,
  linkPlanBoxAction,
  type CommerceActionState,
} from "./commerce-actions";
import type { CommerceMessages } from "./commerce-messages";
import { BoxConfigurationApproval } from "./box-approval-panel";
import { OfferSlotsEditor } from "./offer-slots-editor";

const control = "min-h-11 w-full rounded-md border bg-background px-3";
const types = ["PLATFORM_FEATURE", "SERVICE_UNIT", "CREDIT_SERVICE", "PRIORITY", "QUOTA", "ACCESS_RIGHT", "SERVICE_SUBSIDY", "CONSULTATION", "REPORT", "CUSTOM"];
const modes = ["SUBCONTRACTOR_POOL", "DIRECT_PROVIDER", "RFQ", "AUTOMATED_PLATFORM", "MATRICIA_INTERNAL", "VOLUME_POOL"];
const boxTypes = ["MULTI_LIBRARY", "SEMI_CUSTOM", "CUSTOM", "FIXED", "ENTERPRISE", "MULTI_USER"];

/**
 * Rôle ADM-031 / Gold Master §12.3–12.7 :
 * Une Box = offre unique multi-services (ex. créer une entreprise = comptable + marketing + …).
 * Services (avantages) → composer la Box (emplacements) → lier au plan → compte crédits.
 */

function Feedback({ state, m, locale }: { state: CommerceActionState; m: CommerceMessages; locale: Locale }) {
  if (state.status === "idle") return null;
  if (state.status === "success") return <p role="status" className="text-sm text-primary">{m.success} {localizeStatus(state.outcome, locale)}</p>;
  return <p role="alert" className="text-sm text-destructive">{m.errors[state.reason]}</p>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm">{label}{children}</label>;
}

function pipelineStep(dashboard: AdminBoxesDashboard): 1 | 2 | 3 | 4 | 5 {
  const activeBenefits = dashboard.benefits.filter((item) => item.status === "ACTIVE").length;
  const activeBoxes = dashboard.boxes.filter((item) => item.status === "ACTIVE").length;
  if (dashboard.benefits.length === 0 || activeBenefits === 0) return 1;
  if (dashboard.boxes.length === 0 || activeBoxes === 0) return 2;
  if (dashboard.plan_matrix.length === 0) return 3;
  if (dashboard.wallets.length === 0) return 4;
  return 5;
}

export function BoxesPanel({
  locale, dashboard, m, auditOrganizationId, keys,
}: {
  locale: Locale;
  dashboard: AdminBoxesDashboard;
  m: CommerceMessages;
  auditOrganizationId: string | null;
  keys: Record<string, string>;
}) {
  const name = (fr: string, ar: string) => (locale === "ar" ? ar : fr);
  const draftBenefits = dashboard.benefits.filter((item) => item.status === "DRAFT" || item.status === "UNDER_REVIEW");
  const draftBoxes = dashboard.boxes.filter((item) => item.status === "DRAFT" || item.status === "UNDER_REVIEW");
  const activeBoxes = dashboard.boxes.filter((item) => item.status === "ACTIVE");
  const canWrite = dashboard.capabilities.can_write && Boolean(auditOrganizationId);
  const step = pipelineStep(dashboard);
  const orgWallets = auditOrganizationId
    ? dashboard.wallets.filter((wallet) => wallet.organization_id === auditOrganizationId)
    : [];
  const creditsHref = auditOrganizationId
    ? `/${locale}/administration/finance/credits?organizationId=${encodeURIComponent(auditOrganizationId)}`
    : `/${locale}/administration/finance/credits`;

  const steps = locale === "ar"
    ? [
        { n: 1 as const, title: "الخدمات", body: "كل خدمة (محاسبة، تسويق…) تُعرَّف كميزة قابلة للاستهلاك." },
        { n: 2 as const, title: "العرض Box", body: "جمع عدة خدمات في عرض واحد للعميل." },
        { n: 3 as const, title: "الخطة", body: "ربط العرض بخطة اشتراك يشتريها العميل." },
        { n: 4 as const, title: "المحفظة", body: "فتح محفظة المؤسسة. المنح اليدوي في صفحة الأرصدة." },
      ]
    : [
        { n: 1 as const, title: "Services", body: "Chaque besoin (comptable, marketing…) devient un service consommable." },
        { n: 2 as const, title: "Offre Box", body: "Regrouper plusieurs services en une seule offre client." },
        { n: 3 as const, title: "Plan", body: "Attacher l’offre à un abonnement que le client achète." },
        { n: 4 as const, title: "Compte crédits", body: "Ouvrir le compte crédits. Les attributions manuelles sont sur Packs crédits." },
      ];

  const focusCopy =
    step === 1
      ? locale === "ar"
        ? "الخطوة الحالية: عرّفوا خدمات العرض (مثال: استشارة محاسبية، حملة تسويق) ثم انشروها."
        : "Étape en cours : définissez les services de l’offre (ex. conseil comptable, campagne marketing) puis publiez-les."
      : step === 2
        ? locale === "ar"
          ? "الخطوة الحالية: أنشئوا عرض Box يجمع عدة فئات/خدمات، ثم انشروه."
          : "Étape en cours : créez l’offre Box qui regroupe plusieurs catégories/services, puis publiez-la."
        : step === 3
          ? locale === "ar"
            ? "الخطوة الحالية: اربطوا العرض المنشور بخطة اشتراك."
            : "Étape en cours : attachez l’offre publiée à un plan d’abonnement."
          : step === 4
            ? locale === "ar"
              ? "الخطوة الحالية: افتحوا محفظة المؤسسة المرجعية."
              : "Étape en cours : ouvrez le compte crédits de l’entreprise de référence."
            : locale === "ar"
              ? "المسار جاهز: العرض متعدد الخدمات جاهز. المنح اليدوي في صفحة Packs الأرصدة."
              : "Parcours prêt : l’offre multi-services est prête. Les attributions sont sur Packs crédits.";

  return (
    <div className="admin-finance-focus space-y-5">
      <p className="admin-finance-lead">
        {locale === "ar"
          ? "الهدف: عرض واحد للعميل يجمع عدة خدمات من فئات مختلفة (مثل إنشاء شركة = محاسبة + تسويق + …)، غالباً عبر مقاولين. المسار: خدمات ← عرض Box ← خطة ← محفظة."
          : "Objectif : une offre unique pour le client qui regroupe plusieurs services de catégories différentes (ex. créer une entreprise = comptable + marketing + …), souvent via sous-traitants. Parcours : services → offre Box → plan → compte crédits."}
      </p>
      <p className="admin-finance-lead">{m.boxesHint}</p>

      <ol className="admin-finance-pipeline" aria-label={locale === "ar" ? "مسار إعداد العرض" : "Parcours de configuration de l’offre"}>
        {steps.map((item) => (
          <li key={item.n} data-state={step === item.n ? "current" : step > item.n ? "done" : "todo"}>
            <span className="admin-finance-pipeline__index" aria-hidden>{item.n}</span>
            <span>
              <strong>{item.title}</strong>
              <span className="admin-finance-pipeline__body">{item.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <p role="status" className="admin-notice" data-tone={canWrite ? "sky" : "warn"}>
        {canWrite ? focusCopy : (
          dashboard.capabilities.can_write && !auditOrganizationId
            ? (locale === "ar"
              ? "اختاروا مؤسسة في القسم 1 واضغطوا «فتح إعداد العرض» — النماذج تتبع هذا المسار."
              : "Choisissez une entreprise à la section 1 et cliquez sur « Ouvrir la configuration de l’offre » — les formulaires suivent ce parcours.")
            : (locale === "ar"
              ? "قراءة فقط: إنشاء أو نشر المزايا والصناديق يتطلب صلاحية كتابة مالية."
              : "Lecture seule : créer ou publier avantages et Boxes exige une capacité d’écriture Finance.")
        )}
      </p>

      {/* Étape 1 — Services */}
      <PipelineStage
        id="boxes-avantages"
        active={step === 1}
        title={locale === "ar" ? "1. خدمات العرض" : "1. Services de l’offre"}
        lead={locale === "ar"
          ? "كل خدمة تُستهلك بالأرصدة. اختاروا نمط الإنجاز (مجمّع مقاولين، مقدم مباشر، طلب عروض…) حسب من يسلّمها."
          : "Chaque service se consomme en crédits. Choisissez le mode de réalisation (pool sous-traitants, prestataire direct, RFQ…) selon qui le livre."}
      >
        {canWrite ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <CommandForm title={m.createBenefit} action={createBenefitAction} extra={{ effectiveFrom: dashboard.generated_at }} keyValue={keys.benefit} locale={locale} auditOrganizationId={auditOrganizationId!} m={m}>
              <Field label={m.code}><Input name="code" required className={control} dir="ltr" pattern="[A-Z][A-Z0-9_]{2,79}" /></Field>
              <Select name="benefitType" label={m.type} values={types} locale={locale} />
              <Select name="fulfillmentMode" label={m.fulfillment} values={modes} locale={locale} />
              <Field label={m.nameFr}><Input name="nameFr" required minLength={2} className={control} /></Field>
              <Field label={m.nameAr}><Input name="nameAr" required minLength={2} className={control} /></Field>
              <Field label={m.descriptionFr}><Input name="descriptionFr" required minLength={3} className={control} /></Field>
              <Field label={m.descriptionAr}><Input name="descriptionAr" required minLength={3} className={control} /></Field>
              <Field label={m.creditCost}><Input name="creditCost" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
              <Field label={m.referenceValue}><Input name="referenceValueMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
              <Field label={m.internalCost}><Input name="internalCostMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
              <Field label={m.currency}><Input name="currency" required defaultValue="MAD" maxLength={3} className={control} dir="ltr" /></Field>
              <Field label={m.cancelRule}><Input name="cancellationRuleVersion" required defaultValue="CANCEL_V1" className={control} dir="ltr" /></Field>
            </CommandForm>
            <CommandForm title={m.activateBenefit} action={activateBenefitAction} keyValue={keys.activateBenefit} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={draftBenefits.length === 0}>
              <Select name="benefitVersionId" label={m.benefitVersion} values={draftBenefits.map((item) => item.id)} labels={draftBenefits.map((item) => `${item.code} v${item.version}`)} />
              {draftBenefits.length === 0 ? <p className="admin-finance-empty">{locale === "ar" ? "لا مسودة ميزة للنشر." : "Aucune brouillon d’avantage à publier."}</p> : null}
            </CommandForm>
          </div>
        ) : null}
        <InventoryList
          title={m.benefits}
          empty={locale === "ar" ? "لا مزايا بعد — ابدؤوا بالإنشاء أعلاه." : "Aucun avantage encore — commencez par la création ci-dessus."}
          items={dashboard.benefits.map((item) => (
            <article key={item.id} className="admin-finance-row">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4>{name(item.name_fr, item.name_ar)}</h4>
                  <p className="text-sm"><span dir="ltr">{item.code}</span> · {localizeStatus(item.benefit_type, locale)} · <span dir="ltr">{item.credit_cost} cr · {formatMinor(item.internal_cost_minor, item.currency, locale)}</span></p>
                </div>
                <Badge>{localizeStatus(item.status, locale)} · v{item.version}</Badge>
              </div>
            </article>
          ))}
        />
        <p className="admin-finance-links">
          <a href={`/${locale}/administration/avantages/regles`}>{locale === "ar" ? "قواعد الأهلية" : "Règles d’admission"}</a>
          <a href={`/${locale}/administration/avantages/livraisons`}>{locale === "ar" ? "تنفيذ المزايا" : "Exécution des avantages"}</a>
        </p>
      </PipelineStage>

      {/* Étape 2 — Offre Box multi-services */}
      <PipelineStage
        id="boxes-builder"
        active={step === 2}
        title={locale === "ar" ? "2. عرض Box متعدد الخدمات" : "2. Offre Box multi-services"}
        lead={locale === "ar"
          ? "هنا تنشئون العرض الفريد: عدة فئات (محاسبة، تسويق…) داخل Box واحد، بميزانية أرصدة وتكاليف منخفض/متوقع/100٪."
          : "C’est ici que vous créez l’offre unique : plusieurs catégories (comptable, marketing…) dans une seule Box, avec budget crédits et coûts faible/attendu/100 %."}
      >
        {canWrite ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <CommandForm title={m.createBox} action={createBoxAction} extra={{ effectiveFrom: dashboard.generated_at }} keyValue={keys.box} locale={locale} auditOrganizationId={auditOrganizationId!} m={m}>
              <Field label={m.code}><Input name="code" required className={control} dir="ltr" pattern="[A-Z][A-Z0-9_]{2,79}" /></Field>
              <Select name="boxType" label={m.boxType} values={boxTypes} locale={locale} />
              <Field label={m.nameFr}><Input name="nameFr" required minLength={2} className={control} /></Field>
              <Field label={m.nameAr}><Input name="nameAr" required minLength={2} className={control} /></Field>
              <Field label={m.budget}><Input name="creditBudget" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
              <Field label={m.rollover}><Input name="rolloverMonths" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
              <Field label={m.costLow}><Input name="costLowMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
              <Field label={m.costExpected}><Input name="costExpectedMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
              <Field label={m.costFull}><Input name="costFullMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" defaultValue="0" /></Field>
              <Field label={m.currency}><Input name="currency" required defaultValue="MAD" maxLength={3} className={control} dir="ltr" /></Field>
              <OfferSlotsEditor locale={locale} m={m} benefits={dashboard.benefits} />
            </CommandForm>
            <CommandForm title={m.activateBox} action={activateBoxAction} keyValue={keys.activateBox} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={draftBoxes.length === 0}>
              <Select name="boxVersionId" label={m.boxVersion} values={draftBoxes.map((item) => item.id)} labels={draftBoxes.map((item) => `${item.code} v${item.version}`)} />
              <Field label={m.approval}><Input name="approvalReference" className={control} /></Field>
            </CommandForm>
          </div>
        ) : null}
        <InventoryList
          title={m.boxBuilder}
          empty={locale === "ar" ? "لا عروض بعد — أكملوا الخدمات ثم أنشئوا عرض Box." : "Aucune offre encore — terminez les services puis créez une offre Box."}
          items={dashboard.boxes.map((item) => (
            <article key={item.id} className="admin-finance-row">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4>{name(item.name_fr, item.name_ar)}</h4>
                  <p className="text-sm"><span dir="ltr">{item.code}</span> · {localizeStatus(item.box_type, locale)} · <span dir="ltr">{item.credit_budget} cr</span></p>
                  <p className="text-sm" dir="ltr">{formatMinor(item.cost_low_minor, item.currency, locale)} / {formatMinor(item.cost_expected_minor, item.currency, locale)} / {formatMinor(item.cost_full_minor, item.currency, locale)}</p>
                </div>
                <Badge variant={item.needs_approval ? "destructive" : "outline"}>{localizeStatus(item.status, locale)} · v{item.version}</Badge>
              </div>
              {item.needs_approval ? <p className="mt-2 text-sm text-destructive">{m.needsApproval}</p> : null}
              {item.slots.length ? (
                <ul className="mt-2 text-sm text-muted-foreground">
                  {item.slots.map((slot) => (
                    <li key={slot.id}>
                      <span dir="ltr">{slot.slot_code}</span> · {localizeStatus(slot.slot_kind, locale)} · {slot.minimum_selections}–{slot.maximum_selections}
                      {" "}
                      <span>({locale === "ar" ? "فئة خدمة في العرض" : "catégorie de service dans l’offre"})</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        />
      </PipelineStage>

      {/* Étape 3 — Matrice plan */}
      <PipelineStage
        id="simulation"
        active={step === 3}
        title={locale === "ar" ? "3. ربط الخطة بالصندوق" : "3. Lien plan ↔ Box"}
        lead={locale === "ar"
          ? "هذه المصفوفة هي محاكاة العرض للعميل (ليست انتحال هوية). كل خطة نشطة تُربط بصندوق منشور وقاعدة ميزانية."
          : "Cette matrice simule l’offre client (pas d’impersonnation). Chaque plan actif se lie à une Box publiée et une règle de budget."}
      >
        {canWrite ? (
          <CommandForm title={m.linkPlan} action={linkPlanBoxAction} extra={{ effectiveFrom: dashboard.generated_at }} keyValue={keys.link} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={dashboard.plans.length === 0 || activeBoxes.length === 0}>
            <Select name="planVersionId" label={m.plan} values={dashboard.plans.map((item) => item.id)} labels={dashboard.plans.map((item) => `${item.plan_code} v${item.version}`)} />
            <Select name="boxVersionId" label={m.boxVersion} values={activeBoxes.map((item) => item.id)} labels={activeBoxes.map((item) => `${item.code} v${item.version}`)} />
            <Field label={locale === "ar" ? "قاعدة الميزانية للدورة الممولة" : "Règle du budget par cycle financé"}>
              <select name="budgetRule" required defaultValue="" className={control}>
                <option value="" disabled>{locale === "ar" ? "اختر صراحة" : "Choisir explicitement"}</option>
                <option value="AT_MOST">{locale === "ar" ? "عدم تجاوز الميزانية" : "Ne pas dépasser le budget"}</option>
                <option value="EXACT">{locale === "ar" ? "استخدام الميزانية بالضبط" : "Utiliser exactement le budget"}</option>
              </select>
            </Field>
            {dashboard.plans.length === 0 || activeBoxes.length === 0 ? (
              <p className="admin-finance-empty">
                {locale === "ar"
                  ? "يلزم خطة نشطة وصندوق منشور (الخطوتان 1–2)."
                  : "Il faut un plan actif et une Box publiée (étapes 1–2)."}
              </p>
            ) : null}
          </CommandForm>
        ) : null}
        <InventoryList
          title={m.matrix}
          empty={locale === "ar" ? "لا روابط بعد." : "Aucune liaison encore."}
          items={dashboard.plan_matrix.map((item) => (
            <li key={item.id} className="admin-finance-row text-sm">
              <p>{item.plan_code} v{item.plan_version} → {item.box_code} v{item.box_version}</p>
              <BoxConfigurationApproval ruleId={item.id} locale={locale} />
            </li>
          ))}
        />
      </PipelineStage>

      {/* Étape 4 — ouverture wallet seule ; attributions / journal → Packs crédits */}
      <PipelineStage
        id="boxes-wallet"
        active={step === 4 || step === 5}
        title={locale === "ar" ? "4. فتح محفظة المؤسسة" : "4. Ouvrir le compte crédits de l’entreprise"}
        lead={locale === "ar"
          ? "آخر خطوة في الورشة: فتح المحفظة. المنح اليدوي، أرصدة الاشتراك ونشاط الدفتر في صفحة Packs الأرصدة."
          : "Dernière étape de l’atelier : ouvrir le compte crédits. Attribution manuelle, crédits d’abonnement et journal sont sur Packs crédits."}
      >
        {canWrite ? (
          <CommandForm title={m.ensureWallet} action={ensureWalletAction} keyValue={keys.wallet} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} extra={{ organizationId: auditOrganizationId! }}>
            <p className="text-sm text-muted-foreground">
              {m.organization}: {locale === "ar" ? "المؤسسة المحددة أعلاه" : "Entreprise choisie ci-dessus"}
            </p>
          </CommandForm>
        ) : null}
        <p className="admin-finance-metrics-inline" role="status">
          <span>{m.wallets} <strong dir="ltr">{dashboard.wallets.length}</strong></span>
          {auditOrganizationId ? <span>{locale === "ar" ? "لهذه المؤسسة" : "Pour cette entreprise"} <strong dir="ltr">{orgWallets.length}</strong></span> : null}
        </p>
        <p className="admin-finance-links">
          <a href={creditsHref}>{locale === "ar" ? "منح الأرصدة ومتابعة الدفتر ←" : "Attributions de crédits et journal →"}</a>
        </p>
      </PipelineStage>
    </div>
  );
}

function PipelineStage({
  id, title, lead, active, children,
}: {
  id: string;
  title: string;
  lead: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="admin-finance-stage scroll-mt-24" data-active={active ? "true" : "false"} aria-labelledby={`${id}-title`}>
      <div className="admin-section-head">
        <div>
          <h3 id={`${id}-title`}>{title}</h3>
          <p>{lead}</p>
        </div>
      </div>
      <div className="admin-finance-stage__body space-y-4">{children}</div>
    </section>
  );
}

function InventoryList({ title, empty, items }: { title: string; empty: string; items: ReactNode[] }) {
  return (
    <section className="space-y-2">
      <h4 className="admin-finance-subhead">{title}</h4>
      {items.length ? <div className="admin-finance-list">{items}</div> : <p className="admin-finance-empty" role="status">{empty}</p>}
    </section>
  );
}

function Select({ name, label, values, labels, locale }: { name: string; label: string; values: string[]; labels?: string[]; locale?: Locale }) {
  return (
    <Field label={label}>
      <select name={name} required className={control} disabled={values.length === 0}>
        {values.length === 0 ? <option value="">—</option> : null}
        {values.map((value, index) => <option key={value} value={value}>{labels?.[index] ?? (locale ? localizeStatus(value, locale) : value)}</option>)}
      </select>
    </Field>
  );
}

function CommandForm({
  title, action, keyValue, locale, auditOrganizationId, m, children, disabled, extra,
}: {
  title: string;
  action: (state: CommerceActionState, form: FormData) => Promise<CommerceActionState>;
  keyValue: string;
  locale: Locale;
  auditOrganizationId: string;
  m: CommerceMessages;
  children: ReactNode;
  disabled?: boolean;
  extra?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, commerceIdle);
  return (
    <article className="admin-finance-form">
      <h4>{title}</h4>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="idempotencyKey" value={keyValue} />
        <input type="hidden" name="auditOrganizationId" value={auditOrganizationId} />
        {extra ? Object.entries(extra).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />) : null}
        {children}
        <Button type="submit" disabled={pending || disabled} className="min-h-11">{pending ? m.processing : m.save}</Button>
        <Feedback state={state} m={m} locale={locale} />
      </form>
    </article>
  );
}
