import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnvironment } from "@/modules/shared/lib/env";
import { normalizeLocale } from "@/modules/shared/lib/i18n/locale";

const PUBLIC_EXACT_SEGMENTS = new Set([
  "",
  "a-propos",
  "abonnements",
  "besoin",
  "conditions",
  "confidentialite",
  "contact",
  "diagnostic",
  "entreprises",
  "fournisseur",
  "franchise",
  "mentions-legales",
]);

function isPublicPath(pathname: string, locale: string): boolean {
  if (pathname === "/") return true;
  const localeRoot = `/${locale}`;
  if (pathname === localeRoot || pathname === `${localeRoot}/`) return true;
  const localizedPath = pathname.startsWith(`${localeRoot}/`) ? pathname.slice(localeRoot.length + 1).replace(/\/$/u, "") : null;
  if (localizedPath === null) return false;
  return PUBLIC_EXACT_SEGMENTS.has(localizedPath)
    || localizedPath === "services"
    || localizedPath.startsWith("services/")
    || localizedPath === "franchise/candidature"
    || localizedPath.startsWith("diagnostic/");
}

function withLocaleCookie(response: NextResponse, request: NextRequest, locale: string): NextResponse {
  response.cookies.set("matricia_locale", locale, { sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/" });
  return response;
}

export async function refreshSupabaseSession(request: NextRequest) {
  const locale = normalizeLocale(request.nextUrl.pathname.split("/")[1]);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-matricia-locale", locale);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isPublicPath(request.nextUrl.pathname, locale)) return withLocaleCookie(response, request, locale);
  const environment = getPublicEnvironment();
  const supabase = createServerClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) request.cookies.set(cookie.name, cookie.value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const cookie of cookiesToSet) response.cookies.set(cookie.name, cookie.value, cookie.options);
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const isLogin = request.nextUrl.pathname === `/${locale}/connexion`;
  const protectedPrefixes = [
    "tableau-de-bord",
    "organisation",
    "invitations",
    "securite",
    "client",
    "sous-traitant",
    "franchise",
    "administration",
    "catalogue",
    "notifications",
  ];
  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname === `/${locale}/${prefix}`
    || request.nextUrl.pathname.startsWith(`/${locale}/${prefix}/`)
  );
  if (!user && isProtected) {
    const login = new URL(`/${locale}/connexion`, request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (user && isLogin) return NextResponse.redirect(new URL(safeReturnPath(request.nextUrl.searchParams.get("next"),locale) ?? `/${locale}/tableau-de-bord`, request.url));
  return withLocaleCookie(response, request, locale);
}
