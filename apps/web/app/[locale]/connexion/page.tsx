import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { translateLocalPath } from "@/modules/shared/lib/auth/workspace-navigation";
import { configuredEmailOtpLength } from "@/modules/shared/lib/auth/otp-config";
import { InscriptionConsent } from "../(public)/inscription/inscription-consent";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "@/modules/shared/lib/i18n/dictionaries";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getLoginMessages } from "./messages";
import { OtpForm } from "./otp-form";
import { DemoAccess } from "./demo-access";
import { isPublicDemoAccessEnabled } from "./demo-policy";
import { PublicPhoto } from "@/modules/public/ui/site/public-photo";

function sanitizePlanCode(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const plan = value.trim().slice(0, 64);
  return /^[A-Z0-9][A-Z0-9._-]{0,63}$/iu.test(plan) ? plan : undefined;
}

function withQuery(href: string, extras: Record<string, string | undefined>) {
  const url = new URL(href, "https://matricia.local");
  for (const [key, value] of Object.entries(extras)) {
    if (value) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}`;
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string | string[]; mode?: string; role?: string; demo?: string; plan?: string | string[] }> }) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const messages = getDictionary(locale).auth;
  const chrome = getLoginMessages(locale);
  const alternate = locale === "fr" ? "ar" : "fr";
  const registration = query.mode === "inscription";
  const registrationRole = query.role === "fournisseur" ? "fournisseur" : "client";
  const planCode = sanitizePlanCode(query.plan);
  const nextPath = safeReturnPath(query.next, locale);
  const defaultRegistrationPath = `/${locale}/organisation${registrationRole === "fournisseur" ? "?role=fournisseur" : ""}`;
  const effectiveNextPath = registration ? nextPath ?? defaultRegistrationPath : nextPath;
  const translatedNextPath = effectiveNextPath ? translateLocalPath(effectiveNextPath, locale, alternate) : undefined;
  const languageHref = withQuery(`/${alternate}/connexion`, {
    mode: registration ? "inscription" : undefined,
    role: registration ? registrationRole : undefined,
    next: translatedNextPath,
    plan: planCode,
  });

  return (
    <main dir={locale === "ar" ? "rtl" : "ltr"} className="public-page pb-0">
      <div className="public-auth-split">
        <div className="relative">
          <PublicPhoto
            className="public-auth-hero hidden lg:block"
            scene="window"
            caption={locale === "ar" ? "مؤسسات أقوى لمغرب مستدام" : "Des entreprises plus fortes pour un Maroc durable"}
            lead={locale === "ar"
              ? "ترافقكم Matricia في كل مرحلة من مشاريعكم، مع المهنيين المناسبين، وفي ثقة تامة."
              : "Matricia vous accompagne à chaque étape de vos projets, avec les bons professionnels, en toute confiance."}
          />
          <p className="public-lead mt-4 px-6 lg:sr-only">{chrome.panelBody}</p>
        </div>
        <section className="public-card public-auth-panel max-w-none" aria-labelledby="login-title">
          <div className="mb-4 flex justify-end">
            <Link href={languageHref} hrefLang={alternate} className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[var(--mat-violet)]">{messages.language}</Link>
          </div>
          <p className="journey-eyebrow">{messages.eyebrow}</p>
          <h1 id="login-title" className="mt-3">{registration ? chrome.signupPageTitle : messages.title}</h1>
          <p className="public-lead mt-3">{registration ? chrome.signupPageDescription : messages.description}</p>
          {!registration ? (
            <ol className="public-auth-steps" aria-label={messages.title}>
              <li className="is-current"><span>1</span>{locale === "ar" ? "بريدكم" : "Votre email"}</li>
              <li><span>2</span>{locale === "ar" ? "رمز التحقق" : "Code de vérification"}</li>
              <li><span>3</span>{locale === "ar" ? "الدخول إلى مساحتكم" : "Accès à votre espace"}</li>
            </ol>
          ) : null}
          {registration ? (
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-[var(--mat-canvas)] p-1" aria-label={chrome.signupTitle}>
              <Link aria-current={registrationRole === "client" ? "page" : undefined} href={withQuery(`/${locale}/connexion`, { mode: "inscription", role: "client", next: nextPath, plan: planCode })} className="min-h-11 rounded-lg px-3 py-3 text-center text-sm font-semibold aria-[current=page]:bg-white aria-[current=page]:text-[var(--mat-violet)] aria-[current=page]:shadow-sm">{chrome.clientAccount}</Link>
              <Link aria-current={registrationRole === "fournisseur" ? "page" : undefined} href={withQuery(`/${locale}/connexion`, { mode: "inscription", role: "fournisseur", next: nextPath, plan: planCode })} className="min-h-11 rounded-lg px-3 py-3 text-center text-sm font-semibold aria-[current=page]:bg-white aria-[current=page]:text-[var(--mat-violet)] aria-[current=page]:shadow-sm">{chrome.providerAccount}</Link>
            </div>
          ) : null}
          {planCode ? <p role="status" className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950"><strong>{chrome.planIntent} :</strong> <span dir="ltr">{planCode}</span>. {chrome.planNote}</p> : null}
          {!registration && nextPath ? <p className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6">{locale === "ar" ? "بعد الاتصال ستعودون إلى الصفحة المطلوبة إذا كانت صلاحياتكم تسمح بذلك. قد يلزم تحقق معزّز." : "Après connexion, vous retrouverez la page demandée si votre compte est habilité. Une vérification renforcée peut être nécessaire."}</p> : null}
          <div className="mt-8">{registration ? <InscriptionConsent otpLength={configuredEmailOtpLength()} locale={locale} nextPath={effectiveNextPath ?? defaultRegistrationPath}/> : <OtpForm otpLength={configuredEmailOtpLength()} locale={locale} nextPath={effectiveNextPath}/>}</div>
          {!registration && isPublicDemoAccessEnabled() ? <DemoAccess locale={locale} nextPath={effectiveNextPath} /> : null}
          {!registration && (query.demo === "unavailable" || query.demo === "disabled") ? <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{query.demo === "disabled" ? chrome.demoDisabled : chrome.demoUnavailable}</p> : null}
          <ul className="mt-8 space-y-3 text-sm text-slate-600">
            {(locale === "fr"
              ? ["Vos données sont protégées", "Authentification par code à usage unique", "Aucune information sur l’existence d’un compte n’est affichée"]
              : ["بياناتكم محمية", "مصادقة برمز لمرة واحدة", "لا تُعرض أي معلومة عن وجود حساب"]
            ).map((item) => <li key={item} className="flex items-start gap-2"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 text-[var(--mat-violet)]" /><span>{item}</span></li>)}
          </ul>
          <div className="mt-7 border-t border-[var(--mat-border)] pt-6 text-center">
            <p className="text-sm text-slate-600">{registration ? chrome.loginTitle : chrome.signupTitle}</p>
            {registration ? <Link href={withQuery(`/${locale}/connexion`, { next: nextPath, plan: planCode })} className="mt-2 inline-flex min-h-11 items-center font-semibold text-[var(--mat-violet)] underline-offset-4 hover:underline">{chrome.loginAction}</Link> : <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row"><Link href={withQuery(`/${locale}/inscription`, { role: "client", plan: planCode, next: nextPath })} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--mat-violet)] px-4 font-semibold text-[var(--mat-violet)]">{chrome.clientAccount}</Link><Link href={withQuery(`/${locale}/inscription`, { role: "fournisseur", plan: planCode, next: nextPath })} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--mat-violet)] px-4 font-semibold text-[var(--mat-violet)]">{chrome.providerAccount}</Link></div>}
          </div>
          <p className="mt-7 flex items-start gap-2 text-sm leading-6 text-slate-500"><LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{chrome.security}</span></p>
          <Link href={`/${locale}`} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-[var(--mat-violet)]"><ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />{chrome.back}</Link>
        </section>
      </div>
      <section className="public-auth-band" aria-label={locale === "ar" ? "التزام ماتريسيا" : "Engagement Matricia"}>
        <p>{locale === "ar" ? "نبني اليوم مغرب الغد" : "Bâtir aujourd’hui le Maroc de demain"}</p>
        <ul>
          {(locale === "ar"
            ? ["مؤسسات أكثر أداءً", "تعاونات موثوقة", "أثر دائم على أقاليمنا", "أبعد، معاً"]
            : ["Des entreprises plus performantes", "Des collaborations de confiance", "Un impact durable sur nos territoires", "Plus loin, ensemble"]
          ).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>
    </main>
  );
}
