"use client";

import { buttonVariants } from "@/modules/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/shared/ui/card";
import { cn } from "@/modules/shared/lib/utils";

type CatalogContextRequiredProps = {
  title: string;
  needContext: string;
  goContext: string;
  /** When library is already chosen, steer the user to the service control. */
  missing?: "library" | "service";
};

/** Prefer the first incomplete context control: library → service. */
export function catalogContextFocusTarget(
  library: HTMLSelectElement | null,
  service: HTMLSelectElement | null,
): HTMLSelectElement | null {
  if (library && !library.value) return library;
  if (service && !service.disabled) return service;
  return library;
}

function markFocus(el: HTMLElement) {
  el.setAttribute("data-catalog-focus", "true");
  window.setTimeout(() => el.removeAttribute("data-catalog-focus"), 2200);
}

function openSelectPicker(select: HTMLSelectElement) {
  select.focus({ preventScroll: true });
  markFocus(select);
  if (typeof select.showPicker === "function") {
    try {
      select.showPicker();
    } catch {
      /* showPicker may reject once the original gesture is spent */
    }
  }
}

export function focusCatalogContext(event?: { preventDefault(): void }) {
  event?.preventDefault();
  const section = document.getElementById("domaines");
  const library = document.getElementById("catalogue-library");
  const service = document.getElementById("catalogue-service");
  const target = catalogContextFocusTarget(
    library instanceof HTMLSelectElement ? library : null,
    service instanceof HTMLSelectElement ? service : null,
  );

  const next = `${window.location.pathname}${window.location.search}#domaines`;
  window.history.pushState(null, "", next);

  if (section instanceof HTMLElement) {
    section.scrollIntoView({ behavior: "smooth", block: "center" });
    markFocus(section);
  }

  window.setTimeout(() => {
    if (target) openSelectPicker(target);
  }, 320);
}

export function CatalogContextRequired({
  title,
  needContext,
  goContext,
  missing = "library",
}: CatalogContextRequiredProps) {
  const href = missing === "service" ? "#catalogue-service" : "#catalogue-library";
  return (
    <Card className="scroll-mt-24">
      <CardHeader>
        <CardTitle><h2>{title}</h2></CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{needContext}</p>
        <a
          href={href}
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex min-h-11")}
          onClick={focusCatalogContext}
        >
          {goContext}
        </a>
      </CardContent>
    </Card>
  );
}
