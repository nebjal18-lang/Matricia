"use client";
import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/modules/shared/ui/button";
import { Label } from "@/modules/shared/ui/label";
import { Textarea } from "@/modules/shared/ui/textarea";
import { moroccoRegions } from "@/modules/shared/lib/geo/morocco-regions";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { declareProviderRegions, type ProviderActionState } from "./actions";
import type { ProviderMessages } from "./messages";

const idle: ProviderActionState = { status: "idle" };

export function RegionsForm({ organizationId, locale, messages, current, idempotencyKey }: {
  organizationId: string;
  locale: Locale;
  messages: ProviderMessages;
  current: readonly string[];
  idempotencyKey: string;
}) {
  const router = useRouter();
  const prefix = useId();
  const [state, action, pending] = useActionState(declareProviderRegions, idle);
  const [key, setKey] = useState(idempotencyKey);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(current));

  useEffect(() => {
    if (pending || state.status !== "success") return;
    const timer = window.setTimeout(() => { setKey(crypto.randomUUID()); router.refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [pending, router, state.status]);

  const toggle = (code: string, checked: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    if (checked) next.add(code); else next.delete(code);
    return next;
  });

  const feedback = state.status === "success" ? messages.success
    : state.status === "error" ? (state.reason === "VALIDATION" ? messages.validation : state.reason === "FORBIDDEN" ? messages.forbidden : state.reason === "CONFLICT" ? messages.conflict : messages.failed)
    : "";

  return (
    <section id="zones" aria-labelledby={`${prefix}-title`} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
      <h2 id={`${prefix}-title`} className="text-xl font-semibold">{messages.regions}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{messages.regionsHelp}</p>
      {current.length === 0 ? <p role="status" className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-950">{messages.regionsEmpty}</p> : null}
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="idempotencyKey" value={key} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{messages.regionsLegend}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {moroccoRegions.map((region) => (
              <label key={region.code} className="flex min-h-11 items-center gap-3 rounded-md border px-3">
                <input
                  type="checkbox"
                  name="regionCodes"
                  value={region.code}
                  checked={selected.has(region.code)}
                  onChange={(event) => toggle(region.code, event.target.checked)}
                  className="size-5 accent-primary"
                />
                <span>{locale === "ar" ? region.nameAr : region.nameFr}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="min-w-0 space-y-2">
          <Label htmlFor={`${prefix}-reason`}>{messages.regionsReason}</Label>
          <Textarea id={`${prefix}-reason`} name="reason" required minLength={3} maxLength={500} />
        </div>
        <Button disabled={pending || selected.size === 0} className="min-h-11 w-full sm:w-auto">
          {pending ? messages.pending : messages.saveRegions}
        </Button>
        <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className={state.status === "error" ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-primary"}>{feedback}</p>
      </form>
    </section>
  );
}
