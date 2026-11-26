import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getHomePremiumCopy, type HomeLocale } from "./home-premium.copy";
import styles from "./home-premium-shell.module.css";

/** First viewport — business promise, three distinct intents, one image. */
export function HomePremiumHero({ locale }: { locale: HomeLocale }) {
  const copy = getHomePremiumCopy(locale);
  const href = (path: string) => `/${locale}${path}`;

  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={styles.heroMedia} aria-hidden="true">
        <Image
          className={styles.heroPhoto}
          src="/home-v2/hero-collaboration.png"
          alt=""
          fill
          loading="eager"
          fetchPriority="high"
          quality={75}
          sizes="100vw"
        />
        <div className={styles.heroVeil} />
      </div>

      <div className={styles.heroInner}>
        <p className={styles.brandLead}>{copy.brandLead}</p>
        <h1 id="home-title">
          {copy.titleLead} <span>{copy.titleAccent}</span>
        </h1>
        <p className={styles.lead}>{copy.intro}</p>
        <div className={styles.ctaGroup}>
          <Link className={styles.primaryAction} href={href("/diagnostic")}>
            {copy.primaryAction}
            <ArrowRight className={styles.actionArrow} size={18} aria-hidden="true" />
          </Link>
          <Link className={styles.needActionSolid} href={href("/besoin")}>
            {copy.preciseNeedAction}
            <ArrowRight className={styles.actionArrow} size={16} aria-hidden="true" />
          </Link>
        </div>
        <Link className={styles.providerLink} href={href("/fournisseur")}>
          {copy.providerAction}
        </Link>
      </div>
    </section>
  );
}
