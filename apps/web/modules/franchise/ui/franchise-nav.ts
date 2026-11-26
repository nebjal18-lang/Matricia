import { BellRing, BookOpen, Building2, ClipboardList, FileText, Home, Landmark, Megaphone, MessageSquare, Scale, ShieldCheck, Users } from "lucide-react";
import type { ComponentType } from "react";
import { libraryCopy } from "@/modules/franchise/data/library/copy";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type FranchiseNavKey =
  | "home"
  | "library"
  | "services"
  | "questionnaires"
  | "rules"
  | "validations"
  | "perimeter"
  | "network"
  | "requests"
  | "quality"
  | "performance"
  | "followups"
  | "marketing"
  | "documents"
  | "messages"
  | "governance"
  | "finance";

export type FranchiseNavItem = {
  key: FranchiseNavKey;
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export function buildFranchiseNav(
  locale: Locale,
  selectedQuery: string,
  options?: { mandateReady?: boolean },
): FranchiseNavItem[] {
  const n = libraryCopy(locale);
  const items: FranchiseNavItem[] = [
    { key: "home", href: `/${locale}/franchise/accueil${selectedQuery}`, label: n.navHome, icon: Home },
    { key: "library", href: `/${locale}/franchise/bibliotheque${selectedQuery}`, label: n.navLibrary, icon: BookOpen },
    { key: "services", href: `/${locale}/franchise/services${selectedQuery}`, label: n.navServices, icon: ClipboardList },
    { key: "questionnaires", href: `/${locale}/franchise/questionnaires${selectedQuery}`, label: n.navQuestionnaires, icon: FileText },
    { key: "rules", href: `/${locale}/franchise/regles${selectedQuery}`, label: n.navRules, icon: Scale },
    { key: "validations", href: `/${locale}/franchise/validations${selectedQuery}`, label: n.navValidations, icon: ShieldCheck },
    { key: "perimeter", href: `/${locale}/franchise/perimetre${selectedQuery}`, label: n.navPerimeter, icon: Building2 },
    { key: "network", href: `/${locale}/franchise/fournisseurs${selectedQuery}`, label: n.navProviders, icon: Users },
    { key: "requests", href: `/${locale}/franchise/demandes${selectedQuery}`, label: n.navRequests, icon: FileText },
    { key: "quality", href: `/${locale}/franchise/qualite${selectedQuery}`, label: n.navQuality, icon: ShieldCheck },
    { key: "performance", href: `/${locale}/franchise/performance${selectedQuery}`, label: n.navPerformance, icon: Landmark },
    { key: "followups", href: `/${locale}/franchise/relances${selectedQuery}`, label: n.navFollowups, icon: BellRing },
    { key: "marketing", href: `/${locale}/franchise/marketing${selectedQuery}`, label: n.navMarketing, icon: Megaphone },
    { key: "documents", href: `/${locale}/franchise/documents${selectedQuery}`, label: n.navDocuments, icon: FileText },
    { key: "messages", href: `/${locale}/franchise/messages${selectedQuery}`, label: n.navMessages, icon: MessageSquare },
    { key: "governance", href: `/${locale}/franchise/gouvernance${selectedQuery}`, label: n.navGovernance, icon: Building2 },
    { key: "finance", href: `/${locale}/franchise/finance${selectedQuery}`, label: n.navFinance, icon: Landmark },
  ];
  if (options?.mandateReady === false) {
    const allowed = new Set<FranchiseNavKey>(["home", "perimeter", "governance"]);
    return items.filter((item) => allowed.has(item.key));
  }
  return items;
}
