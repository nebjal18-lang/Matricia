import { BookOpen, Home, Landmark, Route, Settings, Shield, Users } from "lucide-react";
import type { ComponentType } from "react";
import { adminCopy } from "@/modules/admin/data/spaces/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type AdminNavKey = "home" | "actors" | "parcours" | "catalog" | "finance" | "pilot" | "settings";

export type AdminNavItem = {
  key: AdminNavKey;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function buildAdminNav(locale: Locale, selectedQuery: string): AdminNavItem[] {
  const c = adminCopy(locale);
  const p = `/${locale}`;
  const q = selectedQuery;
  return [
    { key: "home", href: `${p}/administration/command-center${q}`, label: c.navHome, icon: Home },
    { key: "actors", href: `${p}/administration/acteurs${q}`, label: c.navActors, icon: Users },
    { key: "parcours", href: `${p}/administration/parcours${q}`, label: c.navParcours, icon: Route },
    { key: "catalog", href: `${p}/administration/catalogue${q}`, label: c.navCatalog, icon: BookOpen },
    { key: "finance", href: `${p}/administration/finance${q}`, label: c.navFinance, icon: Landmark },
    { key: "pilot", href: `${p}/administration/anti-abus${q}`, label: c.navPilot, icon: Shield },
    { key: "settings", href: `${p}/administration/configuration${q}`, label: c.navSettings, icon: Settings },
  ];
}
