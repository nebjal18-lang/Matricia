type PreviewEnvironment = {
  VERCEL_ENV?: string;
  APP_ENV?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  STAGING_SUPABASE_PROJECT_REF?: string;
  PRODUCTION_SUPABASE_PROJECT_REF?: string;
};

/** A Preview build must never silently inherit the public deployment's database. */
export function assertPreviewIsolation(environment: PreviewEnvironment): void {
  if (environment.VERCEL_ENV !== "preview") return;
  if (environment.APP_ENV?.trim().toLowerCase() !== "staging") {
    throw new Error("PREVIEW_STAGING_ENVIRONMENT_REQUIRED");
  }
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
