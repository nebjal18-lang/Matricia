import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  Clock,
  FileSignature,
  FileText,
  Gem,
  Leaf,
  Lightbulb,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { getHomePremiumCopy, type HomeLocale } from "./home-premium.copy";
import styles from "./home-premium-shell.module.css";

const cycleIcons = [Search, FileText, Users, Scale, FileSignature, Settings, BarChart3] as const;
const outcomeIcons = [Lightbulb, Target, Clock, Leaf] as const;
const networkIcons = [ShieldCheck, Users, Gem] as const;

/** Below-the-fold marketing body — streamed after the hero. */
export function HomePremiumBelow({ locale }: { locale: HomeLocale }) {
  const copy = getHomePremiumCopy(locale);
  const href = (path: string) => `/${locale}${path}`;

  return (
    <>
      <section className={styles.cycle} aria-labelledby="cycle-title" id="comment-ca-marche">
        <header className={styles.cycleHead}>
          <h2 id="cycle-title">
            {copy.cycleTitle[0]}
            <span>{copy.cycleTitle[1]}</span>
          </h2>
          <p className={styles.cycleOutcome}>
            {copy.cycleOutcome[0]} <span>{copy.cycleOutcome[1]}</span>
          </p>
        </header>
        <ol className={styles.cycleRail} aria-label={copy.cycleLabel}>
          {copy.cycle.map((step, index) => {
            const Icon = cycleIcons[index];
            return (
              <li key={step}>
                <span className={styles.cycleIcon}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className={styles.cycleStep}>{step}</span>
                {index < copy.cycle.length - 1 ? (
                  <ChevronRight className={styles.cycleArrow} size={16} aria-hidden="true" />
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <div className={styles.panels}>
        <section className={styles.outcomes} aria-labelledby="outcomes-title">
          <h2 id="outcomes-title">{copy.outcomesTitle}</h2>
          <ul>
            {copy.outcomes.map((outcome, index) => {
              const Icon = outcomeIcons[index];
              return (
                <li key={outcome.title}>
                  <span className={styles.outcomeIcon}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className={styles.outcomeText}>
                    <strong>{outcome.title}</strong>
                    <small>{outcome.description}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.network} aria-labelledby="network-title">
          <h2 id="network-title">{copy.networkTitle}</h2>
          <p>{copy.networkIntro}</p>
          <ul>
            {copy.networkPillars.map((pillar, index) => {
              const Icon = networkIcons[index];
              return (
                <li key={pillar}>
                  <span className={styles.networkIcon}>
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  {pillar}
                </li>
              );
            })}
          </ul>
          <p className={styles.networkCaption}>{copy.networkCaption}</p>
        </section>

        <section className={styles.faq} aria-labelledby="faq-title">
          <h2 id="faq-title">{copy.faqTitle}</h2>
          <div>
            {copy.faq.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <ChevronRight className={styles.faqChevron} size={17} aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <section className={styles.final} aria-labelledby="final-title">
        <div className={styles.finalScene} aria-hidden="true">
          <Image src="/scenes/medina-terrace.png" alt="" fill sizes="60vw" quality={75} className={styles.finalPhoto} />
        </div>
        <div className={styles.finalPattern} aria-hidden="true" />
        <div className={styles.finalInner}>
          <h2 id="final-title">
            {copy.finalTitle[0]}
            <span>{copy.finalTitle[1]}</span>
          </h2>
          <Link className={styles.finalPrimary} href={href("/diagnostic")} prefetch>
            {copy.finalPrimary}
            <ArrowRight className={styles.actionArrow} size={18} aria-hidden="true" />
          </Link>
          <p className={styles.finalSecondary}>
            {copy.finalOr} <Link href={href("/fournisseur")}>{copy.finalSecondary}</Link>
          </p>
          <ul className={styles.finalCaption}>
            {copy.finalCaption.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
