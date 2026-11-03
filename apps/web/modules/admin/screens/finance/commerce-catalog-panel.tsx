"use client";
import {commerceIdle}from"@/modules/admin/screens/finance/commerce-state";

import { useActionState } from "react";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import type { AdminCommerceCatalog } from "@/modules/admin/data/catalog/model";
import type { AdminBoxesDashboard } from "@/modules/admin/data/boxes/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import {
  activateCreditPackAction,
  activateCreditPromotionAction,
  activatePlatformParameterAction,
  createCreditPackAction,
  createCreditPromotionAction,
  createPlatformParameterAction,
  grantCreditPromotionAction,
  type CommerceActionState,
} from "./commerce-actions";
import type { CommerceMessages } from "./commerce-messages";

const control = "min-h-11 w-full rounded-md border bg-background px-3";
const parameterKeys = ["DOCUMENT_EXPIRY_WARNING_DAYS", "VOLUME_RESERVATION_DEFAULT_TTL_HOURS", "CREDIT_PROMOTION_MAX_BONUS"];

function Feedback({ state, m, locale }: { state: CommerceActionState; m: CommerceMessages; locale: Locale }) {
  if (state.status === "idle") return null;
  if (state.status === "success") return <p role="status" className="text-sm text-primary">{state.outcome==="MANUAL_CREDIT_GRANT_REQUESTED"?(locale==="ar"?"جمد الطلب. راجعه شخص مالي آخر ثم نفذه من لوحة المنح تحت الرقابة المزدوجة.":"Demande figée. Une autre personne Finance doit la revoir puis l’exécuter dans les attributions sous double contrôle."):<>{m.success} {state.outcome}</>}</p>;
  return <p role="alert" className="text-sm text-destructive">{m.errors[state.reason]}</p>;
}

