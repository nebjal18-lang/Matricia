import type { DemoPersona } from "./demo-personas";

type DemoAccessEnv = {
  VERCEL_ENV?: string;
  APP_ENV?: string;
  MATRICIA_DEMO_ACCESS_ENABLED?: string;
  [key: string]: string | undefined;
};

const allowedAppEnvs = new Set(["development", "staging", "test"]);

/**
 * Demo personas never unlock production. Preview/local also require an explicit
 * non-production APP_ENV plus MATRICIA_DEMO_ACCESS_ENABLED=true — a lone flag
 * on Vercel preview is not enough.
 */
export function isPublicDemoAccessEnabled(env: DemoAccessEnv = process.env): boolean {
  if (env.APP_ENV === "production" || env.VERCEL_ENV === "production") {
    return false;
  }
  if (!env.APP_ENV || !allowedAppEnvs.has(env.APP_ENV)) {
    return false;
  }
  return env.MATRICIA_DEMO_ACCESS_ENABLED === "true";
}

const defaultEmails = {
  client: "demo.client@matricia.test",
  provider: "demo.prestataire@matricia.test",
  franchise: "demo.franchise@matricia.test",
  admin: "demo.admin@matricia.test",
} as const satisfies Record<DemoPersona, string>;

export function demoPersonaEmail(persona: DemoPersona, env: DemoAccessEnv = process.env): string {
  const configured = env[`MATRICIA_DEMO_${persona.toUpperCase()}_EMAIL`]?.trim();
  return configured || defaultEmails[persona];
}
