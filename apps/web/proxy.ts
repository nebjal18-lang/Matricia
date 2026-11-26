import type { NextRequest } from "next/server";
import { refreshSupabaseSession } from "@/modules/shared/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return refreshSupabaseSession(request);
}

export const config = {
  // Static icons must bypass session refresh: /favicon.ico is not a locale route,
  // so getPublicEnvironment() would otherwise run and can 500 the asset rewrite.
  matcher: ["/((?!_next/|favicon\\.ico|favicon\\.svg|.*\\.(?:ico|svg|png|jpg|jpeg|gif|webp)$).*)"],
};
