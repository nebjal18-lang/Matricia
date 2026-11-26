"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export function AdminSideGroup({
  label,
  icon,
  active,
  children,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(active);
  const [previousActive, setPreviousActive] = useState(active);
  if (active !== previousActive) {
    setPreviousActive(active);
    if (active) setOpen(true);
  }

  return (
    <details
      className="admin-side-group"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary data-active={active ? "true" : undefined}>
        {icon}
        {label}
        <ChevronDown aria-hidden className="size-3.5 admin-side-chevron" />
      </summary>
      <div className="admin-side-sub">{children}</div>
    </details>
  );
}
