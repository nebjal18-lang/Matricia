"use client";
import { formatMinorAmount } from "@/modules/shared/lib/format/display";
import { commerceIdle } from "@/modules/admin/screens/finance/commerce-state";

import { useActionState, useState, type ReactNode } from "react";
import { Badge } from "@/modules/shared/ui/badge";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import type { AdminCommerceCatalog } from "@/modules/admin/data/catalog/model";
import type { AdminBoxesDashboard } from "@/modules/admin/data/boxes/model";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
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
const parameterKeys = ["DOCUMENT_EXPIRY_WARNING_DAYS", "VOLUME_RESERVATION_DEFAULT_TTL_HOURS", "CREDIT_PROMOTION_MAX_BONUS", "BOX_PLATFORM_MARGIN_BPS"];

/**
 * Rôle /finance/credits (Gold Master §12.5 / 12.7) :
 * packs achetables, promotions (bonus ledger), paramètres plateforme versionnés.
 * Distinct de /finance/offres (catalogue plan/Box). Pas de preuve de paiement saisie à la main ici.
 */

function Feedback({ state, m, locale }: { state: CommerceActionState; m: CommerceMessages; locale: Locale }) {
  if (state.status === "idle") return null;
  if (state.status === "success") {
    return (
      <p role="status" className="text-sm text-primary">
        {state.outcome === "MANUAL_CREDIT_GRANT_REQUESTED"
          ? (locale === "ar"
            ? "جمد الطلب. راجعه شخص مالي آخر ثم نفذه من لوحة المنح تحت الرقابة المزدوجة."
            : "Demande figée. Une autre personne Finance doit la revoir puis l’exécuter dans les attributions sous double contrôle.")
          : <>{m.success} {localizeStatus(state.outcome, locale)}</>}
      </p>
    );
  }
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
  const clientWallets = wallets.filter((item) => item.wallet_type === "CLIENT");
  const canWrite = catalog.capabilities.can_write && Boolean(auditOrganizationId);
  const draftPacks = catalog.packs.filter((item) => item.status === "DRAFT");
  const draftPromotions = catalog.promotions.filter((item) => item.status === "DRAFT");
  const activePromotions = catalog.promotions.filter((item) => item.status === "ACTIVE");
  const draftParameters = catalog.parameters.filter((item) => item.status === "DRAFT");
  const hasAny = catalog.packs.length + catalog.promotions.length + catalog.parameters.length > 0;

  return (
    <div className="admin-finance-focus space-y-5">
      <p className="admin-finance-lead">
        {locale === "ar"
          ? "دور هذا القسم: ما يُشترى أو يُهدى كأرصدة إضافية (حزم، عروض) ومعاملات المنصة — منفصل عن ورشة عروض Box."
          : "Rôle de cette section : ce qui s’achète ou s’offre en crédits supplémentaires (packs, promotions) et les paramètres plateforme — distinct de l’atelier Offres Box."}
      </p>
      <p className="admin-finance-lead">{m.catalogHint}</p>

      {catalog.capabilities.can_write && !auditOrganizationId ? (
        <p role="status" className="admin-notice">
          {locale === "ar"
            ? "اختاروا مؤسسة في القسم 1 لفتح إنشاء الحزم والعروض."
            : "Choisissez une entreprise à la section 1 pour ouvrir la création des packs et promotions."}
        </p>
      ) : null}
      {auditOrganizationId && !catalog.capabilities.can_write ? (
        <p role="status" className="admin-notice" data-tone="warn">
          {locale === "ar"
            ? "قراءة فقط — الكتابة المالية مطلوبة للإنشاء."
            : "Lecture seule — une capacité d’écriture Finance est requise pour créer."}
        </p>
      ) : null}

      <p className="admin-finance-metrics-inline" role="status">
        <span>{m.packs} <strong dir="ltr">{catalog.packs.length}</strong></span>
        <span>{m.promotions} <strong dir="ltr">{catalog.promotions.length}</strong></span>
        <span>{m.parameters} <strong dir="ltr">{catalog.parameters.length}</strong></span>
      </p>

      {canWrite ? (
        <div className="admin-finance-actions space-y-4">
          <h4 className="admin-finance-actions-title">{m.createPack}</h4>
          <Form title={m.createPack} action={createCreditPackAction} keyValue={keys.pack} locale={locale} auditOrganizationId={auditOrganizationId!} m={m}>
              <Field label={m.packCode}><Input name="code" required className={control} dir="ltr" pattern="[A-Za-z][A-Za-z0-9_]{2,63}" /></Field>
              <Field label={m.nameFr}><Input name="nameFr" required minLength={2} className={control} /></Field>
              <Field label={m.nameAr}><Input name="nameAr" required minLength={2} className={control} /></Field>
              <Field label={m.quantity}><Input name="quantity" required inputMode="numeric" pattern="[1-9][0-9]*" className={control} dir="ltr" /></Field>
              <Field label={m.unitPrice}><Input name="priceMinor" required inputMode="numeric" pattern="[0-9]+" className={control} dir="ltr" /></Field>
              <Field label={m.currency}><Input name="currency" required defaultValue="MAD" maxLength={3} className={control} dir="ltr" /></Field>
              <Field label={m.validityDays}><Input name="validityDays" required inputMode="numeric" pattern="[1-9][0-9]*" className={control} dir="ltr" defaultValue="365" /></Field>
            </Form>
            <details className="client-card p-4">
              <summary className="min-h-11 cursor-pointer font-semibold">{m.activatePack}</summary>
              <div className="mt-4">
            <Form title={m.activatePack} action={activateCreditPackAction} keyValue={keys.activatePack} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={draftPacks.length === 0}>
              <Select name="packVersionId" label={m.packs} values={draftPacks.map((item) => item.id)} labels={draftPacks.map((item) => `${item.code} v${item.version}`)} />
            </Form>
              </div>
            </details>
            <details className="client-card p-4">
              <summary className="min-h-11 cursor-pointer font-semibold">{m.promotions}</summary>
              <div className="mt-4 grid gap-4">
            <aside className="admin-notice space-y-1" data-tone="sky" role="note">
              <strong>{name("Achats de packs vérifiés", "مشتريات حزم متحققة")}</strong>
              <p>
                {name(
                  "Un pack payé ne s’attribue ici que via capture prestataire de paiement + préparation comptable figée. Une référence saisie à la main n’est pas une preuve de paiement. Les cadeaux passent par la revue financière distincte.",
                  "لا يُمنح حزمة مدفوعة هنا إلا عبر تأكيد مقدم الدفع والإعداد المحاسبي المجمد. المرجع اليدوي ليس إثبات دفع. الهدايا تمر بمراجعة مالية مستقلة.",
                )}
              </p>
            </aside>
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
            <Form title={m.grantPromotion} action={grantCreditPromotionAction} keyValue={keys.grantPromotion} locale={locale} auditOrganizationId={auditOrganizationId!} m={m} disabled={activePromotions.length === 0 || clientWallets.length === 0}>
              <GrantPromotionFields activePromotions={activePromotions} wallets={wallets} m={m} />
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
            </details>
        </div>
      ) : null}

      {!hasAny ? (
        <div className="admin-finance-empty-block" role="status">
          <p>{locale === "ar" ? "لا حزم ولا عروض ولا معاملات بعد." : "Aucun pack, promotion ni paramètre pour l’instant."}</p>
          <p>
            {canWrite
              ? (locale === "ar" ? "أنشئوا حزمة أو عرضاً أعلاه عند الحاجة لشراء أرصدة إضافية." : "Créez un pack ou une promotion ci-dessus si vous devez vendre des crédits supplémentaires.")
              : (locale === "ar" ? "افتحوا سياق مؤسسة بصلاحية كتابة لبدء الكتالوج." : "Ouvrez un contexte entreprise avec droit d’écriture pour démarrer le catalogue.")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {catalog.packs.length ? (
            <CatalogBlock title={m.packs}>
              {catalog.packs.map((item) => (
                <article key={item.id} className="admin-finance-row text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{name(item.name_fr, item.name_ar)}</strong>
                    <Badge>{localizeStatus(item.status, locale)} · v{item.version}</Badge>
                  </div>
                  <p dir="ltr">{item.code} · {item.quantity} cr · {formatMinorAmount(item.price_minor, item.currency, locale)} · {item.validity_days}j</p>
                </article>
              ))}
            </CatalogBlock>
          ) : null}
          <details className="client-card p-4">
            <summary className="min-h-11 cursor-pointer font-semibold">{m.promotions} · {m.parameters}</summary>
            <div className="mt-4 space-y-4">
          {catalog.promotions.length ? (
            <CatalogBlock title={m.promotions}>
              {catalog.promotions.map((item) => (
                <article key={item.id} className="admin-finance-row text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{name(item.name_fr, item.name_ar)}</strong>
                    <Badge>{localizeStatus(item.status, locale)} · v{item.version}</Badge>
                  </div>
                  <p dir="ltr">{item.code} · {item.bonus_credits} cr</p>
                </article>
              ))}
            </CatalogBlock>
          ) : null}
          {catalog.parameters.length ? (
            <CatalogBlock title={m.parameters}>
              {catalog.parameters.map((item) => (
                <article key={item.id} className="admin-finance-row text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong dir="ltr">{item.parameter_key}</strong>
                    <Badge>{localizeStatus(item.status, locale)} · v{item.version}</Badge>
                  </div>
                  <p dir="ltr">{item.value_integer}</p>
                </article>
              ))}
            </CatalogBlock>
          ) : null}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function CatalogBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="admin-finance-subhead">{title}</h4>
      <div className="admin-finance-list">{children}</div>
    </section>
  );
}

function GrantPromotionFields({
  activePromotions,
  wallets,
  m,
}: {
  activePromotions: AdminCommerceCatalog["promotions"];
  wallets: AdminBoxesDashboard["wallets"];
  m: CommerceMessages;
}) {
  const clientWallets = wallets.filter((item) => item.wallet_type === "CLIENT");
  const [walletId, setWalletId] = useState("");
  const organizationId = clientWallets.find((item) => item.wallet_id === walletId)?.organization_id ?? "";
  return (
    <>
      <Select name="promotionVersionId" label={m.promotions} values={activePromotions.map((item) => item.id)} labels={activePromotions.map((item) => `${item.code} v${item.version}`)} />
      <Field label={m.wallet}>
        <select name="walletId" required className={control} value={walletId} onChange={(event) => setWalletId(event.target.value)} disabled={clientWallets.length === 0}>
          <option value="" disabled>—</option>
          {clientWallets.map((item) => (
            <option key={item.wallet_id} value={item.wallet_id} title={item.wallet_id}>{item.organization_name}</option>
          ))}
        </select>
      </Field>
      <input type="hidden" name="organizationId" value={organizationId} />
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
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
  children: ReactNode;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, commerceIdle);
  return (
    <article className="admin-finance-form">
      <h4>{title}</h4>
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
