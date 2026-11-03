"use client";

import { useActionState } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { saveDeliveryPreparation, type PreparationState } from "./actions";
import { boxFieldLabel, preparationFieldLabel, type PreparationItem, type PreparationSection } from "./model";

const idle: PreparationState = { status: "idle" };

function message(locale: Locale, state: PreparationState) {
  if (state.status !== "error") return null;
  const fr = locale === "fr";
  if (state.reason === "CONFLICT") return fr ? "Ce brouillon a changé. Rechargez la page avant de l’enregistrer à nouveau." : "تغيّرت هذه المسودة. أعيدوا تحميل الصفحة قبل حفظها من جديد.";
  if (state.reason === "DENIED") return fr ? "Ce compte ne peut pas enregistrer cette préparation." : "لا يمكن لهذا الحساب حفظ هذا الإعداد.";
  if (state.reason === "VALIDATION") return fr ? "La valeur ne respecte pas le format attendu." : "القيمة لا تطابق الصيغة المطلوبة.";
  return fr ? "L’enregistrement n’a pas abouti. Réessayez." : "تعذر الحفظ. أعيدوا المحاولة.";
}

export function PreparationField({ locale, section, item, idempotencyKey, secret = false, multiline = false }: { locale: Locale; section: PreparationSection; item: PreparationItem; idempotencyKey: string; secret?: boolean; multiline?: boolean }) {
  const fr = locale === "fr";
  const [state, action, pending] = useActionState(saveDeliveryPreparation, idle);
  const fieldId = `${section}-${item.key}`.replace(/[^A-Za-z0-9_-]/gu, "-");
  const secretId = `${fieldId}-secret`;
  const label = preparationFieldLabel(locale, section, item.key);
  const controlClass = "min-h-11 w-full rounded-md border bg-background px-3 py-2";
  return (
    <form action={action} className="grid gap-2 rounded-xl border p-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="itemKey" value={item.key} />
      <input type="hidden" name="rowVersion" value={item.row_version} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
      {item.reference ? <p className="text-sm text-muted-foreground">{fr ? "Texte français de référence : " : "النص الفرنسي المرجعي: "}{item.reference}</p> : null}
      {multiline ? <textarea id={fieldId} name="valueText" required rows={4} defaultValue={item.value ?? ""} className={controlClass} /> : <input id={fieldId} name="valueText" required defaultValue={item.value ?? ""} className={controlClass} />}
      {secret ? (
        <>
          <label htmlFor={secretId} className="text-sm font-medium">{fr ? "Clé ou mot de passe du prestataire" : "مفتاح أو كلمة سر المزوّد"}</label>
          <input id={secretId} name="secret" type="password" autoComplete="new-password" className={controlClass} />
          <p className="text-sm text-muted-foreground">{item.secret_present ? (fr ? "Un secret est déjà enregistré. Laissez ce champ vide pour le conserver. Il n’est jamais réaffiché." : "يوجد سر محفوظ. اتركوا الحقل فارغاً للإبقاء عليه. لا يُعرض مرة أخرى.") : (fr ? "Le secret est enregistré à part et n’est jamais réaffiché." : "يُحفظ السر بشكل منفصل ولا يُعرض مرة أخرى.")}</p>
        </>
      ) : null}
      <button className="client-cta w-fit" disabled={pending}>{pending ? (fr ? "Enregistrement…" : "جارٍ الحفظ…") : (fr ? "Enregistrer le brouillon" : "حفظ المسودة")}</button>
      {item.value ? <p className="text-sm">{fr ? "Brouillon enregistré. Il ne modifie ni le site public, ni le catalogue publié, ni une intégration active." : "المسودة محفوظة. لا تغيّر الموقع العام ولا الدليل المنشور ولا تكاملاً نشطاً."}</p> : null}
      {state.status === "success" ? <p role="status">{fr ? "Brouillon enregistré." : "تم حفظ المسودة."}</p> : null}
      {state.status === "error" ? <p role="alert">{message(locale, state)}</p> : null}
    </form>
  );
}

export function BoxFormulaForm({ locale, idempotencyKeys }: { locale: Locale; idempotencyKeys: { quota: string; privileges: string; conditions: string } }) {
  const fr = locale === "fr";
  const [state, action, pending] = useActionState(async (previous: PreparationState, formData: FormData) => {
    const code = String(formData.get("planCode") ?? "").trim().toUpperCase();
    const fields = [
      ["QUOTA", "quota", idempotencyKeys.quota],
      ["PRIVILEGES", "privileges", idempotencyKeys.privileges],
      ["CONDITIONS", "conditions", idempotencyKeys.conditions],
    ] as const;
    let latest = previous;
    for (const [field, name, key] of fields) {
      const data = new FormData();
      data.set("locale", locale);
      data.set("section", "BOX");
      data.set("itemKey", `PLAN:${code}:${field}`);
      data.set("valueText", String(formData.get(name) ?? ""));
      data.set("rowVersion", "0");
      data.set("idempotencyKey", key);
      latest = await saveDeliveryPreparation(previous, data);
      if (latest.status === "error") return latest;
    }
    return latest;
  }, idle);
  return (
    <form action={action} className="grid gap-2 rounded-xl border p-3">
      <h3 className="text-base font-medium">{fr ? "Nouvelle formule" : "صيغة جديدة"}</h3>
      <label htmlFor="plan-code" className="text-sm font-medium">{fr ? "Code de la formule" : "رمز الصيغة"}</label>
      <input id="plan-code" name="planCode" required pattern="[A-Za-z][A-Za-z0-9_-]{1,40}" className="min-h-11 w-full rounded-md border bg-background px-3" />
      {(["QUOTA", "PRIVILEGES", "CONDITIONS"] as const).map((field) => {
        const name = field === "QUOTA" ? "quota" : field === "PRIVILEGES" ? "privileges" : "conditions";
        const id = `plan-${name}`;
        return (
          <div key={field} className="grid gap-2">
            <label htmlFor={id} className="text-sm font-medium">{boxFieldLabel(locale, field)}</label>
            <textarea id={id} name={name} required rows={3} className="min-h-11 w-full rounded-md border bg-background px-3 py-2" />
          </div>
        );
      })}
      <button className="client-cta w-fit" disabled={pending}>{pending ? (fr ? "Enregistrement…" : "جارٍ الحفظ…") : (fr ? "Enregistrer la formule en brouillon" : "حفظ الصيغة كمسودة")}</button>
      <p className="text-sm text-muted-foreground">{fr ? "Ces textes restent en préparation. Ils ne créent ni prix, ni quota applicable, ni offre publique." : "تبقى هذه النصوص قيد الإعداد. لا تنشئ سعراً ولا حصة مطبّقة ولا عرضاً عاماً."}</p>
      {state.status === "success" ? <p role="status">{fr ? "Formule enregistrée en brouillon." : "تم حفظ الصيغة كمسودة."}</p> : null}
      {state.status === "error" ? <p role="alert">{message(locale, state)}</p> : null}
    </form>
  );
}
