import { HomePremiumBelow } from "./HomePremiumBelow";
import { HomePremiumHero } from "./HomePremiumHero";
import type { HomeLocale } from "./home-premium.copy";
import styles from "./home-premium-shell.module.css";
import type { ReactNode } from "react";

type HomePremiumProps = {
  locale: HomeLocale;
  demoAccess?: ReactNode;
};

export function HomePremium({ locale, demoAccess }: HomePremiumProps) {
  return (
    <main id="contenu-principal" className={`${styles.page} home-premium-page`} dir={locale === "ar" ? "rtl" : "ltr"}>
      {demoAccess}
      <HomePremiumHero locale={locale} />
      <HomePremiumBelow locale={locale} />
    </main>
  );
}
