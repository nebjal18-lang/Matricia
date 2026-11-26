type DemoAccessEnvironment = {
  APP_ENV?: string;
  VERCEL_ENV?: string;
  MATRICIA_DEMO_ACCESS_ENABLED?: string;
  MATRICIA_DEMO_PRODUCTION_ACCESS_ENABLED?: string;
  [key: string]: string | undefined;
};

const nonProductionEnvironments = new Set(["development", "staging", "test"]);

/** Public one-click demo access, including admin, requires explicit opt-in. */
export function isDemoAccessEnabled(env: DemoAccessEnvironment = process.env): boolean {
  if (env.MATRICIA_DEMO_ACCESS_ENABLED !== "true") return false;
  if (env.APP_ENV === "production" || env.VERCEL_ENV === "production") {
    return env.MATRICIA_DEMO_PRODUCTION_ACCESS_ENABLED === "true";
  }
  return Boolean(env.APP_ENV && nonProductionEnvironments.has(env.APP_ENV));
}
