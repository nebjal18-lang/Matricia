"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { ProviderNavKey } from "@/modules/provider/ui/provider-nav";
import { providerContextLandHash } from "./provider-context-land";

export function ProviderOrganizationSelector({
  locale,
  organizations,
  selectedOrganizationId,
  returnPath,
  active,
}: {
  locale: Locale;
  organizations: readonly { id: string; name: string }[];
  selectedOrganizationId: string | null;
  returnPath: string;
  active: ProviderNavKey;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const base = returnPath.split("?")[0] ?? returnPath;
  const landHash = providerContextLandHash(active);
  const ar = locale === "ar";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const organizationId = String(data.get("organizationId") ?? "");
    if (!organizationId) return;
    const params = new URLSearchParams();
    params.set("organizationId", organizationId);
    if (active === "home") params.set("workspace", "provider");
    const href = `${base}?${params.toString()}${landHash}`;
    startTransition(() => {
      router.replace(href);
    });
    if (!landHash) return;
    window.setTimeout(() => {
      const target = document.getElementById(landHash.slice(1));
      if (!(target instanceof HTMLElement)) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      const focusable = target.querySelector<HTMLElement>("input,select,textarea,button,a");
      focusable?.focus({ preventScroll: true });
    }, 350);
  }

  return (
    <form onSubmit={onSubmit} className="client-card mx-4 flex flex-wrap items-end gap-3">
      {active === "home" ? <input type="hidden" name="workspace" value="provider" /> : null}
      <label className="grid gap-2" htmlFor="provider-organization-selector">
        {ar ? "منظمة مقدم الخدمات" : "Organisation prestataire"}
        <select
          id="provider-organization-selector"
          name="organizationId"
          defaultValue={selectedOrganizationId ?? ""}
          required
          className="min-h-11 rounded-md border px-3"
        >
          <option value="" disabled>
            {ar ? "اختر مؤسسة" : "Choisir une organisation"}
          </option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </label>
      <button className="client-cta" type="submit" disabled={pending}>
        {pending ? (ar ? "جارٍ الفتح…" : "Ouverture…") : ar ? "عرض" : "Afficher"}
      </button>
    </form>
  );
}
