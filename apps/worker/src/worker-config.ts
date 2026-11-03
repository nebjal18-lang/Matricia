export type WorkerEnvironment = "development" | "staging" | "production";

export type WorkerRuntimeConfig = Readonly<{
  environment: WorkerEnvironment;
  supabaseUrl: string;
  supabaseServiceKey: string;
  supabaseProjectRef: string;
  dispatchUrl: URL;
  webhookSecret: string;
  port: number;
}>;

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`WORKER_CONFIG_${name}_REQUIRED`);
  return value;
}

function strictInteger(value: string, name: string, minimum: number, maximum: number): number {
  if (!/^[0-9]+$/.test(value)) throw new Error(`WORKER_CONFIG_${name}_INVALID`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`WORKER_CONFIG_${name}_INVALID`);
  }
  return parsed;
}

function allowedHosts(env: NodeJS.ProcessEnv, name: string): readonly string[] {
  const hosts = required(env, name).split(",").map((host) => host.trim().toLowerCase());
  if (hosts.some((host) => !host || !/^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|::1)$/.test(host))
    || new Set(hosts).size !== hosts.length) {
    throw new Error(`WORKER_CONFIG_${name}_INVALID`);
  }
  return hosts;
}

export function readWorkerRuntimeConfig(env: NodeJS.ProcessEnv): WorkerRuntimeConfig {
  const environment = required(env, "APP_ENV");
  if (!(["development", "staging", "production"] as const).includes(environment as WorkerEnvironment)) {
    throw new Error("WORKER_CONFIG_APP_ENV_INVALID");
  }

  const supabase = new URL(required(env, "NEXT_PUBLIC_SUPABASE_URL"));
  const projectMatch = supabase.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
  const localProject = environment === "development" && env.NODE_ENV !== "production"
    && env.WORKER_LOCAL_SUPABASE_ENABLED === "true"
    && env.WORKER_LOCAL_SUPABASE_PROJECT_ID === "Matricia"
    && supabase.origin === "http://127.0.0.1:54321";
  if ((!localProject && (supabase.protocol !== "https:" || !projectMatch)) || supabase.pathname !== "/"
    || supabase.username || supabase.password || supabase.search || supabase.hash) {
    throw new Error("WORKER_CONFIG_SUPABASE_URL_INVALID");
  }
  const projectRef = localProject ? "Matricia" : projectMatch?.[1];
  if (!projectRef) throw new Error("WORKER_CONFIG_SUPABASE_URL_INVALID");
  if (required(env, "SUPABASE_PROJECT_REF") !== projectRef) throw new Error("WORKER_CONFIG_SUPABASE_PROJECT_REF_MISMATCH");

  const dispatchUrl = new URL(required(env, "WORKER_DISPATCH_URL"));
  const dispatchAllowedHosts = allowedHosts(env, "WORKER_DISPATCH_ALLOWED_HOSTS");
  const localDevelopmentTarget = environment === "development"
    && dispatchUrl.protocol === "http:"
    && ["localhost", "127.0.0.1", "::1"].includes(dispatchUrl.hostname);
  if ((dispatchUrl.protocol !== "https:" && !localDevelopmentTarget)
    || dispatchUrl.username || dispatchUrl.password || dispatchUrl.hash
    || !dispatchAllowedHosts.includes(dispatchUrl.hostname.toLowerCase())) {
    throw new Error("WORKER_CONFIG_WORKER_DISPATCH_URL_INVALID");
  }

  const serviceKey = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = required(env, "INTERNAL_WEBHOOK_SECRET");
  if (serviceKey.length < 32) throw new Error("WORKER_CONFIG_SUPABASE_SERVICE_ROLE_KEY_INVALID");
  if (webhookSecret.length < 32) throw new Error("WORKER_CONFIG_INTERNAL_WEBHOOK_SECRET_INVALID");

  return Object.freeze({
    environment: environment as WorkerEnvironment,
    supabaseUrl: supabase.origin,
    supabaseServiceKey: serviceKey,
    supabaseProjectRef: projectRef,
    dispatchUrl,
    webhookSecret,
    port: strictInteger(env.PORT ?? "8080", "PORT", 1, 65_535),
  });
}
