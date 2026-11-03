import { withDashboardWorkspaceHint } from "@/modules/shared/lib/auth/workspace-navigation";
import {
  Award,
  Building2,
  Calendar,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Home,
  Landmark,
  Megaphone,
  MessageSquare,
  Package,
  Scale,
  ShieldCheck,
  Settings2,
  ShoppingCart,
  Wallet,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";
import { providerDashboardCopy } from "@/modules/provider/data/home/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
export type ProviderNavKey =
  | "home"
  | "qualify"
  | "questionnaires"
  | "services"
  | "consult"
  | "quotes"
  | "missions"
  | "contracts"
  | "planning"
  | "documents"
  | "billing"
  | "disputes"
  | "purchases"
  | "reputation"
  | "marketing"
  | "messages"
  | "modeClient"
  | "company"
  | "settings";

export type ProviderNavItem = {
  key: ProviderNavKey;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function buildProviderNav(locale: Locale, selectedQuery: string): ProviderNavItem[] {
  const q = selectedQuery;
  const n = providerDashboardCopy[locale];
  return [
    { key: "home", href: withDashboardWorkspaceHint(`/${locale}/tableau-de-bord${q}`, locale, "provider"), label: n.navHome, icon: Home },
    { key: "questionnaires", href: `/${locale}/sous-traitant/questionnaires${q}`, label: locale === "ar" ? "استبيانات التأهيل" : "Questionnaires de qualification", icon: ClipboardCheck },
    { key: "qualify", href: `/${locale}/sous-traitant/qualification${q}`, label: n.navQualify, icon: ShieldCheck },
    { key: "services", href: `/${locale}/sous-traitant/services${q}`, label: n.navServices, icon: Wrench },
    { key: "consult", href: `/${locale}/sous-traitant/consultations${q}`, label: n.navConsult, icon: FolderKanban },
    { key: "quotes", href: `/${locale}/sous-traitant/devis${q}`, label: n.navQuotes, icon: ClipboardCheck },
    { key: "contracts", href: `/${locale}/sous-traitant/contrats${q}`, label: locale === "ar" ? "العقود" : "Contrats", icon: FileText },
    { key: "missions", href: `/${locale}/sous-traitant/missions${q}`, label: n.navMissions, icon: Landmark },
    { key: "planning", href: `/${locale}/sous-traitant/planning${q}`, label: n.navPlanning, icon: Calendar },
    { key: "documents", href: `/${locale}/sous-traitant/documents${q}`, label: n.navDocs, icon: FileText },
    { key: "billing", href: `/${locale}/sous-traitant/facturation${q}`, label: n.navBilling, icon: Wallet },
    { key: "disputes", href: `/${locale}/sous-traitant/litiges${q}`, label: n.navDisputes, icon: Scale },
    { key: "purchases", href: `/${locale}/sous-traitant/achats${q}`, label: n.navPurchases, icon: Package },
    { key: "reputation", href: `/${locale}/sous-traitant/reputation${q}`, label: n.navReputation, icon: Award },
    { key: "marketing", href: `/${locale}/sous-traitant/marketing${q}`, label: n.navMarketing, icon: Megaphone },
    { key: "messages", href: `/${locale}/sous-traitant/messages${q}`, label: n.navMessages, icon: MessageSquare },
    { key: "modeClient", href: `/${locale}/sous-traitant/mode-client${q}`, label: n.navModeClient, icon: ShoppingCart },
    { key: "company", href: `/${locale}/sous-traitant/entreprise${q}`, label: n.navCompany, icon: Building2 },
    { key: "settings", href: `/${locale}/sous-traitant/parametres${q}`, label: n.navSettings, icon: Settings2 },
  ];
}
