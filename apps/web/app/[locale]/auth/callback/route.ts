import { NextResponse, type NextRequest } from "next/server";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return NextResponse.redirect(new URL("/fr/connexion", request.url));
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeReturnPath(request.nextUrl.searchParams.get("next"), locale) ?? `/${locale}/tableau-de-bord`;
  if (code) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(nextPath, request.url));
  }
  return NextResponse.redirect(new URL(connexionHref(locale, { next: nextPath }), request.url));
}
