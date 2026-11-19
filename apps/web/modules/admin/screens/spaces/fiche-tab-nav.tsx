"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";

export type FicheTabItem = {
  id: string;
  href: string;
  label: string;
  currentWhen?: "overview" | "hash";
};

function readHash() {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#/u, "");
}

function setPageHash(href: string, hash: string, event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  if (typeof window === "undefined") return;
  const path = href.split("#")[0] || `${window.location.pathname}${window.location.search}`;
  const next = hash ? `${path}#${hash}` : path;
  window.history.pushState(null, "", next);
  window.dispatchEvent(new Event("matricia:hashchange"));
  window.requestAnimationFrame(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target = document.getElementById(hash);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function FicheTabNav({
  label,
  tabs,
}: {
  label: string;
  tabs: FicheTabItem[];
}) {
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sync = () => setHash(readHash());
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    window.addEventListener("matricia:hashchange", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("matricia:hashchange", sync);
    };
  }, []);

  return (
    <nav className="client-tabs" aria-label={label}>
      {tabs.map((tab) => {
        const isCurrent = tab.currentWhen === "overview"
          ? hash.length === 0 || hash === "overview"
          : tab.currentWhen === "hash"
            ? hash === tab.id
            : false;
        if (tab.currentWhen === "overview") {
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isCurrent ? "page" : undefined}
              onClick={(event) => setPageHash(tab.href, "", event)}
            >
              {tab.label}
            </Link>
          );
        }
        if (tab.currentWhen === "hash") {
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isCurrent ? "page" : undefined}
              onClick={(event) => setPageHash(tab.href, tab.id, event)}
            >
              {tab.label}
            </Link>
          );
        }
        return (
          <Link key={tab.id} href={tab.href}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
