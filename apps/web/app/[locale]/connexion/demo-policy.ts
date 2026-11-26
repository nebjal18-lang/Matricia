import type { DemoPersona } from "./demo-personas";
import { isDemoAccessEnabled } from "@/modules/shared/lib/demo-access";

type DemoAccessEnv = {
  VERCEL_ENV?: string;
  APP_ENV?: string;
  MATRICIA_DEMO_ACCESS_ENABLED?: string;
  MATRICIA_DEMO_PRODUCTION_ACCESS_ENABLED?: string;
  [key: string]: string | undefined;
};

/** Production demo access requires a second, explicit environment flag. */
export function isPublicDemoAccessEnabled(env: DemoAccessEnv = process.env): boolean {
  return isDemoAccessEnabled(env);
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
