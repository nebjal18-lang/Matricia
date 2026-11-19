"use client";

import { Filter, Plus } from "lucide-react";
import { HashAwareLink } from "@/modules/shared/ui/hash-nav";

export function HashAwareCta({
  href,
  label,
  className,
  withPlus = false,
}: {
  href: string;
  label: string;
  className: string;
  withPlus?: boolean;
}) {
  return (
    <HashAwareLink href={href} className={className}>
      {withPlus ? <Plus className="size-4" aria-hidden /> : null}
      {label}
    </HashAwareLink>
  );
}

export function HashAwareFilterLink({ href, label, className }: { href: string; label: string; className: string }) {
  return (
    <HashAwareLink href={href} className={className}>
      <Filter className="size-4" aria-hidden />
      {label}
    </HashAwareLink>
  );
}
