"use client";

import Link from "next/link";
import { ChevronRight, CircleDot } from "lucide-react";
import { useId, useState } from "react";

export function DirectoryLink({ href, label, summary }: { href: string; label: string; summary: string }) {
  const tipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <div
      className="admin-dir-link-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        href={href}
        className="admin-dir-link"
        aria-describedby={open ? tipId : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span className="admin-dir-link-label">
          <CircleDot className="size-3.5 admin-dir-link-glyph" aria-hidden />
          {label}
        </span>
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
      {open ? (
        <p id={tipId} className="admin-dir-tip" role="tooltip">
          {summary}
        </p>
      ) : null}
    </div>
  );
}
