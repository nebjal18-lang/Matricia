import { HomePremiumBelow } from "./HomePremiumBelow";
import { HomePremiumHero } from "./HomePremiumHero";
import type { HomeLocale } from "./home-premium.copy";
import styles from "./home-premium-shell.module.css";

type HomePremiumProps = {
  locale: HomeLocale;
};

export function HomePremium({ locale }: HomePremiumProps) {
  return (
    <main id="contenu-principal" className={`${styles.page} home-premium-page`} dir={locale === "ar" ? "rtl" : "ltr"}>
      <HomePremiumHero locale={locale} />
      <HomePremiumBelow locale={locale} />
    </main>
  );
}
