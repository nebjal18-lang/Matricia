"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { applyMarginBps, sumWholesaleCosts } from "@/modules/admin/data/wholesale/margin";
import type { WholesaleCatalog, WholesaleOffer } from "@/modules/admin/data/wholesale/model";
import { formatMinor } from "@/modules/shared/lib/subscriptions/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { createBoxFromWholesaleAction, type CommerceActionState } from "./commerce-actions";
import { commerceIdle } from "./commerce-state";
import type { CommerceMessages } from "./commerce-messages";

const control = "min-h-11 w-full rounded-md border bg-background px-3";

function groupByCategory(offers: WholesaleOffer[], locale: Locale) {
  const map = new Map<string, { title: string; items: WholesaleOffer[] }>();
  for (const offer of offers) {
    const key = offer.category_code;
    const title = locale === "ar" ? offer.category_name_ar : offer.category_name_fr;
    const current = map.get(key) ?? { title, items: [] };
    current.items.push(offer);
    map.set(key, current);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function subjectMatch(offer: WholesaleOffer, subject: string): boolean {
  const needle = subject.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    offer.service_name_fr,
    offer.service_name_ar,
    offer.category_name_fr,
    offer.category_name_ar,
    offer.sku_code,
    offer.category_code,
    offer.agreement_code,
    offer.provider_name,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function BoxWholesaleWorkshop({
  locale,
  catalog,
  auditOrganizationId,
  m,
  createKey,
}: {
  locale: Locale;
  catalog: WholesaleCatalog | null;
  auditOrganizationId: string | null;
  m: CommerceMessages;
  createKey: string;
}) {
  const ar = locale === "ar";
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"manual" | "assisted">("manual");
  const [subject, setSubject] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [code, setCode] = useState("");
  const [state, formAction, pending] = useActionState(createBoxFromWholesaleAction, commerceIdle);

  const offers = catalog?.offers ?? [];
  const marginBps = catalog?.margin_bps ?? 1500;
  const visible = useMemo(() => {
    if (mode === "assisted" && subject.trim()) {
      return offers.filter((offer) => subjectMatch(offer, subject));
    }
    return offers;
  }, [mode, offers, subject]);

  const selectedOffers = useMemo(
    () => offers.filter((offer) => selected[offer.commitment_id]),
    [offers, selected],
  );

  const wholesaleTotal = useMemo(() => {
    try {
      return sumWholesaleCosts(selectedOffers.map((offer) => offer.wholesale_unit_price_minor));
    } catch {
      return BigInt(0);
    }
  }, [selectedOffers]);

  const proposedTotal = useMemo(() => {
    try {
      return applyMarginBps(wholesaleTotal, marginBps);
    } catch {
      return wholesaleTotal;
    }
  }, [wholesaleTotal, marginBps]);

  const currency = selectedOffers[0]?.currency ?? "MAD";
  const groups = groupByCategory(visible, locale);

  function toggle(id: string) {
    setSelected((current) => ({ ...current, [id]: !current[id] }));
  }

  function applyAssisted() {
    const next: Record<string, boolean> = {};
    for (const offer of offers) {
      if (subjectMatch(offer, subject)) next[offer.commitment_id] = true;
    }
    setSelected(next);
    if (!nameFr.trim()) setNameFr(ar ? "" : `Box ${subject.trim() || catalog?.territory_code || ""}`.trim());
    if (!nameAr.trim()) setNameAr(ar ? `صندوق ${subject.trim() || catalog?.territory_code || ""}`.trim() : "");
  }

  const payload = JSON.stringify(
    selectedOffers.map((offer) => ({
      commitment_id: offer.commitment_id,
      category_code: offer.category_code,
      sku_code: offer.sku_code,
      wholesale_unit_price_minor: offer.wholesale_unit_price_minor,
      provider_organization_id: offer.provider_organization_id,
      service_name_fr: offer.service_name_fr,
      service_name_ar: offer.service_name_ar,
    })),
  );

  return (
    <div className="admin-finance-focus space-y-5">
      {!catalog ? (
        <p role="status" className="admin-notice">
          {ar
            ? "اختاروا إقليماً أعلاه لعرض عروض الجملة."
            : "Choisissez un territoire ci-dessus pour afficher les offres de gros."}
        </p>
      ) : (
        <>
          <section id="box-compose" className="admin-panel admin-offer-compose space-y-4 scroll-mt-24" aria-labelledby="box-compose-title">
            <div className="admin-section-head">
              <div>
                <h3 id="box-compose-title">{ar ? "تكوين صندوق Combo" : "Composition de la Box combo"}</h3>
                <p>
                  {ar
                    ? `الإقليم ${catalog.territory_code} · هامش ${marginBps} نقطة أساس · ${selectedOffers.length} خط مختار`
                    : `Territoire ${catalog.territory_code} · marge ${marginBps} bps · ${selectedOffers.length} ligne(s) retenue(s)`}
                </p>
              </div>
            </div>

            {selectedOffers.length === 0 ? (
              <p role="status" className="admin-finance-empty">
                {ar ? "اختاروا خطوطاً في الكتالوج أسفل الصفحة." : "Sélectionnez des lignes dans le catalogue ci-dessous."}
              </p>
            ) : (
              <ul className="admin-finance-list text-sm">
                {selectedOffers.map((offer) => (
                  <li key={offer.commitment_id} className="admin-finance-row flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {(ar ? offer.service_name_ar : offer.service_name_fr)} · {offer.provider_name}
                    </span>
                    <span className="flex items-center gap-3">
                      <strong dir="ltr">{formatMinor(offer.wholesale_unit_price_minor, offer.currency, locale)}</strong>
                      <button type="button" className="admin-text-link min-h-11" onClick={() => toggle(offer.commitment_id)}>
                        {ar ? "إزالة" : "Retirer"}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="admin-finance-metrics-inline" role="status">
              <span>
                {ar ? "تكلفة الجملة" : "Coût gros"}{" "}
                <strong dir="ltr">{formatMinor(wholesaleTotal.toString(), currency, locale)}</strong>
              </span>
              <span>
                {ar ? "السعر المقترح" : "Prix proposé"}{" "}
                <strong dir="ltr">{formatMinor(proposedTotal.toString(), currency, locale)}</strong>
              </span>
            </p>

            {auditOrganizationId ? (
              <form action={formAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="idempotencyKey" value={createKey} />
                <input type="hidden" name="auditOrganizationId" value={auditOrganizationId} />
                <input type="hidden" name="territoryCode" value={catalog.territory_code} />
                <input type="hidden" name="marginBps" value={String(marginBps)} />
                <input type="hidden" name="subject" value={subject} />
                <input type="hidden" name="offersJson" value={payload} />
                <input type="hidden" name="currency" value={currency} />
                <input type="hidden" name="wholesaleTotalMinor" value={wholesaleTotal.toString()} />
                <input type="hidden" name="proposedTotalMinor" value={proposedTotal.toString()} />
                <label className="grid gap-1 text-sm">
                  {m.code}
                  <Input name="code" required className={control} dir="ltr" pattern="[A-Z][A-Z0-9_]{2,79}" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
                </label>
                <label className="grid gap-1 text-sm">
                  {m.budget}
                  <Input name="creditBudget" required className={control} dir="ltr" inputMode="numeric" pattern="[0-9]+" defaultValue="0" />
                </label>
                <label className="grid gap-1 text-sm">
                  {m.nameFr}
                  <Input name="nameFr" required minLength={2} className={control} value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">
                  {m.nameAr}
                  <Input name="nameAr" required minLength={2} className={control} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
                </label>
                <div className="md:col-span-2">
                  <Button type="submit" className="min-h-11" disabled={pending || selectedOffers.length === 0}>
                    {pending ? m.processing : ar ? "تسجيل مسودة الصندوق" : "Enregistrer le brouillon de Box"}
                  </Button>
                </div>
                <Feedback state={state} m={m} />
              </form>
            ) : (
              <p role="status" className="admin-notice">
                {ar
                  ? "أكدوا مؤسسة مرجعية أعلاه قبل تسجيل الصندوق."
                  : "Confirmez une entreprise de référence ci-dessus avant d’enregistrer la Box."}
              </p>
            )}
          </section>

          <div className="admin-section-head">
            <div>
              <h2 id="wholesale-catalog-title">
                {ar ? "كتالوج عروض الجملة" : "Catalogue des offres de gros"}
              </h2>
              <p>
                {ar
                  ? `${offers.length} عرض · اختاروا ثم راجعوا التكوين أعلاه`
                  : `${offers.length} offre(s) · sélectionnez puis validez la composition ci-dessus`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label={ar ? "وضع الإنشاء" : "Mode de création"}>
            <Button type="button" variant={mode === "manual" ? "default" : "outline"} className="min-h-11" onClick={() => setMode("manual")}>
              {ar ? "اختيار يدوي" : "Sélection manuelle"}
            </Button>
            <Button type="button" variant={mode === "assisted" ? "default" : "outline"} className="min-h-11" onClick={() => setMode("assisted")}>
              {ar ? "مساعدة حسب الموضوع" : "Assisté par sujet"}
            </Button>
          </div>

          {mode === "assisted" ? (
            <div className="admin-finance-row grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="grid gap-1 text-sm">
                {ar ? "الموضوع (مثال: إنشاء شركة، موقع، تسويق)" : "Sujet (ex. création entreprise, site, marketing)"}
                <Input className={control} value={subject} onChange={(event) => setSubject(event.target.value)} />
              </label>
              <Button type="button" className="min-h-11 self-end" onClick={applyAssisted} disabled={!subject.trim() || offers.length === 0}>
                {ar ? "اقتراح التوليفة" : "Proposer la combinaison"}
              </Button>
            </div>
          ) : null}

          {offers.length === 0 ? (
            <p role="status" className="admin-finance-empty">
              {ar ? "لا عروض جملة نشطة لهذا الإقليم." : "Aucune offre de gros active pour ce territoire."}
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map(([categoryCode, group], index) => (
                <details key={categoryCode} className="admin-offer-category" open={index === 0}>
                  <summary id={`cat-${categoryCode}`}>
                    {group.title} <span dir="ltr">({group.items.length})</span>
                  </summary>
                  <div className="admin-finance-list mt-3">
                    {group.items.map((offer) => {
                      const service = ar ? offer.service_name_ar : offer.service_name_fr;
                      const checked = Boolean(selected[offer.commitment_id]);
                      return (
                        <article key={offer.commitment_id} className="admin-offer-line" data-selected={checked ? "true" : undefined}>
                          <div className="admin-offer-line__main">
                            <label className="flex min-w-0 flex-1 items-start gap-3 text-sm">
                              <input
                                type="checkbox"
                                className="mt-1 size-5"
                                checked={checked}
                                onChange={() => toggle(offer.commitment_id)}
                              />
                              <span className="min-w-0 space-y-1">
                                <strong className="block text-base">{service}</strong>
                                <span className="block text-muted-foreground">
                                  {offer.provider_name}
                                  {offer.franchise_name ? ` · ${offer.franchise_name}` : ""}
                                </span>
                                <span className="block font-semibold" dir="ltr">
                                  {formatMinor(offer.wholesale_unit_price_minor, offer.currency, locale)}
                                  {" · "}
                                  {ar ? "مقترح" : "proposé"} {formatMinor(offer.proposed_pack_price_minor, offer.currency, locale)}
                                </span>
                              </span>
                            </label>
                            <Button type="button" variant={checked ? "outline" : "default"} className="min-h-11 shrink-0" onClick={() => toggle(offer.commitment_id)}>
                              {checked ? (ar ? "إزالة" : "Retirer") : ar ? "إضافة" : "Ajouter"}
                            </Button>
                          </div>
                          <details className="admin-offer-line__more">
                            <summary>{ar ? "التفاصيل" : "Détails"}</summary>
                            <dl className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
                              <div>
                                <dt className="text-muted-foreground">{ar ? "سعر الجملة" : "Prix de gros"}</dt>
                                <dd dir="ltr">{formatMinor(offer.wholesale_unit_price_minor, offer.currency, locale)}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">SKU</dt>
                                <dd dir="ltr">{offer.sku_code}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">{ar ? "الاتفاق" : "Accord"}</dt>
                                <dd dir="ltr">{offer.agreement_code}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">{ar ? "المكتبة / الفئة" : "Bibliothèque / catégorie"}</dt>
                                <dd dir="ltr">{offer.library_code} · {offer.category_code}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">{ar ? "الكمية والوحدة" : "Quantité / unité"}</dt>
                                <dd dir="ltr">{offer.pack_quantity} {offer.unit_code}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">{ar ? "تكلفة مرجعية" : "Coût de référence"}</dt>
                                <dd dir="ltr">{formatMinor(offer.reference_cost_minor, offer.sku_currency, locale)}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">{ar ? "القدرة المتبقية" : "Capacité restante"}</dt>
                                <dd dir="ltr">{offer.remaining_units}/{offer.capacity_units}</dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="text-muted-foreground">{ar ? "الأقاليم" : "Régions"}</dt>
                                <dd dir="ltr">{offer.region_codes.join(", ")}</dd>
                              </div>
                            </dl>
                          </details>
                        </article>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Feedback({ state, m }: { state: CommerceActionState; m: CommerceMessages }) {
  if (state.status === "idle") return null;
  if (state.status === "success") {
    return (
      <p role="status" className="text-sm text-primary md:col-span-2">
        {m.success} {state.outcome}
      </p>
    );
  }
  return (
    <p role="alert" className="text-sm text-destructive md:col-span-2">
      {m.errors[state.reason]}
    </p>
  );
}
