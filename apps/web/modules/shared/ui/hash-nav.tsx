"use client";

import Link from "next/link";
import { useEffect, type ComponentProps, type MouseEvent, type ReactNode } from "react";

export function hashIdFromHref(href: string): string | null {
  const index = href.indexOf("#");
  if (index < 0) return null;
  const id = href.slice(index + 1).split(/[?&]/u)[0]?.trim();
  return id || null;
}

/** Same-page hash navigation that actually scrolls (Next.js Link often does not). */
export function navigateToPageHash(href: string, event?: Pick<MouseEvent<HTMLElement>, "preventDefault">): boolean {
  const id = hashIdFromHref(href);
  if (!id || typeof document === "undefined") return false;
  const target = document.getElementById(id);
  if (!(target instanceof HTMLElement)) return false;
  event?.preventDefault();
  const next = href.startsWith("#")
    ? `${window.location.pathname}${window.location.search}#${id}`
    : href;
  window.history.pushState(null, "", next);
  window.dispatchEvent(new Event("matricia:hashchange"));
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  const focusable = target.matches("select,input,textarea,button,a,[tabindex]")
    ? target
    : target.querySelector<HTMLElement>("select,input,textarea,button,a,[tabindex]");
  if (focusable) window.setTimeout(() => focusable.focus({ preventScroll: true }), 280);
  return true;
}

export function scrollToLocationHash() {
  const id = window.location.hash.replace(/^#/u, "");
  if (!id) return false;
  const target = document.getElementById(id);
  if (!(target instanceof HTMLElement)) return false;
  window.requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return true;
}

/** Mount once per workspace page so inbound `#section` links scroll after render. */
export function WorkspaceHashScroll() {
  useEffect(() => {
    let attempts = 0;
    let timer: number | undefined;
    const tryScroll = () => {
      if (scrollToLocationHash() || attempts >= 8) return;
      attempts += 1;
      timer = window.setTimeout(tryScroll, 120);
    };
    tryScroll();
    window.addEventListener("hashchange", scrollToLocationHash);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("hashchange", scrollToLocationHash);
    };
  }, []);
  return null;
}

type HashAwareLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  children: ReactNode;
};

/** Drop-in Link that scrolls/focuses when the hash target is already on the page. */
export function HashAwareLink({ href, onClick, children, ...rest }: HashAwareLinkProps) {
  return (
    <Link
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        navigateToPageHash(href, event);
      }}
    >
      {children}
    </Link>
  );
}
