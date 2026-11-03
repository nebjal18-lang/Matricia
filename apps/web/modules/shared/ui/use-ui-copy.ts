"use client";
import { usePathname } from "next/navigation";
import { normalizeLocale } from "@/modules/shared/lib/i18n/locale";
export function useUiCopy() { const locale = normalizeLocale(usePathname()?.split("/")[1]); return { locale, close: locale === "ar" ? "إغلاق" : "Fermer" }; }
