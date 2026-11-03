import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnvironment } from "@/modules/shared/lib/env";

export function getSupabaseAdminClient(options: {timeoutMs?: number} = {}) {
  const environment = getServerEnvironment();
  return createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(options.timeoutMs ? {global: {fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, {...init, signal: AbortSignal.any([AbortSignal.timeout(options.timeoutMs!), ...(init?.signal ? [init.signal] : [])])})}} : {}),
  });
}
