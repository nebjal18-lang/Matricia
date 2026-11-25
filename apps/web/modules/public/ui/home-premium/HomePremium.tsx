import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock,
  Compass,
  FileSignature,
  FileText,
  Gem,
  Leaf,
  Lightbulb,
  Lock,
  Scale,
  Search,
  Settings,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { getHomePremiumCopy, type HomeLocale } from "./home-premium.copy";
import styles from "./home-premium.module.css";
import type { ReactNode } from "react";

type HomePremiumProps = {
  locale: HomeLocale;
  demoAccess?: ReactNode;
};

const trustIcons = [Lock, Compass, Users] as const;
const flowIcons = [FileText, Target, Users] as const;
const cycleIcons = [Search, FileText, Users, Scale, FileSignature, Settings, BarChart3] as const;
const outcomeIcons = [Lightbulb, Target, Clock, Leaf] as const;
const networkIcons = [ShieldCheck, Users, Gem] as const;

export function HomePremium({ locale, demoAccess }: HomePremiumProps) {
  const copy = getHomePremiumCopy(locale);
  const href = (path: string) => `/${locale}${path}`;

  return (
    <main id="contenu-principal" className={`${styles.page} home-premium-page`} dir={locale === "ar" ? "rtl" : "ltr"}>
      {demoAccess}
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroMedia} aria-hidden="true">
          <Image
            className={styles.heroPhoto}
            src="/home-v2/hero-collaboration.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1141px) 64vw, 100vw"
          />
          <div className={styles.heroVeil} />
        </div>

        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 id="home-title">
              {copy.titleLead} <span>{copy.titleAccent}</span>
            </h1>
            <p className={styles.lead}>{copy.intro}</p>
            <Link className={styles.primaryAction} href={href("/diagnostic")}>
              {copy.primaryAction}
              <ArrowRight className={styles.actionArrow} size={18} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryAction} href={href("/fournisseur")}>
              {copy.providerAction}
            </Link>
            <Link className={styles.needAction} href={href("/besoin")}>
              {copy.preciseNeedAction}
              <ArrowRight className={styles.actionArrow} size={16} aria-hidden="true" />
            </Link>
            <ul className={styles.trust}>
              {copy.trust.map((item, index) => {
                const Icon = trustIcons[index];
                return (
                  <li key={item}>
                    <Icon size={17} aria-hidden="true" />
                    {item}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <ol className={styles.flow} aria-label={copy.flowLabel}>
          {copy.flow.map((step, index) => {
            const Icon = flowIcons[index];
            return (
              <li key={step.title}>
                <span className={styles.flowIcon}>
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className={styles.flowText}>
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </span>
              </li>
            );
          })}
        </ol>

        <ol className={styles.stages} aria-label={copy.stagesLabel}>
          {copy.stages.map((stage, index) => (
            <li key={stage} className={index === 0 ? styles.stageDone : undefined}>
              <span className={styles.stageMark}>{index === 0 ? <Check size={13} aria-hidden="true" /> : null}</span>
              {stage}
            </li>
          ))}
        </ol>

      </section>

      <section className={styles.cycle} aria-labelledby="cycle-title" id="comment-ca-marche">
        <h2 id="cycle-title">
          {copy.cycleTitle[0]}
          <span>{copy.cycleTitle[1]}</span>
        </h2>
        <div className={styles.cycleTrack}>
          <svg className={styles.cycleWave} viewBox="0 0 760 48" preserveAspectRatio="none" aria-hidden="true">
            <path d="M4 28 C 70 8, 120 44, 190 24 S 310 6, 380 26 S 520 46, 570 22 S 690 4, 756 28" fill="none" stroke="#642bef" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="4" cy="28" r="3.2" fill="#642bef" />
            <circle cx="756" cy="28" r="3.2" fill="#642bef" />
          </svg>
          <ol className={styles.cycleRail} aria-label={copy.cycleLabel}>
            {copy.cycle.map((step, index) => {
              const Icon = cycleIcons[index];
              return (
                <li key={step}>
                  <span className={styles.cycleIcon}>
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  {step}
                  {index < copy.cycle.length - 1 ? (
                    <ChevronRight className={styles.cycleArrow} size={15} aria-hidden="true" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
        <p className={styles.cycleOutcome}>
          <span className={styles.cycleMandala} aria-hidden="true" />
          {copy.cycleOutcome[0]}
          <span>{copy.cycleOutcome[1]}</span>
        </p>
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
                    <Icon size={22} aria-hidden="true" />
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
                    <Icon size={24} aria-hidden="true" />
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
          <Image src="/scenes/medina-terrace.png" alt="" fill sizes="60vw" className={styles.finalPhoto} />
        </div>
        <div className={styles.finalPattern} aria-hidden="true" />
        <div className={styles.finalInner}>
          <h2 id="final-title">
            {copy.finalTitle[0]}
            <span>{copy.finalTitle[1]}</span>
          </h2>
          <Link className={styles.finalPrimary} href={href("/diagnostic")}>
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
    </main>
  );
}
