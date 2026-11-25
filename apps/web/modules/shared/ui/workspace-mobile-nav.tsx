"use client";

import { Menu } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/modules/shared/ui/sheet";

type WorkspaceMobileNavProps = {
  locale: "fr" | "ar";
  title: string;
  description?: string;
  triggerLabel: string;
  children: ReactNode;
  /** Use for franchise dock "Plus" where the trigger is already a custom control. */
  triggerClassName?: string;
  triggerContent?: ReactNode;
};

/** Mobile-only navigation sheet: closed by default, Esc/overlay close, focus restore via Radix. */
export function WorkspaceMobileNav({
  locale,
  title,
  description,
  triggerLabel,
  children,
  triggerClassName,
  triggerContent,
}: WorkspaceMobileNavProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onNavigate = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (link) setOpen(false);
    };
    document.addEventListener("click", onNavigate, true);
    return () => document.removeEventListener("click", onNavigate, true);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        type="button"
        className={triggerClassName ?? "workspace-mobile-nav-trigger"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
      >
        {triggerContent ?? (
          <>
            <Menu className="size-4" aria-hidden />
            <span>{triggerLabel}</span>
          </>
        )}
        {triggerContent ? <span className="sr-only">{triggerLabel}</span> : null}
      </SheetTrigger>
      <SheetContent
        side={locale === "ar" ? "left" : "right"}
        className="workspace-mobile-nav-sheet"
        aria-labelledby={titleId}
      >
        <SheetHeader>
          <SheetTitle id={titleId}>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="workspace-mobile-nav-body">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
