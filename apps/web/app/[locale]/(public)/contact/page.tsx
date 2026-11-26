import { MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getContactMessages } from "./messages";
import { ContactForm } from "./contact-form";
import { PublicPhoto } from "@/modules/public/ui/site/public-photo";

export default async function ContactPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ motif?: string | string[]; plan?: string | string[] }> }) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const messages = getContactMessages(locale);
  const motifCandidates = ["ABOUT", "CLIENT", "PROVIDER", "FRANCHISE", "LOGIN", "OTHER"] as const;
  const motifRaw = typeof query.motif === "string" ? query.motif.toUpperCase() : "CLIENT";
  const initialMotif = motifCandidates.includes(motifRaw as (typeof motifCandidates)[number])
    ? (motifRaw as (typeof motifCandidates)[number])
    : "CLIENT";
  const planRaw = typeof query.plan === "string" ? query.plan.trim().slice(0, 64) : "";
  const initialPlan = /^[A-Z0-9][A-Z0-9._-]{0,63}$/iu.test(planRaw) ? planRaw : undefined;

  return (
    <main id="contenu-principal" tabIndex={-1} className="public-page pb-16">
      <section className="public-contact-layout">
        <PublicPhoto className="public-contact-photo" scene="zellige" caption={locale === "ar" ? "من مواهب الغد" : "Des talents pour demain"} />
        <div className="public-contact-main">
          <p className="journey-eyebrow">{messages.eyebrow}</p>
          <h1>{messages.title}</h1>
          <p className="public-lead mt-5">{messages.description}</p>
          <p className="journey-script mt-4">{locale === "ar" ? "المهنيون. مغرب يتقدم." : "Des professionnels. Un Maroc qui avance."}</p>
          <div className="mt-8">
            <ContactForm locale={locale} initialMotif={initialMotif} {...(initialPlan !== undefined ? { initialPlan } : {})} />
          </div>
        </div>
      </section>
      <section className="public-wrap mt-10">
        <article className="public-card flex items-start gap-3">
          <MapPin aria-hidden="true" className="text-[var(--mat-violet)]" />
          <div>
            <h2>{locale === "ar" ? "مقرنا" : "Notre siège"}</h2>
            <p className="public-muted mt-1">{locale === "ar" ? "يُبلَّغ العنوان عند الحاجة داخل المساحة الآمنة." : "L’adresse est communiquée si nécessaire depuis l’espace sécurisé."}</p>
          </div>
        </article>
      </section>
      <p className="public-wrap mt-6">
        <Link className="journey-known" href={`/${locale}/diagnostic`}>{messages.serviceAction}</Link>
        {" · "}
        <Link className="journey-known" href={`/${locale}/besoin`}>{messages.needAction}</Link>
      </p>
    </main>
  );
}