export function CommerceCatalogPanel({
  locale, catalog, wallets, m, auditOrganizationId, keys,
}: {
  locale: Locale;
  catalog: AdminCommerceCatalog;
  wallets: AdminBoxesDashboard["wallets"];
  m: CommerceMessages;
  auditOrganizationId: string | null;
  keys: Record<string, string>;
}) {
  const name = (fr: string, ar: string) => (locale === "ar" ? ar : fr);
  const canWrite = catalog.capabilities.can_write && Boolean(auditOrganizationId);
  const draftPacks = catalog.packs.filter((item) => item.status === "DRAFT");
  const draftPromotions = catalog.promotions.filter((item) => item.status === "DRAFT");
  const activePromotions = catalog.promotions.filter((item) => item.status === "ACTIVE");
  const draftParameters = catalog.parameters.filter((item) => item.status === "DRAFT");

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm leading-6 text-muted-foreground">{m.catalogHint}</p>
      <section aria-labelledby="credit-packs" className="space-y-3">
        <h3 id="credit-packs" className="text-lg font-semibold">{m.packs}</h3>
        {catalog.packs.length === 0 ? <p>{m.empty}</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {catalog.packs.map((item) => (
              <article key={item.id} className="rounded-xl border bg-card p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><strong>{name(item.name_fr, item.name_ar)}</strong><Badge>{item.status} · v{item.version}</Badge></div>
                <p dir="ltr">{item.code} · {item.quantity} cr · {item.price_minor} {item.currency} · {item.validity_days}j</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="credit-promotions" className="space-y-3">
        <h3 id="credit-promotions" className="text-lg font-semibold">{m.promotions}</h3>
        {catalog.promotions.length === 0 ? <p>{m.empty}</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {catalog.promotions.map((item) => (
              <article key={item.id} className="rounded-xl border bg-card p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><strong>{name(item.name_fr, item.name_ar)}</strong><Badge>{item.status} · v{item.version}</Badge></div>
                <p dir="ltr">{item.code} · {item.bonus_credits} cr</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="platform-parameters" className="space-y-3">
        <h3 id="platform-parameters" className="text-lg font-semibold">{m.parameters}</h3>
        {catalog.parameters.length === 0 ? <p>{m.empty}</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {catalog.parameters.map((item) => (
              <article key={item.id} className="rounded-xl border bg-card p-4 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><strong dir="ltr">{item.parameter_key}</strong><Badge>{item.status} · v{item.version}</Badge></div>
                <p dir="ltr">{item.value_integer}</p>
              </article>
            ))}
          </div>
        )}
      </section>
      {canWrite ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Form title={m.createPack} action={createCreditPackAction} keyValue={keys.pack} locale={locale} auditOrganizationId={auditOrganizationId!} m={m}>
            <Field label={m.packCode}><Input name="code" required className={control} dir="ltr" pattern="[A-Za-z][A-Za-z0-9_]{2,63}" /></Field>
            <Field label={m.nameFr}><Input name="nameFr" required minLength={2} className={control} /></Field>
            <Field label={m.nameAr}><Input name="nameAr" required minLength={2} className={control} /></Field>
            <Field label={m.quantity}><Input name="quantity" required inputMode="numeric" pattern="[1-9][0-9]*" className={control} dir="ltr" /></Field>
            <Field label={m.unitPrice}><Input name="priceMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" /></Field>
            <Field label={m.currency}><Input name="currency" required defaultValue="MAD" maxLength={3} className={control} dir="ltr" /></Field>
            <Field label={m.validityDays}><Input name="validityDays" required inputMode="numeric" pattern="[1-9][0-9]*" className={control} dir="ltr" defaultValue="365" /></Field>
          </Form>
          <Form title={m.activatePack} action={activateCreditPackAction} keyValue={keys.activatePack} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={draftPacks.length === 0}>
            <Select name="packVersionId" label={m.packs} values={draftPacks.map((item) => item.id)} labels={draftPacks.map((item) => `${item.code} v${item.version}`)} />
          </Form>
          <section className="grid gap-2 rounded border p-4">
            <h4 className="font-semibold">{name("Achats de packs vérifiés", "مشتريات حزم متحققة")}</h4>
            <p>{name("L’attribution d’un pack payé exige la capture confirmée par le prestataire de paiement et sa préparation comptable figée. Une référence saisie par l’Admin ne constitue pas une preuve de paiement. La configuration du pack reste disponible ici ; les cadeaux passent par la revue financière distincte.", "يتطلب منح حزمة مدفوعة دفعة مؤكدة من مقدم الدفع وإعدادها المحاسبي المجمد. لا يشكل المرجع الذي يدخله المسؤول دليلا على الدفع. يبقى إعداد الحزمة متاحا هنا، ويمر المنح المجاني بمراجعة مالية مستقلة.")}</p>
          </section>
          <Form title={m.createPromotion} action={createCreditPromotionAction} keyValue={keys.promotion} locale={locale} auditOrganizationId={auditOrganizationId!} m={m}>
            <Field label={m.code}><Input name="code" required className={control} dir="ltr" pattern="[A-Za-z][A-Za-z0-9_]{2,63}" /></Field>
            <Field label={m.nameFr}><Input name="nameFr" required minLength={2} className={control} /></Field>
            <Field label={m.nameAr}><Input name="nameAr" required minLength={2} className={control} /></Field>
            <Field label={m.bonus}><Input name="bonusCredits" required inputMode="numeric" pattern="[1-9][0-9]*" className={control} dir="ltr" /></Field>
            <Field label={m.validityDays}><Input name="validityDays" required inputMode="numeric" pattern="[1-9][0-9]*" className={control} dir="ltr" defaultValue="90" /></Field>
            <Field label={m.effectiveFrom}><Input name="effectiveFrom" type="date" required className={control} /></Field>
            <Field label={m.effectiveUntil}><Input name="effectiveUntil" type="date" className={control} /></Field>
          </Form>
          <Form title={m.activatePromotion} action={activateCreditPromotionAction} keyValue={keys.activatePromotion} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={draftPromotions.length === 0}>
            <Select name="promotionVersionId" label={m.promotions} values={draftPromotions.map((item) => item.id)} labels={draftPromotions.map((item) => `${item.code} v${item.version}`)} />
            <Field label={m.approval}><Input name="approvalReference" required minLength={3} className={control} /></Field>
          </Form>
          <Form title={m.grantPromotion} action={grantCreditPromotionAction} keyValue={keys.grantPromotion} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={activePromotions.length === 0 || wallets.length === 0}>
            <Select name="promotionVersionId" label={m.promotions} values={activePromotions.map((item) => item.id)} labels={activePromotions.map((item) => `${item.code} v${item.version}`)} />
            <Select name="walletId" label={m.wallet} values={wallets.map((item) => item.wallet_id)} labels={wallets.map((item) => item.organization_name)} />
            <Select name="organizationId" label={m.organization} values={wallets.map((item) => item.organization_id)} labels={wallets.map((item) => item.organization_name)} />
          </Form>
          <Form title={m.createParameter} action={createPlatformParameterAction} keyValue={keys.parameter} locale={locale} auditOrganizationId={auditOrganizationId!} m={m}>
            <Select name="parameterKey" label={m.parameterKey} values={parameterKeys} />
            <Field label={m.parameterValue}><Input name="valueInteger" required inputMode="numeric" pattern="[1-9][0-9]*" className={control} dir="ltr" /></Field>
            <Field label={m.reason}><Input name="changeReason" required minLength={10} className={control} /></Field>
          </Form>
          <Form title={m.activateParameter} action={activatePlatformParameterAction} keyValue={keys.activateParameter} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={draftParameters.length === 0}>
            <Select name="parameterVersionId" label={m.parameters} values={draftParameters.map((item) => item.id)} labels={draftParameters.map((item) => `${item.parameter_key} v${item.version}`)} />
          </Form>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1 text-sm">{label}{children}</label>;
}

function Select({ name, label, values, labels }: { name: string; label: string; values: string[]; labels?: string[] }) {
  return (
    <Field label={label}>
      <select name={name} required className={control} disabled={values.length === 0}>
        {values.map((value, index) => <option key={`${value}-${index}`} value={value}>{labels?.[index] ?? value}</option>)}
      </select>
    </Field>
  );
}

function Form({
  title, action, keyValue, locale, auditOrganizationId, m, children, disabled,
}: {
  title: string;
  action: (state: CommerceActionState, form: FormData) => Promise<CommerceActionState>;
  keyValue: string;
  locale: Locale;
  auditOrganizationId: string;
  m: CommerceMessages;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, commerceIdle);
  return (
    <article className="rounded-xl border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      <form action={formAction} className="mt-3 grid gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="idempotencyKey" value={keyValue} />
        <input type="hidden" name="auditOrganizationId" value={auditOrganizationId} />
        {children}
        <Button type="submit" disabled={pending || disabled} className="min-h-11">{pending ? m.processing : m.save}</Button>
        <Feedback state={state} m={m} locale={locale} />
      </form>
    </article>
  );
}
