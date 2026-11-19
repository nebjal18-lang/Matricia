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

const databaseUrl = (env.SUPABASE_DB_POOLER_URL || env.DIRECT_URL || "").trim();
if (!databaseUrl) {
  console.error("FAIL missing DIRECT_URL");
  process.exit(1);
}
if (env.APP_ENV === "production") {
  console.error("FAIL refused in production");
  process.exit(1);
}

const email = (env.MATRICIA_DEMO_ADMIN_EMAIL || "demo.admin@matricia.test").trim().toLowerCase();
const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 20 });

try {
  const users = await sql`
    select id
    from auth.users
    where lower(email) = ${email}
      and deleted_at is null
    limit 1
  `;
  if (!users.length) {
    console.error("FAIL admin user missing");
    process.exit(2);
  }
  const userId = users[0].id;
  await sql`
    insert into public.platform_user_roles(user_id, role_code, granted_by, revoked_at)
    values (${userId}::uuid, 'MATRICIA_ADMIN', ${userId}::uuid, null)
    on conflict (user_id, role_code) do update
      set granted_by = excluded.granted_by,
          granted_at = clock_timestamp(),
          revoked_at = null
  `;
  const check = await sql`
    select role_code
    from public.platform_user_roles
    where user_id = ${userId}::uuid
      and role_code = 'MATRICIA_ADMIN'
      and revoked_at is null
  `;
  if (!check.length) {
    console.error("FAIL role not active");
    process.exit(4);
  }
  console.log("PASS demo admin platform role active");
} finally {
  await sql.end({ timeout: 5 });
}
