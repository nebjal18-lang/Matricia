"use client";

import { useActionState } from "react";
import { Button } from "@/modules/shared/ui/button";
import { Input } from "@/modules/shared/ui/input";
import { formatMinorAmount, shortReference } from "@/modules/shared/lib/format/display";
import { decideApproval, reconcileForecast, recordForecast, requestApproval, type State } from "./actions";

const idle: State = { ok: false, message: "" };

function F({ name, label, type = "text" }: { name: string; label: string; type?: string }) {
  return (
    <label className="grid gap-1">
      {label}
      <Input name={name} type={type} required className="min-h-11" />
    </label>
  );
}

function feedLabel(locale: "fr" | "ar", message: string) {
  const ar = locale === "ar";
  const map: Record<string, string> = {
    RECORDED: ar ? "تم التسجيل." : "Enregistré.",
    VALIDATION: ar ? "تحققوا من الحقول والتواريخ والمبالغ." : "Vérifiez les champs, dates et montants.",
    FORBIDDEN: ar ? "صلاحيتكم لا تسمح بهذا الإجراء." : "Votre rôle ne permet pas cette action.",
    FAILED: ar ? "تعذر إتمام العملية. أعيدوا المحاولة." : "La commande n’a pas abouti. Réessayez.",
    MISSION_NOT_FOUND: ar ? "المهمة غير موجودة في النطاق الحالي." : "Mission introuvable dans le périmètre actuel.",
    RULE_NOT_FOUND: ar ? "قاعدة العمولة غير متاحة على نسخة العقد." : "Règle de commission indisponible sur la version de contrat.",
  };
  return map[message] ?? (ar ? "تعذر إتمام العملية." : "La commande n’a pas abouti.");
}

function Feed({ s, locale }: { s: State; locale: "fr" | "ar" }) {
  if (!s.message) return null;
  return (
    <p role={!s.ok ? "alert" : "status"} aria-live="polite">
      {feedLabel(locale, s.message)}
    </p>
  );
}

function K() {
  return <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />;
}

function resourceLabel(locale: "fr" | "ar", resourceType: string, resourceId: string) {
  const type = resourceType.trim().toLowerCase();
  const label =
    type.includes("campaign") ? (locale === "ar" ? "حملة" : "Campagne") :
    type.includes("mission") ? (locale === "ar" ? "مهمة" : "Mission") :
    type.includes("payable") ? (locale === "ar" ? "مستحق" : "Payable") :
    locale === "ar" ? "مورد" : "Ressource";
  return `${label} · ${shortReference(resourceId)}`;
}

function missionLabel(locale: "fr" | "ar", missionId: string) {
  return `${locale === "ar" ? "مهمة" : "Mission"} · ${shortReference(missionId)}`;
}

