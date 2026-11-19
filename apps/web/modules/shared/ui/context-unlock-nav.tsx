"use client";

import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";
import { HashAwareLink } from "@/modules/shared/ui/hash-nav";

/** Shared GET-like org unlock: lands on a section hash and scrolls/focuses the unlocked actions. */
export function ContextUnlockForm({
  locale,
  paramName = "organizationId",
  selectedId,
  options,
  landHash,
  labels,
}: {
  locale: "fr" | "ar";
  paramName?: string;
  selectedId?: string;
  options: Array<{ id: string; label: string }>;
  landHash: string;
  labels: {
    field: string;
    choose: string;
    submit: string;
    pending: string;
    ready: string;
    go: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const ready = Boolean(selectedId);

  function open(id: string) {
    const params = new URLSearchParams();
    params.set(paramName, id);
    const hash = landHash.startsWith("#") ? landHash : `#${landHash}`;
    const href = `${pathname}?${params.toString()}${hash}`;
    startTransition(() => {
      router.replace(href);
    });
    window.setTimeout(() => {
      const target = document.getElementById(hash.slice(1));
      if (!(target instanceof HTMLElement)) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      const focusable = target.querySelector<HTMLElement>("input,select,textarea,button,a");
      focusable?.focus({ preventScroll: true });
    }, 350);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const id = String(data.get(paramName) ?? "");
    if (!id) return;
    open(id);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-[16rem] flex-1 gap-1 text-sm font-medium">
          <span>{labels.field}</span>
          <select
            name={paramName}
            defaultValue={selectedId ?? ""}
            required
            className="min-h-11 w-full rounded-lg border bg-background px-3 py-2"
          >
            <option value="" disabled>
              {labels.choose}
            </option>
            {options.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className="admin-btn-primary min-h-11">
          {pending ? labels.pending : labels.submit}
        </button>
      </form>
      {ready ? (
        <div className="admin-notice flex flex-wrap items-center justify-between gap-3">
          <p role="status">{labels.ready}</p>
          <HashAwareLink href={landHash.startsWith("#") ? landHash : `#${landHash}`} className="admin-btn-primary min-h-11 inline-flex items-center">
            {labels.go}
          </HashAwareLink>
        </div>
      ) : null}
    </div>
  );
}
