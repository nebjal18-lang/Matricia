import Link from "next/link";
import { configuredEmailOtpLength } from "@/modules/shared/lib/auth/otp-config";
import { notFound } from "next/navigation";
import { Building2, Store, Landmark } from "lucide-react";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getLoginMessages } from "../../connexion/messages";
import { PublicPhoto } from "@/modules/public/ui/site/public-photo";
import { InscriptionConsent } from "./inscription-consent";

function withQuery(href: string, extras: Record<string, string | undefined>) {
  const url = new URL(href, "https://matricia.local");
  for (const [key, value] of Object.entries(extras)) {
    if (value) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

export default async function PublicInscriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[]; role?: string; plan?: string | string[] }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const chrome = getLoginMessages(locale);
  const role = query.role === "fournisseur" ? "fournisseur" : query.role === "franchise" ? "franchise" : "client";
  const plan = typeof query.plan === "string" && /^[A-Z0-9][A-Z0-9._-]{0,63}$/iu.test(query.plan) ? query.plan : undefined;
  const nextPath = typeof query.next === "string" && query.next.startsWith("/" + locale + "/") && !query.next.startsWith("//") && !query.next.includes("\\")
    ? query.next
    : role === "fournisseur"
      ? `/${locale}/organisation?role=fournisseur`
      : role === "franchise"
        ? `/${locale}/franchise/candidature`
        : `/${locale}/organisation`;
  const profiles = [
    { id: "client", href: withQuery(`/${locale}/inscription`, { role: "client", next: typeof query.next === "string" ? query.next : undefined, plan }), title: locale === "ar" ? "مؤسسة" : "Entreprise", text: locale === "ar" ? "أبحث عن مرافقة أو مهني" : "Je cherche un accompagnement ou un professionnel", icon: Building2 },
    { id: "fournisseur", href: withQuery(`/${locale}/inscription`, { role: "fournisseur", next: typeof query.next === "string" ? query.next : undefined, plan }), title: locale === "ar" ? "مهني" : "Professionnel", text: locale === "ar" ? "أقترح كفاءاتي وخدماتي" : "Je propose mes compétences et mes services", icon: Store, alias: chrome.providerAccount },
    { id: "franchise", href: withQuery(`/${locale}/inscription`, { role: "franchise", plan }), title: locale === "ar" ? "مرشح امتياز" : "Candidat franchisé", text: locale === "ar" ? "أرغب في تطوير مكتبة ماتريسيا" : "Je souhaite développer une bibliothèque Matricia", icon: Landmark },
  ] as const;

  return (
    <main id="contenu-principal" className="public-page pb-16">
      <section className="public-wrap grid gap-10 py-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
        <div>
          <p className="max-w-xl text-4xl font-semibold leading-tight text-[var(--mat-navy)]">{locale === "ar" ? "مؤسسات ومهنيون، تقدموا معاً." : "Entreprises et professionnels, avancez ensemble."}</p>
          <p className="public-lead mt-4">{locale === "ar" ? "تنظم ماتريسيا الاحتياجات وتسهّل الربط وترافق تنفيذ الخدمات." : "Matricia structure les besoins, facilite la mise en relation et accompagne l’exécution des prestations."}</p>
          <ul className="mt-8 space-y-4">
            {(role === "fournisseur"
              ? (locale === "ar"
                ? [["مجاني ودون التزام", "أنشئوا ملفكم المهني دون رسوم دخول."], ["مهام مؤهلة", "اطلعوا على استشارات متوافقة مع خبرتكم."], ["مرافقة في كل مرحلة", "من التأهيل إلى التنفيذ مع ضوابط ماتريسيا."]]
                : [["Gratuit et sans engagement", "Créez votre profil professionnel sans droit d’entrée."], ["Accès à des missions qualifiées", "Recevez des consultations compatibles avec votre expertise."], ["Accompagnement à chaque étape", "De la qualification à l’exécution, avec les contrôles Matricia."]])
              : (locale === "ar"
                ? [["فرص مؤهلة", "مشاريع ملموسة وشركاء ثقة."], ["أدوات لنشاطكم", "وفّروا الوقت وركّزوا على الأهم."], ["منظومة أكثر انفتاحاً", "معاً لسوق أكثر شفافية ووصولاً."]]
                : [["Des opportunités qualifiées", "Des projets concrets et des partenaires de confiance."], ["Des outils pensés pour votre activité", "Gagnez du temps, restez concentré sur l’essentiel."], ["Un écosystème plus ouvert", "Ensemble pour un marché plus transparent et accessible."]])
            ).map(([title, text]) => (
              <li key={title}>
                <strong className="block text-[var(--mat-navy)]">{title}</strong>
                <span className="mt-1 block text-sm text-slate-600">{text}</span>
              </li>
            ))}
          </ul>
          <PublicPhoto className="mt-8" scene="koutoubia" caption={locale === "ar" ? "نتقدم معاً" : "Avançons ensemble"} />
        </div>
        <section className="public-card max-w-none">
          <p className="journey-eyebrow">{chrome.signupAction}</p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--mat-navy)]">{locale === "ar" ? "لنبدأ بملفك" : "Commençons par votre profil"}</h1>
          <div className="mt-6 grid gap-3 sm:grid-cols-3" aria-label={chrome.signupTitle}>
            {profiles.map((profile) => (
              <Link key={profile.id} href={profile.href} aria-current={role === profile.id ? "page" : undefined} className={`rounded-2xl border p-4 no-underline ${role === profile.id ? "border-[var(--mat-violet)] bg-[var(--mat-violet-soft)]" : "border-[var(--mat-border)] bg-white"}`}>
                <profile.icon aria-hidden="true" className="text-[var(--mat-violet)]" size={22} />
                <strong className="mt-3 block text-[var(--mat-navy)]">{profile.title}</strong>
                <span className="mt-1 block text-sm text-slate-600">{profile.text}</span>
                {"alias" in profile ? <span className="sr-only">{profile.alias}</span> : null}
              </Link>
            ))}
          </div>
          {plan ? <p role="status" className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">{chrome.planIntent} : <span dir="ltr">{plan}</span>. {chrome.planNote}</p> : null}
          <p className="mt-5 text-sm font-medium">{locale === "ar" ? "لغة التواصل المفضلة" : "Langue de communication préférée"} : {locale === "ar" ? "العربية" : "Français"}</p>
          <InscriptionConsent otpLength={configuredEmailOtpLength()} locale={locale} nextPath={nextPath} />
          <p className="mt-6 text-sm text-slate-600">{chrome.loginTitle} <Link className="font-semibold text-[var(--mat-violet)] underline-offset-4 hover:underline" href={`/${locale}/connexion`}>{chrome.loginAction}</Link></p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl bg-[var(--mat-violet-soft)] p-4">
              <h2 className="text-sm font-semibold">{locale === "ar" ? "حساب شخصي، منظمة منفصلة" : "Compte personnel, organisation séparée"}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">{locale === "ar" ? "حسابكم ملك لكم. إنشاء المنظمة يتم لاحقاً، بشكل آمن." : "Votre compte vous est propre. La création d’une organisation se fait ensuite, séparément."}</p>
            </article>
            <article className="rounded-2xl bg-[var(--mat-violet-soft)] p-4">
              <h2 className="text-sm font-semibold">{locale === "ar" ? "لديكم حساب؟" : "Un compte existant ?"}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">{locale === "ar" ? "نستأنف مساركم دون إنشاء حساب مزدوج." : "Nous reprenons votre parcours sans créer de double compte."}</p>
            </article>
            <article className="rounded-2xl bg-[var(--mat-violet-soft)] p-4">
              <h2 className="text-sm font-semibold">{locale === "ar" ? "مسودتكم مؤمّنة" : "Votre brouillon en sécurité"}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">{locale === "ar" ? "كل ما بدأتموه يُستأنف تلقائياً بعد التأكيد." : "Tout brouillon public que vous avez commencé sera repris automatiquement rattaché à votre compte après confirmation."}</p>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
