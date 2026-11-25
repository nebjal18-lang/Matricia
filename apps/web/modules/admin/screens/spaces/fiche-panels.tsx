"use client";

import { useEffect, useState, type ReactNode } from "react";

function readPanel(): "overview" | "membres" {
  if (typeof window === "undefined") return "overview";
  const hash = window.location.hash.replace(/^#/u, "");
  return hash === "membres" ? "membres" : "overview";
}

/** Shows overview or membres panel according to the page hash (client-only to avoid hydration mismatch). */
export function FichePanels({
  overview,
  membres,
}: {
  overview: ReactNode;
  membres: ReactNode;
}) {
  const [panel, setPanel] = useState<"overview" | "membres">("overview");

  useEffect(() => {
    const sync = () => setPanel(readPanel());
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
    <>
      <div
        className="admin-fiche-panel"
        data-panel="overview"
        data-active={panel === "overview" ? "true" : "false"}
        hidden={panel !== "overview"}
        aria-hidden={panel !== "overview"}
      >
        {overview}
      </div>
      <div
        className="admin-fiche-panel"
        data-panel="membres"
        data-active={panel === "membres" ? "true" : "false"}
        hidden={panel !== "membres"}
        aria-hidden={panel !== "membres"}
      >
        {membres}
      </div>
    </>
  );
}
