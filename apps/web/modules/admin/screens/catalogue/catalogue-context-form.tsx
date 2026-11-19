"use client";

import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, useRef, useTransition } from "react";
import { buttonVariants } from "@/modules/shared/ui/button";
import { HashAwareLink } from "@/modules/shared/ui/hash-nav";
import { Label } from "@/modules/shared/ui/label";
import { cn } from "@/modules/shared/lib/utils";

export type CatalogueContextOption = { id: string; label: string };

type CatalogueContextFormProps = {
  locale: "fr" | "ar";
  organizationId: string | null;
  libraryId: string | null;
  serviceId: string | null;
  libraries: CatalogueContextOption[];
  services: CatalogueContextOption[];
  labels: {
    library: string;
    service: string;
    chooseLibrary: string;
    chooseService: string;
    chooseServiceFirst: string;
    open: string;
  };
};

function landOnBuilders() {
  const target = document.getElementById("questions");
  if (!(target instanceof HTMLElement)) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  const focusable = target.querySelector<HTMLElement>("input,select,textarea,button,a");
  focusable?.focus({ preventScroll: true });
}

export function CatalogueContextForm({
  locale,
  organizationId,
  libraryId,
  serviceId,
  libraries,
  services,
  labels,
}: CatalogueContextFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const rtl = locale === "ar" ? "rtl" : "ltr";
  const ready = Boolean(libraryId && serviceId);
  const ar = locale === "ar";

  function navigateFromForm(form: HTMLFormElement) {
    const data = new FormData(form);
    const nextLibrary = String(data.get("library") ?? "");
    const nextService = String(data.get("service") ?? "");
    const params = new URLSearchParams();
    if (organizationId) params.set("organizationId", organizationId);
    if (nextLibrary) params.set("library", nextLibrary);
    if (nextService) params.set("service", nextService);
    const hash = nextLibrary && nextService ? "#questions" : "#domaines";
    const href = `${pathname}?${params.toString()}${hash}`;
    startTransition(() => {
      router.replace(href);
    });
    if (nextLibrary && nextService) {
      window.setTimeout(landOnBuilders, 350);
    }
  }

  function onLibraryChange() {
    if (serviceRef.current) serviceRef.current.value = "";
    if (formRef.current) navigateFromForm(formRef.current);
  }

  function onServiceChange() {
    if (formRef.current) navigateFromForm(formRef.current);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateFromForm(event.currentTarget);
  }

  return (
    <div className="space-y-4">
      <form
        id="catalogue-context-form"
        ref={formRef}
        onSubmit={onSubmit}
        className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        {organizationId ? <input type="hidden" name="organizationId" value={organizationId} /> : null}
        <div className="min-w-0 space-y-2">
          <Label htmlFor="catalogue-library">{labels.library}</Label>
          <select
            id="catalogue-library"
            name="library"
            defaultValue={libraryId ?? ""}
            dir={libraryId ? "ltr" : rtl}
            required
            onChange={onLibraryChange}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="" dir={rtl}>
              {labels.chooseLibrary}
            </option>
            {libraries.map((library) => (
              <option key={library.id} value={library.id}>
                {library.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="catalogue-service">{labels.service}</Label>
          <select
            ref={serviceRef}
            id="catalogue-service"
            name="service"
            defaultValue={serviceId ?? ""}
            dir={serviceId ? undefined : rtl}
            disabled={!libraryId}
            required={Boolean(libraryId)}
            onChange={onServiceChange}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="" dir={rtl}>
              {libraryId ? labels.chooseService : labels.chooseServiceFirst}
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={pending} className={cn(buttonVariants(), "min-h-11 w-full md:w-auto")}>
          {pending ? (ar ? "جارٍ الفتح…" : "Ouverture…") : labels.open}
        </button>
      </form>
      {ready ? (
        <div className="admin-notice flex flex-wrap items-center justify-between gap-3">
          <p role="status">
            {ar
              ? "السياق جاهز. نماذج الأسئلة والاستبيانات والقواعد مفتوحة أسفل الصفحة."
              : "Contexte prêt. Les formulaires questions, questionnaires et règles sont ouverts juste en dessous."}
          </p>
          <HashAwareLink href="#questions" className={cn(buttonVariants(), "min-h-11 inline-flex items-center")}>
            {ar ? "الانتقال إلى النماذج" : "Aller aux formulaires"}
          </HashAwareLink>
        </div>
      ) : null}
    </div>
  );
}
