import { ArrowRight, BadgeCheck, BookOpen, ChartNoAxesCombined, FileCheck, Network, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { localizedRouteMetadata } from "@/modules/shared/lib/seo/metadata";
import { getPublicMessages } from "../messages";
import { getFranchisePresentation } from "@/modules/public/data/franchise-presentation";
import { PublicPhoto } from "@/modules/public/ui/site/public-photo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getPublicMessages(locale).franchise;
  return localizedRouteMetadata(locale, "/franchise", copy.title, copy.description);
}

export default async function PublicFranchisePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = getPublicMessages(locale).franchise;
  const presentation = getFranchisePresentation(locale);
  const apply = locale === "ar" ? "إيداع ترشيحي" : "Déposer ma candidature";
  const understand = locale === "ar" ? "فهم دور صاحب الامتياز" : "Comprendre le rôle du franchisé";

  return (
    <main id="contenu-principal" tabIndex={-1} className="public-page pb-16">
      <section className="public-hero-split">
        <div>
          <p className="journey-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="public-lead mt-5">{copy.description}</p>
          <div className="journey-actions">
            <Link href={`/${locale}/franchise/candidature`} className="journey-primary is-coral">{apply}<ArrowRight className="rtl-mirror" size={16} aria-hidden="true" /></Link>
            <a href="#role-franchise" className="journey-secondary">{understand}</a>
          </div>
        </div>
        <PublicPhoto scene="koutoubia" caption={locale === "ar" ? "أقاليم أقوى، معاً" : "Des territoires plus forts, ensemble."} />
      </section>
      <section id="role-franchise" className="public-wrap">
        <h2 className="public-h2">{copy.roleTitle}</h2>
        <p className="public-lead mt-3">{presentation.definition}</p>
        <p className="public-muted mt-3">{copy.roleDescription}</p>
        <ol className="journey-six-steps mt-8">
          {copy.framework.map((item, index) => (
            <li key={item}>
              <span>{index + 1}</span>
              <strong>{item.split(".")[0]}</strong>
              <p>{item.includes(". ") ? item.slice(item.indexOf(". ") + 2) : item}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="public-wrap mt-12 grid gap-5 lg:grid-cols-3">
        {copy.roles.map((role, index) => {
          const Icon = [Network, BadgeCheck, ChartNoAxesCombined, BookOpen, FileCheck, ShieldCheck][index] ?? ShieldCheck;
          return (
            <article key={role.title} className="public-card">
              <Icon aria-hidden="true" className="text-[var(--mat-violet)]" />
              <h3>{role.title}</h3>
              <p className="public-muted">{role.description}</p>
            </article>
          );
        })}
      </section>
      <section className="public-wrap journey-cta-band mt-12">
        <div>
          <h2>{copy.ctaTitle}</h2>
          <p>{copy.ctaDescription}</p>
        </div>
        <Link href={`/${locale}/franchise/candidature`} className="journey-primary is-coral">{apply}</Link>
      </section>
    </main>
  );
}
