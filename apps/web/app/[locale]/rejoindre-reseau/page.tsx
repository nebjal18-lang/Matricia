import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { networkLinkSchema } from "@/modules/franchise/screens/network/recipient-model";
import { NetworkRecipientForm } from "@/modules/franchise/screens/network/recipient-form";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false, follow: false, noarchive: true } };

export default async function JoinNetworkPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ invitationId?: string; token?: string }> }) {
  const { locale } = await params, query = await searchParams;
  if (!isLocale(locale)) notFound();
  const parsed = networkLinkSchema.safeParse({ ...query, locale });
  if (!parsed.success) return <main className="mx-auto max-w-2xl p-6"><h1>{locale === "fr" ? "Lien d’invitation invalide" : "رابط الدعوة غير صالح"}</h1><Link className="underline" href={`/${locale}`}>{locale === "fr" ? "Accueil" : "الرئيسية"}</Link></main>;
  const client = await getSupabaseServerClient();
  const auth = await client.auth.getUser();
  if (auth.error && auth.error.status !== 401) return <main className="mx-auto max-w-2xl p-6"><p role="alert">{locale === "fr" ? "Vérification de session indisponible. Réessayez cette page." : "التحقّق من الجلسة غير متاح. أعيدوا المحاولة."}</p></main>;
  const suffix = new URLSearchParams({ invitationId: parsed.data.invitationId, token: parsed.data.token }).toString();
  if (!auth.data.user) redirect(connexionHref(locale, { next: `/${locale}/rejoindre-reseau?${suffix}` }));
  const alternate = locale === "fr" ? "ar" : "fr";
  return <main className="min-h-dvh bg-muted/40 px-4 py-8"><div className="mx-auto max-w-2xl space-y-6">
    <nav className="flex flex-wrap justify-between gap-4"><Link className="underline" href={`/${locale}`}>{locale === "fr" ? "Accueil" : "الرئيسية"}</Link><Link className="underline" href={`/${alternate}/rejoindre-reseau?${suffix}`} hrefLang={alternate}>{alternate === "ar" ? "العربية" : "Français"}</Link></nav>
    <NetworkRecipientForm locale={locale} invitationId={parsed.data.invitationId} token={parsed.data.token} idempotencyKey={randomUUID()} />
  </div></main>;
}
