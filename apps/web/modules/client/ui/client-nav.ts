import {
  Briefcase,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  FolderKanban,
  Gift,
  Home,
  Landmark,
  ListTodo,
  MessageSquare,
  ScrollText,
  Star,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";
import { clientDashboardCopy } from "@/modules/client/data/home/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type ClientNavKey =
  | "home"
  | "needs"
  | "requests"
  | "missions"
  | "documents"
  | "messages"
  | "finance"
  | "rewards"
  | "company"
  | "actions"
  | "contracts"
  | "portfolio"
  | "credits"
  | "memberBoxes"
  | "favorites";

export type ClientNavItem = {
  key: ClientNavKey;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: boolean;
  group: "primary" | "utility";
};

export function buildClientPrimaryNav(input: {
  locale: Locale;
  selectedQuery: string;
  messagesUnread?: boolean;
}): ClientNavItem[] {
  const c = clientDashboardCopy[input.locale];
  const q = input.selectedQuery;
  return [
    { key: "home", href: `/${input.locale}/tableau-de-bord${q}`, label: c.navHome, icon: Home, group: "primary" },
    { key: "needs", href: `/${input.locale}/client/diagnostics${q}`, label: c.navNeeds, icon: ClipboardList, group: "primary" },
    { key: "requests", href: `/${input.locale}/client/demandes${q}`, label: c.navRequests, icon: FolderKanban, group: "primary" },
    { key: "missions", href: `/${input.locale}/client/missions${q}`, label: c.navMissions, icon: Landmark, group: "primary" },
    { key: "documents", href: `/${input.locale}/client/documents${q}`, label: c.navDocuments, icon: FileText, group: "primary" },
    {
      key: "messages",
      href: `/${input.locale}/messagerie${q}`,
      label: c.navMessages,
      icon: MessageSquare,
      badge: input.messagesUnread,
      group: "primary",
    },
    { key: "finance", href: `/${input.locale}/client/finances${q}`, label: c.navFinance, icon: Wallet, group: "primary" },
    { key: "rewards", href: `/${input.locale}/client/recompenses${q}`, label: c.navRewards, icon: Gift, group: "primary" },
    { key: "company", href: `/${input.locale}/organisation${q}`, label: c.navCompany, icon: Building2, group: "primary" },
  ];
}

export function buildClientUtilityNav(input: { locale: Locale; selectedQuery: string }): ClientNavItem[] {
  const c = clientDashboardCopy[input.locale];
  const q = input.selectedQuery;
  return [
    { key: "actions", href: `/${input.locale}/client/actions${q}`, label: c.navActions, icon: ListTodo, group: "utility" },
    { key: "contracts", href: `/${input.locale}/client/contrats${q}`, label: c.navContracts, icon: ScrollText, group: "utility" },
    { key: "portfolio", href: `/${input.locale}/client/portefeuille${q}`, label: c.navPortfolio, icon: Briefcase, group: "utility" },
    { key: "credits", href: `/${input.locale}/client/credits${q}`, label: c.navCredits, icon: CreditCard, group: "utility" },
    { key: "memberBoxes", href: `/${input.locale}/client/boxes/mon-enveloppe${q}`, label: input.locale === "ar" ? "مخصصاتي في الصندوق" : "Mon enveloppe Box", icon: Gift, group: "utility" },
    { key: "favorites", href: `/${input.locale}/client/favoris${q}`, label: c.navFavorites, icon: Star, group: "utility" },
  ];
}

export function buildClientNav(input: {
  locale: Locale;
  selectedQuery: string;
  messagesUnread?: boolean;
}): ClientNavItem[] {
  return [...buildClientPrimaryNav(input), ...buildClientUtilityNav(input)];
}
