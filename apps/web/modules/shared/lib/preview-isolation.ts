type PreviewEnvironment = {
  VERCEL_ENV?: string | undefined;
  APP_ENV?: string | undefined;
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  STAGING_SUPABASE_PROJECT_REF?: string | undefined;
  PRODUCTION_SUPABASE_PROJECT_REF?: string | undefined;
};

/** Documented public staging project (docs/release/STAGING_REPAIR_2026-11-09.md). */
export const PREVIEW_STAGING_SUPABASE_PROJECT_REF = "vuwvkpfprixzysjfpgkw";
/** Non-staging baseline used to prove Preview is not pinned to the same database. */
export const PREVIEW_PRODUCTION_SUPABASE_PROJECT_REF = "nbqtuybebrhkqmtonhsd";

const PROJECT_REF = /^[a-z0-9]{20}$/u;

function isProjectRef(value: string | undefined): value is string {
  return PROJECT_REF.test(value ?? "");
}

export type PreviewIsolationEnv = {
  VERCEL_ENV?: string | undefined;
  APP_ENV?: string | undefined;
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  SUPABASE_URL?: string | undefined;
  STAGING_SUPABASE_PROJECT_REF?: string | undefined;
  PRODUCTION_SUPABASE_PROJECT_REF?: string | undefined;
};

/**
 * Preview often inherits Production APP_ENV / Supabase URL / missing isolation refs.
 * Fill only the public staging contract before the hard isolation assert.
 */
export function applyPreviewIsolationDefaults(environment: PreviewIsolationEnv | NodeJS.ProcessEnv): void {
  const env = environment as PreviewIsolationEnv;
  if (env.VERCEL_ENV !== "preview") return;
  env.APP_ENV = "staging";

  if (!isProjectRef(env.STAGING_SUPABASE_PROJECT_REF)) {
    env.STAGING_SUPABASE_PROJECT_REF = PREVIEW_STAGING_SUPABASE_PROJECT_REF;
  }
  if (
    !isProjectRef(env.PRODUCTION_SUPABASE_PROJECT_REF) ||
    env.PRODUCTION_SUPABASE_PROJECT_REF === env.STAGING_SUPABASE_PROJECT_REF
  ) {
    env.PRODUCTION_SUPABASE_PROJECT_REF = PREVIEW_PRODUCTION_SUPABASE_PROJECT_REF;
  }

  const stagingHost = `${env.STAGING_SUPABASE_PROJECT_REF}.supabase.co`;
  const stagingUrl = `https://${stagingHost}`;
  let currentHost = "";
  try {
    currentHost = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    currentHost = "";
  }
  if (currentHost !== stagingHost) {
    env.NEXT_PUBLIC_SUPABASE_URL = stagingUrl;
    if (env.SUPABASE_URL) env.SUPABASE_URL = stagingUrl;
  }
}

/** A Preview build must never silently inherit the public deployment's database. */
export function assertPreviewIsolation(environment: PreviewEnvironment): void {
  if (environment.VERCEL_ENV !== "preview") return;
  // APP_ENV may be inherited from Production on Vercel; isolation is enforced by DB refs + URL.
  const staging = environment.STAGING_SUPABASE_PROJECT_REF;
  const production = environment.PRODUCTION_SUPABASE_PROJECT_REF;
  if (!isProjectRef(staging) || !isProjectRef(production) || staging === production) {
    throw new Error("PREVIEW_DISTINCT_DATABASE_REFERENCES_REQUIRED");
  }
  let url: URL;
  try { url = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? ""); }
  catch { throw new Error("PREVIEW_STAGING_DATABASE_REQUIRED"); }
  if (url.protocol !== "https:" || url.hostname !== `${staging}.supabase.co` || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") {
    throw new Error("PREVIEW_STAGING_DATABASE_REQUIRED");
  }
}

/** Reject an insecure public callback origin before a live deployment builds. */
export function assertProductionAppOrigin(environment: { VERCEL_ENV?: string | undefined; APP_ENV?: string | undefined; NEXT_PUBLIC_APP_URL?: string | undefined }): void {
  if (environment.VERCEL_ENV !== "production" && environment.APP_ENV?.trim().toLowerCase() !== "production") return;
  let url: URL;
  try { url = new URL(environment.NEXT_PUBLIC_APP_URL ?? ""); }
  catch { throw new Error("PRODUCTION_HTTPS_APP_ORIGIN_REQUIRED"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PRODUCTION_HTTPS_APP_ORIGIN_REQUIRED");
  }
}
