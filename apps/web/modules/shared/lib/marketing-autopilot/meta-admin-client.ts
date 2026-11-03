import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnvironment } from "@/modules/shared/lib/env";
export function getMetaAdminClient() {
 const env=getServerEnvironment();
 return createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.any([AbortSignal.timeout(8_000),...(init?.signal?[init.signal]:[])])})}});
}
