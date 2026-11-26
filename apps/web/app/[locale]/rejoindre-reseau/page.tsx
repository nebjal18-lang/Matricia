import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { networkLinkSchema } from "@/modules/franchise/screens/network/recipient-model";
import { NetworkRecipientForm } from "@/modules/franchise/screens/network/recipient-form";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { buttonVariants } from "@/modules/shared/ui/button";
import { cn } from "@/modules/shared/lib/utils";

export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false, noarchive: true } };

function JoinNetworkFeedback({ locale, kind, retryHref }: { locale: "fr" | "ar"; kind: "invalid" | "session"; retryHref?: string }) {
  const fr = locale === "fr";
  const title = kind === "invalid"
    ? (fr ? "Lien d’invitation invalide" : "رابط الدعوة غير صالح")
    : (fr ? "Vérification de session indisponible" : "التحقّق من الجلسة غير متاح");
  const description = kind === "invalid"
    ? (fr ? "Vérifiez le lien reçu ou demandez une nouvelle invitation à votre contact." : "تحققوا من الرابط المستلم أو اطلبوا دعوة جديدة من جهة الاتصال.")
    : (fr ? "Réessayez cette page. Si le problème persiste, revenez à l’accueil." : "أعيدوا محاولة فتح الصفحة. إذا استمرت المشكلة، عودوا إلى الرئيسية.");
  return (
    <main className="flex min-h-dvh items-center bg-muted/40 px-4 py-10 sm:px-6">
      <section className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-6 shadow-sm sm:p-10" aria-labelledby="join-network-feedback-title">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Matricia</p>
        <h1 id="join-network-feedback-title" className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground" role={kind === "session" ? "alert" : undefined}>{description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {retryHref ? <Link className={cn(buttonVariants(), "min-h-11")} href={retryHref}>{fr ? "Réessayer" : "إعادة المحاولة"}</Link> : null}
          <Link className={cn(buttonVariants({ variant: retryHref ? "outline" : "default" }), "min-h-11")} href={`/${locale}`}>{fr ? "Retour à l’accueil" : "العودة إلى الرئيسية"}</Link>
        </div>
      </section>
    </main>
  );
}

export default async function JoinNetworkPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ invitationId?: string; token?: string }> }) {
  const { locale } = await params, query = await searchParams;
  if (!isLocale(locale)) notFound();
  const parsed = networkLinkSchema.safeParse({ ...query, locale });
  if (!parsed.success) return <JoinNetworkFeedback locale={locale} kind="invalid" />;
  const client = await getSupabaseServerClient();
  const auth = await client.auth.getUser();
  if (auth.error && auth.error.status !== 401) return <JoinNetworkFeedback locale={locale} kind="session" retryHref={`/${locale}/rejoindre-reseau?${new URLSearchParams({ invitationId: parsed.data.invitationId, token: parsed.data.token })}`} />;
  const suffix = new URLSearchParams({ invitationId: parsed.data.invitationId, token: parsed.data.token }).toString();
  if (!auth.data.user) redirect(connexionHref(locale, { next: `/${locale}/rejoindre-reseau?${suffix}` }));
  const alternate = locale === "fr" ? "ar" : "fr";
  return <main className="min-h-dvh bg-muted/40 px-4 py-8"><div className="mx-auto max-w-2xl space-y-6">
    <nav className="flex flex-wrap justify-between gap-4"><Link className="underline" href={`/${locale}`}>{locale === "fr" ? "Accueil" : "الرئيسية"}</Link><Link className="underline" href={`/${alternate}/rejoindre-reseau?${suffix}`} hrefLang={alternate}>{alternate === "ar" ? "العربية" : "Français"}</Link></nav>
    <NetworkRecipientForm locale={locale} invitationId={parsed.data.invitationId} token={parsed.data.token} idempotencyKey={randomUUID()} />
  </div></main>;
}
