import type { DemoPersona } from "./demo-personas";

type DemoAccessEnv = {
  VERCEL_ENV?: string;
  APP_ENV?: string;
  MATRICIA_DEMO_ACCESS_ENABLED?: string;
  [key: string]: string | undefined;
};

export function isPublicDemoAccessEnabled(env: DemoAccessEnv = process.env): boolean {
  if (env.VERCEL_ENV === "production") {
    return env.MATRICIA_DEMO_ACCESS_ENABLED === "true"
      && (env.APP_ENV === "development" || env.APP_ENV === "staging");
  }
  if (env.VERCEL_ENV === "preview") return true;
  return env.MATRICIA_DEMO_ACCESS_ENABLED === "true" && env.APP_ENV !== "production";
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
