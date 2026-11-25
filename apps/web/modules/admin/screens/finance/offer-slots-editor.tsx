"use client";

import { useMemo, useState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { localizeStatus } from "@/modules/admin/data/spaces/view-model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { CommerceMessages } from "./commerce-messages";

type BenefitOption = {
  id: string;
  code: string;
  version: number;
  name_fr: string;
  name_ar: string;
  benefit_type: string;
  fulfillment_mode: string;
};

type SlotDraft = {
  key: string;
  slot_code: string;
  slot_kind: "MANDATORY" | "OPTIONAL";
  minimum_selections: string;
  maximum_selections: string;
  allowed_benefit_version_ids: string[];
};

const control = "min-h-11 w-full rounded-md border bg-background px-3";

function emptySlot(seed: string): SlotDraft {
  return {
    key: seed,
    slot_code: "",
    slot_kind: "MANDATORY",
    minimum_selections: "1",
    maximum_selections: "1",
    allowed_benefit_version_ids: [],
  };
}

/** Compose une offre Box : plusieurs catégories/services (ex. COMPTABLE + MARKETING). */
export function OfferSlotsEditor({
  locale,
  m,
  benefits,
}: {
  locale: Locale;
  m: CommerceMessages;
  benefits: BenefitOption[];
}) {
  const name = (fr: string, ar: string) => (locale === "ar" ? ar : fr);
  const [slots, setSlots] = useState<SlotDraft[]>([emptySlot("slot-a")]);

  const payload = useMemo(
    () =>
      JSON.stringify(
        slots
          .filter((slot) => slot.slot_code.trim())
          .map((slot) => ({
            slot_code: slot.slot_code.trim().toUpperCase(),
            slot_kind: slot.slot_kind,
            minimum_selections: Number(slot.minimum_selections || "0"),
            maximum_selections: Number(slot.maximum_selections || "1"),
            allowed_benefit_version_ids: slot.allowed_benefit_version_ids,
          })),
      ),
    [slots],
  );

  return (
    <fieldset className="admin-finance-slots grid gap-3 sm:col-span-2">
      <legend className="admin-finance-subhead">{m.slotsTitle}</legend>
      <p className="admin-finance-lead">{m.slotsHint}</p>
      <input type="hidden" name="slotsJson" value={payload} />
      {slots.map((slot, index) => (
        <article key={slot.key} className="admin-finance-row space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong>
              {locale === "ar" ? "خدمة / فئة" : "Service / catégorie"} {index + 1}
            </strong>
            {slots.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setSlots((current) => current.filter((item) => item.key !== slot.key))}
              >
                {m.removeSlot}
              </Button>
            ) : null}
          </div>
          <label className="grid gap-1 text-sm">
            {m.slotCode}
            <Input
              className={control}
              dir="ltr"
              pattern="[A-Z][A-Z0-9_]{1,39}"
              value={slot.slot_code}
              onChange={(event) => {
                const value = event.target.value.toUpperCase();
                setSlots((current) => current.map((item) => (item.key === slot.key ? { ...item, slot_code: value } : item)));
              }}
              required
            />
          </label>
          <label className="grid gap-1 text-sm">
            {m.slotKind}
            <select
              className={control}
              value={slot.slot_kind}
              onChange={(event) => {
                const value = event.target.value === "OPTIONAL" ? "OPTIONAL" : "MANDATORY";
                setSlots((current) => current.map((item) => (item.key === slot.key ? { ...item, slot_kind: value } : item)));
              }}
            >
              <option value="MANDATORY">{localizeStatus("MANDATORY", locale)}</option>
              <option value="OPTIONAL">{localizeStatus("OPTIONAL", locale)}</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              {m.slotMin}
              <Input
                className={control}
                dir="ltr"
                inputMode="numeric"
                value={slot.minimum_selections}
                onChange={(event) => setSlots((current) => current.map((item) => (item.key === slot.key ? { ...item, minimum_selections: event.target.value } : item)))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              {m.slotMax}
              <Input
                className={control}
                dir="ltr"
                inputMode="numeric"
                value={slot.maximum_selections}
                onChange={(event) => setSlots((current) => current.map((item) => (item.key === slot.key ? { ...item, maximum_selections: event.target.value } : item)))}
              />
            </label>
          </div>
          <fieldset className="grid gap-2 text-sm">
            <legend>{m.allowedBenefits}</legend>
            {benefits.length === 0 ? (
              <p className="admin-finance-empty">
                {locale === "ar" ? "أنشئوا أولاً الخدمات في الخطوة 1 ثم اختاروها هنا." : "Créez d’abord les services à l’étape 1, puis sélectionnez-les ici."}
              </p>
            ) : (
              benefits.map((benefit) => {
                const checked = slot.allowed_benefit_version_ids.includes(benefit.id);
                return (
                  <label key={`${slot.key}-${benefit.id}`} className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={checked}
                      onChange={(event) => {
                        setSlots((current) =>
                          current.map((item) => {
                            if (item.key !== slot.key) return item;
                            const next = event.target.checked
                              ? [...item.allowed_benefit_version_ids, benefit.id]
                              : item.allowed_benefit_version_ids.filter((id) => id !== benefit.id);
                            return { ...item, allowed_benefit_version_ids: [...new Set(next)] };
                          }),
                        );
                      }}
                    />
                    <span>
                      {name(benefit.name_fr, benefit.name_ar)}{" "}
                      <span dir="ltr" className="text-muted-foreground">
                        ({benefit.code} v{benefit.version} · {localizeStatus(benefit.benefit_type, locale)} · {localizeStatus(benefit.fulfillment_mode, locale)})
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </fieldset>
        </article>
      ))}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 justify-self-start"
        onClick={() => setSlots((current) => [...current, emptySlot(`slot-${current.length + 1}-${Date.now()}`)])}
      >
        {m.addSlot}
      </Button>
    </fieldset>
  );
}
