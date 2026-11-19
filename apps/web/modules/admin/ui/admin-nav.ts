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

export type AdminNavChild = { id: string; href: string; label: string };

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

export function buildAdminPilotLinks(locale: Locale, q: string): AdminNavChild[] {
  const p = `/${locale}`;
  const fr = locale === "fr";
  return [
    { id: "command", href: `${p}/administration/command-center${q}`, label: fr ? "Centre de commandement" : "مركز القيادة" },
    { id: "marketing", href: `${p}/administration/marketing-autopilot${q}`, label: fr ? "Marketing Autopilot" : "التسويق الآلي" },
    { id: "analytics", href: `${p}/administration/questionnaires/analytique${q}`, label: fr ? "Analytics" : "التحليلات" },
    { id: "anti-abus", href: `${p}/administration/anti-abus${q}`, label: fr ? "Anti-abus" : "مكافحة الإساءة" },
    { id: "privacy", href: `${p}/administration/confidentialite${q}`, label: fr ? "Confidentialité" : "الخصوصية" },
    { id: "sessions", href: `${p}/securite/sessions${q}${q.includes("?") ? "&" : "?"}workspace=administration`, label: fr ? "Sessions" : "الجلسات" },
    { id: "operations", href: `${p}/administration/operations${q}`, label: fr ? "Opérations" : "العمليات" },
  ];
}

export function buildAdminSettingsLinks(locale: Locale, q: string): AdminNavChild[] {
  const p = `/${locale}`;
  const fr = locale === "fr";
  return [
    { id: "preparation", href: `${p}/administration/preparation${q}`, label: fr ? "Préparation" : "التحضير" },
    { id: "configuration", href: `${p}/administration/configuration${q}`, label: fr ? "Configuration" : "التكوين" },
    { id: "notifications", href: `${p}/administration/notifications/modeles${q}`, label: fr ? "Notifications" : "الإشعارات" },
    { id: "signatures", href: `${p}/administration/signatures${q}`, label: fr ? "Signatures" : "التوقيعات" },
  ];
}

export function buildAdminFinanceLinks(locale: Locale, q: string): AdminNavChild[] {
  const p = `/${locale}`;
  const fr = locale === "fr";
  return [
    { id: "finance-hub", href: `${p}/administration/finance${q}`, label: fr ? "Finance du jour" : "مالية اليوم" },
    { id: "offers", href: `${p}/administration/finance/offres${q}`, label: fr ? "Offres Box" : "عروض Box" },
    { id: "credits", href: `${p}/administration/finance/credits${q}`, label: fr ? "Packs crédits" : "حزم الأرصدة" },
    { id: "client-billing", href: `${p}/administration/facturation-clients${q}`, label: fr ? "Facturation clients" : "فوترة العملاء" },
    { id: "provider-billing", href: `${p}/administration/finance/prestataires${q}`, label: fr ? "Facturation prestataires" : "فوترة مقدمي الخدمات" },
    { id: "approvals", href: `${p}/administration/approbations-finance${q}`, label: fr ? "Approbations" : "المصادقات" },
    { id: "incentives", href: `${p}/administration/incitations${q}`, label: fr ? "Incitations" : "الحوافز" },
    { id: "volume", href: `${p}/administration/achats-groupes${q}`, label: fr ? "Achats groupés" : "مشتريات مجمّعة" },
  ];
}
