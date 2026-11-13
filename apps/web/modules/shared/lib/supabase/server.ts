import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnvironment } from "@/modules/shared/lib/env";
import { withRequestCache } from "./request-cache";

async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const environment = getPublicEnvironment();
  return createServerClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const cookie of cookiesToSet) cookieStore.set(cookie.name, cookie.value, cookie.options);
        } catch {
          // Server Components cannot always persist refreshed cookies; proxy.ts owns refresh persistence.
        }
      },
    },
  });
}

export const getSupabaseServerClient = withRequestCache(createSupabaseServerClient);

/** One Auth round-trip per request for all Server Components / loaders. */
export const getServerAuthUser = withRequestCache(async () => {
  const client = await getSupabaseServerClient();
  return client.auth.getUser();
});
