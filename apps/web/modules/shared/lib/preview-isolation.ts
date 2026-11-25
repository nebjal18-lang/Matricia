type PreviewEnvironment = {
  VERCEL_ENV?: string | undefined;
  APP_ENV?: string | undefined;
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  STAGING_SUPABASE_PROJECT_REF?: string | undefined;
  PRODUCTION_SUPABASE_PROJECT_REF?: string | undefined;
};

/** A Preview build must never silently inherit the public deployment's database. */
export function assertPreviewIsolation(environment: PreviewEnvironment): void {
  if (environment.VERCEL_ENV !== "preview") return;
  // APP_ENV may be inherited from Production on Vercel; isolation is enforced by DB refs + URL.
  const staging = environment.STAGING_SUPABASE_PROJECT_REF;
  const production = environment.PRODUCTION_SUPABASE_PROJECT_REF;
  if (!/^[a-z0-9]{20}$/u.test(staging ?? "") || !/^[a-z0-9]{20}$/u.test(production ?? "") || staging === production) {
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