export function FinanceApprovalPanel({
  locale,
  requests,
  forecasts,
  campaigns,
  missions,
  payables,
}: {
  locale: "fr" | "ar";
  requests: Array<{ id: string; status: string; row_version: number; resource_type: string; resource_id: string }>;
  forecasts: Array<{ id: string; mission_id: string; estimated_commission_minor: string; currency: string }>;
  campaigns: Array<{ id: string; title_fr: string; title_ar: string; row_version: number }>;
  missions: Array<{ id: string }>;
  payables: Array<{ id: string; mission_id: string; commission_amount_minor: string; currency: string }>;
}) {
  const ar = locale === "ar";
  const pending = requests.filter((q) => q.status === "PENDING");
  const [r, ra, rp] = useActionState(requestApproval, idle);
  const [d, da, dp] = useActionState(decideApproval, idle);
  const [f, fa, fp] = useActionState(recordForecast, idle);
  const [x, xa, xp] = useActionState(reconcileForecast, idle);

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      <section id="rapprochements" className="grid scroll-mt-24 gap-4 xl:grid-cols-2">
        <form action={ra} className="grid gap-3 rounded-2xl border p-4">
          <h2 className="text-xl font-semibold">{ar ? "طلب موافقة حملة" : "Demander l’approbation d’une campagne"}</h2>
          <K />
          {!campaigns.length ? <p className="text-sm text-muted-foreground">{ar ? "لا حملة متاحة." : "Aucune campagne disponible."}</p> : null}
          <label>
            {ar ? "الحملة الموثقة" : "Campagne autoritative"}
            <select name="campaignSelection" required className="min-h-11 w-full rounded-md border" disabled={!campaigns.length}>
              {campaigns.map((c) => (
                <option key={c.id} value={`${c.id}|${c.row_version}`}>
                  {ar ? c.title_ar : c.title_fr}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={rp || !campaigns.length}>{ar ? "إرسال" : "Soumettre"}</Button>
          <Feed s={r} locale={locale} />
        </form>
        <form action={da} className="grid gap-3 rounded-2xl border p-4">
          <h2 className="text-xl font-semibold">{ar ? "قرار مستقل" : "Décision indépendante"}</h2>
          <K />
          {!pending.length ? <p className="text-sm text-muted-foreground">{ar ? "لا طلبات معلقة." : "Aucune demande en attente."}</p> : null}
          <label>
            {ar ? "الطلب" : "Demande"}
            <select name="requestSelection" required className="min-h-11 w-full rounded-md border" disabled={!pending.length}>
              {pending.map((q) => (
                <option key={q.id} value={`${q.id}|${q.row_version}`} title={`${q.resource_type}/${q.resource_id}`}>
                  {resourceLabel(locale, q.resource_type, q.resource_id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {ar ? "القرار" : "Décision"}
            <select name="decision" className="min-h-11 w-full rounded-md border" disabled={!pending.length}>
              <option value="APPROVE">{ar ? "موافقة" : "Approuver"}</option>
              <option value="REJECT">{ar ? "رفض" : "Rejeter"}</option>
            </select>
          </label>
          <F name="reason" label={ar ? "السبب" : "Motif"} />
          <Button disabled={dp || !pending.length}>{ar ? "تقرير" : "Décider"}</Button>
          <Feed s={d} locale={locale} />
        </form>
      </section>
      <section id="commissions" className="grid scroll-mt-24 gap-4 xl:grid-cols-2">
        <form action={fa} className="grid gap-3 rounded-2xl border p-4">
          <h2 className="text-xl font-semibold">{ar ? "توقع العمولة" : "Prévision de commission"}</h2>
          <p>{ar ? "تُقرأ القاعدة من نسخة العقد؛ لا يمكن تعديلها هنا." : "La règle est lue depuis la version du contrat et n’est pas modifiable ici."}</p>
          <K />
          <label>
            {ar ? "المهمة" : "Mission"}
            <select name="missionId" required className="min-h-11 w-full rounded-md border">
              {missions.map((m) => (
                <option key={m.id} value={m.id} title={m.id}>
                  {missionLabel(locale, m.id)}
                </option>
              ))}
            </select>
          </label>
          <F name="start" label={ar ? "من" : "Du"} type="date" />
          <F name="end" label={ar ? "إلى" : "Au"} type="date" />
          <F name="grossAmount" label={ar ? "الإجمالي التقديري بالدرهم" : "Brut estimé (MAD)"} />
          <Button disabled={fp || !missions.length}>{ar ? "تسجيل" : "Enregistrer"}</Button>
          <Feed s={f} locale={locale} />
        </form>
        <form action={xa} className="grid gap-3 rounded-2xl border p-4">
          <h2 className="text-xl font-semibold">{ar ? "مطابقة حدث الدفع" : "Réconcilier au payable réel"}</h2>
          <K />
          <label>
            {ar ? "التوقع" : "Prévision"}
            <select name="forecastId" className="min-h-11 w-full rounded-md border">
              {forecasts.map((q) => (
                <option key={q.id} value={q.id} title={q.mission_id}>
                  {missionLabel(locale, q.mission_id)} · {formatMinorAmount(q.estimated_commission_minor, q.currency, locale)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {ar ? "حدث الدفع الرسمي" : "Payable officiel"}
            <select name="payableEventId" className="min-h-11 w-full rounded-md border">
              {payables.map((p) => (
                <option key={p.id} value={p.id} title={p.mission_id}>
                  {missionLabel(locale, p.mission_id)} · {formatMinorAmount(p.commission_amount_minor, p.currency, locale)}
                </option>
              ))}
            </select>
          </label>
          <F name="reason" label={ar ? "السبب" : "Motif"} />
          <Button disabled={xp || !forecasts.length || !payables.length}>{ar ? "مطابقة" : "Réconcilier"}</Button>
          <Feed s={x} locale={locale} />
        </form>
      </section>
    </div>
  );
}
