import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const root = resolve(import.meta.dirname, "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split(/\r?\n/u)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^(['"])(.*)\1$/u, "$2")];
    }),
);
if (env.APP_ENV === "production") {
  console.error("FAIL refused in production");
  process.exit(1);
}
const databaseUrl = (env.SUPABASE_DB_POOLER_URL || env.DIRECT_URL || "").trim();
if (!databaseUrl) {
  console.error("FAIL missing DIRECT_URL");
  process.exit(1);
}
const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 20 });
try {
  const ddl = readFileSync(
    resolve(root, "supabase/migrations/20261118160100_ensure_demo_admin_platform_role_v1.sql"),
    "utf8",
  );
  await sql.unsafe(ddl);
  console.log("PASS ensure_demo_admin_platform_role_v1 applied");
} finally {
  await sql.end({ timeout: 5 });
}
