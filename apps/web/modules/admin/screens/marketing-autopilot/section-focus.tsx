"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

const SECTIONS: Record<string, { fr: string; ar: string }> = {
  gouvernance: { fr: "Marketing Autopilot — Gouvernance", ar: "التسويق الآلي — الحوكمة" },
  calendrier: { fr: "Calendrier éditorial", ar: "التقويم التحريري" },
  connexions: { fr: "Connexions sociales", ar: "الارتباطات الاجتماعية" },
  attribution: { fr: "Attribution CTA", ar: "إسناد الدعوة" },
};

/** Annonce la section ouverte par ancre sans changer la route. */
export function MarketingSectionFocus({ locale }: { locale: Locale }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const id = window.location.hash.replace(/^#/, "");
      const entry = SECTIONS[id];
      if (!entry) {
        setLabel(null);
        return;
      }
      const text = locale === "ar" ? entry.ar : entry.fr;
      setLabel(text);
      document.title = `${text} · Matricia`;
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [locale]);

  if (!label) return null;
  return (
    <p className="client-access-note mb-4" role="status" data-marketing-section={label}>
      {locale === "ar" ? "القسم النشط: " : "Section active : "}
      <strong>{label}</strong>
    </p>
  );
}
