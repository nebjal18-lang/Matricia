import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyLocalDockerConfiguration } from "./local-environment.mjs";

const SAFE_ENVIRONMENTS = new Set(["development", "staging"]);

export function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith("#")) return [];
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")]];
  }));
}

function required(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required for authenticated P05 E2E setup`);
  }
  return value.trim();
}

export function assertSafeEnvironment(env, metadata) {
  const metadataEnvironment = required(metadata?.environment, "Supabase metadata environment");
  const appEnvironment = required(env.APP_ENV, "APP_ENV");
  if (!SAFE_ENVIRONMENTS.has(metadataEnvironment) || appEnvironment !== metadataEnvironment) {
    throw new Error("P05 E2E setup is restricted to the matching development or staging environment");
  }

  const projectRef = required(metadata?.project_ref, "Supabase project reference");
  if (!/^[a-z0-9]{10,40}$/.test(projectRef)) throw new Error("Supabase project reference is invalid");
  const supabaseUrl = new URL(required(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"));
  if (supabaseUrl.protocol !== "https:" || supabaseUrl.hostname !== `${projectRef}.supabase.co`
      || supabaseUrl.port !== "" || supabaseUrl.pathname !== "/" || supabaseUrl.search !== ""
      || supabaseUrl.hash !== "" || supabaseUrl.username !== "" || supabaseUrl.password !== "") {
    throw new Error("Supabase URL does not match the declared non-production project");
  }

  const baseUrl = new URL(env.E2E_BASE_URL || "http://localhost:5173");
  const localHost = baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1" || baseUrl.hostname === "[::1]";
  if (!localHost || baseUrl.protocol !== "http:" || baseUrl.port !== "5173"
      || baseUrl.pathname !== "/" || baseUrl.search !== "" || baseUrl.hash !== ""
      || baseUrl.username !== "" || baseUrl.password !== "") {
    throw new Error("Authenticated P05 E2E requires the exact local HTTP application origin on port 5173");
  }

  return {
    environment: metadataEnvironment,
    projectRef,
    region: required(metadata?.region, "Supabase region"),
    supabaseUrl: supabaseUrl.toString().replace(/\/$/, ""),
    publishableKey: required(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    serviceRoleKey: required(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"),
    databaseUrl: required(env.SUPABASE_DB_POOLER_URL || env.DIRECT_URL, "DIRECT_URL"),
    baseUrl: baseUrl.toString().replace(/\/$/, ""),
  };
}

export function resolveExpectedDatabaseUrl(config) {
  const database = new URL(config.databaseUrl);
  if (config.runtimeMode === "isolated-local-docker") {
    if (!config.localDockerVerified || !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) || database.port !== "54322" || database.protocol !== "postgresql:" || database.pathname !== "/postgres" || database.search || database.hash || !database.password || !["postgres", "supabase_admin"].includes(database.username)) throw new Error("Local database verification missing");
    return database.toString();
  }
  if (database.protocol !== "postgresql:" || database.port !== "5432" || database.pathname !== "/postgres"
      || database.hash !== "" || !database.password) throw new Error("DIRECT_URL must use the exact PostgreSQL endpoint shape");
  const queryKeys = [...new Set([...database.searchParams.keys()])];
  if (queryKeys.some((key) => key !== "sslmode") || (database.searchParams.has("sslmode") && database.searchParams.get("sslmode") !== "require")) {
    throw new Error("DIRECT_URL contains an unsupported query option");
  }
  const directHost = `db.${config.projectRef}.supabase.co`;
  const poolerHost = `aws-0-${config.region}.pooler.supabase.com`;
  if (database.hostname === directHost && database.username === "postgres") {
    database.hostname = poolerHost;
    database.port = "5432";
    database.username = `postgres.${config.projectRef}`;
    database.searchParams.set("sslmode", "require");
    return database.toString();
  }
  if (database.hostname === poolerHost && database.username === `postgres.${config.projectRef}`) {
    database.searchParams.set("sslmode", "require");
    return database.toString();
  }
  throw new Error("Database URL does not match the declared non-production Supabase project");
}

export async function loadSafeConfiguration(root) {
  const envSource = await readFile(resolve(root, ".env.local"), "utf8");
  const env = { ...parseEnv(envSource), ...process.env };
  if (env.E2E_LOCAL_ISOLATED === "1") {
    const source = await readFile(resolve(root, "supabase", "config.toml"), "utf8");
    const projectId = /^project_id\s*=\s*"([A-Za-z0-9_-]+)"/m.exec(source)?.[1];
    return verifyLocalDockerConfiguration(env, projectId);
  }
  const metadata = JSON.parse(await readFile(resolve(root, "supabase", "project-metadata.json"), "utf8"));
  return assertSafeEnvironment(env, metadata);
}
