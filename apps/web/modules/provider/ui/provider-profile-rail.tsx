import Link from "next/link";
import {
  Award,
  Bell,
  Building2,
  Settings2,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type ProviderProfileRailKey =
  | "profile"
  | "services"
  | "certs"
  | "capacity"
  | "settings"
  | "notifications"
  | "company";

const copy = {
  fr: {
    label: "Mon espace professionnel",
    profile: "Mon profil",
    services: "Mes services",
    certs: "Certifications",
    capacity: "Disponibilités",
    settings: "Préférences",
    notifications: "Notifications",
    company: "Mon entreprise",
  },
  ar: {
    label: "فضائي المهني",
    profile: "ملفي",
    services: "خدماتي",
    certs: "الشهادات",
    capacity: "التوافر",
    settings: "التفضيلات",
    notifications: "الإشعارات",
    company: "مؤسستي",
  },
} as const;

export function ProviderProfileRail({
  locale,
  query,
  active,
}: {
  locale: Locale;
  query: string;
  active: ProviderProfileRailKey;
}) {
  const c = copy[locale];
  const items = [
    { key: "profile" as const, href: `/${locale}/sous-traitant/identite${query}`, label: c.profile, icon: UserRound },
    { key: "services" as const, href: `/${locale}/sous-traitant/services${query}`, label: c.services, icon: Wrench },
    { key: "certs" as const, href: `/${locale}/sous-traitant/qualification/certifications${query}`, label: c.certs, icon: Award },
    { key: "capacity" as const, href: `/${locale}/sous-traitant/qualification${query}#capacite`, label: c.capacity, icon: ShieldCheck },
    { key: "settings" as const, href: `/${locale}/sous-traitant/parametres${query}`, label: c.settings, icon: Settings2 },
    { key: "notifications" as const, href: `/${locale}/notifications${query}#notification-preferences`, label: c.notifications, icon: Bell },
    { key: "company" as const, href: `/${locale}/sous-traitant/entreprise${query}`, label: c.company, icon: Building2 },
  ];

  return (
    <nav className="provider-profile-rail" aria-label={c.label}>
      <p className="provider-profile-rail-title">{c.label}</p>
      <ul>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link href={item.href} aria-current={item.key === active ? "page" : undefined} data-active={item.key === active ? "true" : undefined}>
                <Icon className="size-4" aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
