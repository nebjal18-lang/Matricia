"use client";

import { useLayoutEffect } from "react";
import { directionFor, isLocale } from "@/modules/shared/lib/i18n/locale";

// The root layout persists during Link navigation between locale segments.
// Synchronize its document attributes before the destination is painted.
export function DocumentLocaleSync({ locale }: { locale: string }) {
  useLayoutEffect(() => {
    if (!isLocale(locale)) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = directionFor(locale);
    // No cleanup: an outgoing locale must never restore its old attributes.
  }, [locale]);

  return null;
}
