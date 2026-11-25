"use client";

import { ChevronDown, Menu } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export function WorkspaceMobileNavigation({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const label = locale === "ar" ? "القائمة" : "Navigation";

  return (
    <>
      <button
        type="button"
        ref={toggleRef}
        className="workspace-nav-toggle"
        aria-controls={panelId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Menu aria-hidden="true" size={18} />
        <span>{label}</span>
        <ChevronDown aria-hidden="true" size={16} className="workspace-nav-chevron" />
      </button>
      <div
        id={panelId}
        className="workspace-nav-panel"
        data-open={open ? "true" : "false"}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            toggleRef.current?.focus();
          }
        }}
      >
        {children}
      </div>
    </>
  );
}
