/**
 * Local authenticated smoke for admin film S1–S6.
 * Creates a real GoTrue admin + TOTP AAL2, visits film routes FR/AR @ 360px, cleans up.
 */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { openSync, closeSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { totp } from "../../../scripts/p05-e2e/totp.mjs";

process.umask(0o077);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(resolve(root, "package.json"));
const webRequire = createRequire(resolve(root, "apps/web/package.json"));
const { createClient } = webRequire("@supabase/supabase-js");
const { createServerClient } = webRequire("@supabase/ssr");
const { chromium } = require("@playwright/test");
const postgres = require("postgres");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const dbUrl = process.env.DIRECT_URL || process.env.DB_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:5187";
const listenPort = new URL(baseUrl).port || "5187";
if (!publishableKey || !serviceRoleKey) throw new Error("LOCAL_SUPABASE_KEYS_REQUIRED");

const runId = randomUUID();
const directory = resolve(root, "work/admin-film-s1-s6", runId);
await mkdir(directory, { recursive: true });

const routes = [
  { id: "S1", path: "administration/command-center", expect: /Administration|إدارة/i },
  { id: "S1b", path: "administration/preparation", expect: /Préparation|تجهيز|Étape 1/i },
  { id: "S2", path: "administration/candidatures-franchise", expect: /Candidat|ترشيح|Franchise|امتياز|Étape 2/i },
  { id: "S3", path: "administration/invitations-reseau", expect: /Invitation|دعوة|réseau|شبكة|Étape 3/i },
  { id: "S4", path: "administration/entreprises", expect: /Organisation|مؤسس|Entreprise|Étape 4|Inscription/i },
  { id: "S5", path: "administration/conformite-clients", expect: /Conformit|امتثال|Étape 5|Confirmation/i },
  { id: "S6a", path: "administration/diagnostics", expect: /Diagnostic|تشخيص|Besoin|حاجة|Étape 6|Commerce|تجار/i },
  { id: "S6b", path: "administration/matching", expect: /relation|ربط|Matching|Étape 7|Commerce|تجار/i },
  { id: "S6c", path: "administration/finance", expect: /Finance|مال|Paiement|دفع|Étape 11|Argent/i },
];

const proof = {
  scope: "LOCAL_ADMIN_FILM_S1_S6",
  runId,
  status: "RUNNING",
  checks: [],
  failures: [],
};
const users = [];
let server;
let browser;
const db = postgres(dbUrl, { ssl: false, max: 1, onnotice: () => {} });
const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

function record(code, details = {}) {
  proof.checks.push({ code, status: "PASS", ...details });
  console.log(JSON.stringify({ code, status: "PASS", ...details }));
}
function fail(code, details = {}) {
  proof.failures.push({ code, ...details });
  console.log(JSON.stringify({ code, status: "FAIL", ...details }));
}
function check(value, code) {
  if (!value) throw new Error(code);
}

async function actor() {
  const email = `film-s1s6-${runId}@example.invalid`;
  const created = await service.auth.admin.createUser({ email, email_confirm: true, app_metadata: { admin_film_fixture: runId } });
  check(!created.error && created.data.user, "FIXTURE_USER_CREATION_FAILED");
  const userId = created.data.user.id;
  users.push(userId);
  const link = await service.auth.admin.generateLink({ type: "magiclink", email });
  check(!link.error, "FIXTURE_LINK_FAILED");
  const client = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token });
  check(!login.error, "FIXTURE_NATIVE_LOGIN_FAILED");
  const factor = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "Admin film S1-S6" });
  check(!factor.error, "FIXTURE_MFA_ENROLL_FAILED");
  let verified = false;
  for (const offset of [0, -30000, 30000]) {
    if (!(await client.auth.mfa.challengeAndVerify({ factorId: factor.data.id, code: totp(factor.data.totp.secret, Date.now() + offset) })).error) {
      verified = true;
      break;
    }
  }
  check(verified, "FIXTURE_MFA_VERIFY_FAILED");
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  check(assurance.data?.currentLevel === "aal2", "FIXTURE_ASSURANCE_LEVEL_WRONG");
  return { client, userId, email };
}

async function contextFor(person, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
  const bag = new Map();
  const ssr = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll: () => [...bag.values()],
      setAll: (items) => items.forEach((item) => bag.set(item.name, item)),
    },
  });
  const session = await person.client.auth.getSession();
  check(!(await ssr.auth.setSession(session.data.session)).error, "FIXTURE_SSR_SESSION_FAILED");
  await context.addCookies(
    [...bag.values()].map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: baseUrl,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    })),
  );
  return { context };
}

async function spawnDevServer() {
  const logFd = openSync(resolve(directory, "server.private.log"), "a", 0o600);
  // Local film smoke uses `next dev` so it does not depend on a green production typecheck.
  const child = spawn(
    process.execPath,
    [resolve(root, "apps/web/node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", listenPort],
    {
      cwd: resolve(root, "apps/web"),
      env: {
        ...process.env,
        APP_ENV: "development",
        MATRICIA_DEMO_ACCESS_ENABLED: process.env.MATRICIA_DEMO_ACCESS_ENABLED || "1",
        NEXT_PUBLIC_APP_URL: baseUrl,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
        NEXT_TELEMETRY_DISABLED: "1",
        // Skip the interactive Next security upgrade pause that exits the first `next` spawn.
        NEXT_DISABLE_SECURITY_ADVISORY: "1",
        CI: "1",
        PORT: listenPort,
      },
      stdio: ["ignore", logFd, logFd],
    },
  );
  closeSync(logFd);
  return child;
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) return false;
    try {
      const result = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(1500) });
      await result.body?.cancel();
      if (result.ok) {
        await delay(300);
        return child.exitCode === null;
      }
    } catch {}
    await delay(500);
  }
  return false;
}

async function clearDevLock() {
  try {
    const { unlinkSync, existsSync } = await import("node:fs");
    const lockPath = resolve(root, "apps/web/.next/dev/lock");
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {}
}

async function startServer() {
  if (process.env.E2E_REUSE_SERVER === "1") {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const result = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(1500) });
        await result.body?.cancel();
        if (result.ok) return;
      } catch {}
      await delay(500);
    }
    throw new Error("REUSED_SERVER_NOT_READY");
  }
  // First Next spawn can exit solely to show the security upgrade nudge; retry once.
  for (let spawnAttempt = 0; spawnAttempt < 4; spawnAttempt++) {
    await clearDevLock();
    server = await spawnDevServer();
    const ready = await waitForServer(server);
    if (ready) return;
    try {
      if (server.exitCode === null) {
        server.kill("SIGTERM");
        await delay(1000);
        if (server.exitCode === null) server.kill("SIGKILL");
      }
    } catch {}
    await delay(500);
  }
  throw new Error("OWNED_SERVER_NOT_READY");
}

try {
  const admin = await actor();
  await db`insert into public.platform_user_roles(user_id, role_code) values (${admin.userId}::uuid, 'MATRICIA_ADMIN'), (${admin.userId}::uuid, 'SUPER_ADMIN') on conflict do nothing`;
  record("ADMIN_AAL2_READY");

  await startServer();
  browser = await chromium.launch();
  record("SERVER_READY");

  for (const locale of ["fr", "ar"]) {
    const { context } = await contextFor(admin, 360);
    for (const route of routes) {
      const url = `${baseUrl}/${locale}/${route.path}`;
      // Fresh page per route so Turbopack HMR from a prior screen cannot abort navigation.
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      try {
        if (server && server.exitCode !== null) await startServer();
        let navigated = false;
        for (let attempt = 0; attempt < 2 && !navigated; attempt++) {
          try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
            navigated = true;
          } catch (navigationError) {
            if (attempt === 1) throw navigationError;
            await delay(750);
          }
        }
        await page.waitForFunction(
          (patternSource) => {
            const body = document.body?.innerText ?? "";
            const mains = document.querySelectorAll("main").length;
            const crashed = /Application error|Internal Server Error|Unhandled Runtime Error/i.test(body);
            const loadingOnly = /Chargement administration|جاري تحميل الإدارة/i.test(body) && !new RegExp(patternSource, "i").test(body);
            return !crashed && !loadingOnly && mains === 1 && new RegExp(patternSource, "i").test(body);
          },
          route.expect.source,
          { timeout: 45000 },
        ).catch(() => {});
        const pathname = new URL(page.url()).pathname;
        const body = await page.locator("body").innerText();
        const mains = await page.locator("main").count();
        const crashed = /Application error|Internal Server Error|Unhandled Runtime Error/i.test(body);
        const redirectedAway = !pathname.includes(`/administration/`);
        if (crashed || redirectedAway || mains !== 1 || !route.expect.test(body)) {
          fail("ROUTE_SMOKE_FAILED", {
            locale,
            route: route.id,
            path: route.path,
            pathname,
            mains,
            crashed,
            redirectedAway,
            bodySnippet: body.replace(/\s+/g, " ").slice(0, 180),
          });
          await page.screenshot({ path: resolve(directory, `${locale}-${route.id}.png`), fullPage: true }).catch(() => {});
        } else {
          record("ROUTE_SMOKE_PASS", { locale, route: route.id, path: route.path, mains });
        }
      } catch (navigationError) {
        fail("ROUTE_NAVIGATION_FAILED", {
          locale,
          route: route.id,
          path: route.path,
          message: navigationError.message?.slice(0, 240),
        });
        await page.screenshot({ path: resolve(directory, `${locale}-${route.id}.png`), fullPage: true }).catch(() => {});
      } finally {
        await page.close().catch(() => {});
      }
    }
    await context.close();
  }

  proof.status = proof.failures.length ? "FAILED" : "PASSED";
} catch (error) {
  proof.status = "FAILED";
  proof.failure = /^[A-Z][A-Z0-9_]{2,120}$/.test(error.message) ? error.message : "ADMIN_FILM_SMOKE_UNEXPECTED_ERROR";
  console.error(JSON.stringify({ status: "FAILED", failure: proof.failure, message: error.message }));
} finally {
  try {
    if (browser) await browser.close();
  } catch {}
  try {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await delay(2000);
      if (server.exitCode === null) server.kill("SIGKILL");
    }
  } catch {}
  try {
    if (users.length) {
      await db`delete from public.platform_user_roles where user_id = any(${users}::uuid[])`;
      for (const userId of users) {
        const factors = await service.auth.admin.mfa.listFactors({ userId });
        if (!factors.error) {
          for (const factor of factors.data.factors ?? []) {
            await service.auth.admin.mfa.deleteFactor({ userId, id: factor.id });
          }
        }
        await service.auth.admin.deleteUser(userId, true);
      }
    }
  } catch (cleanupError) {
    proof.cleanupError = cleanupError.message;
  }
  try {
    await db.end();
  } catch {}
  await writeFile(resolve(directory, "summary.json"), `${JSON.stringify(proof, null, 2)}\n`);
  console.log(
    JSON.stringify({
      status: proof.status,
      passed: proof.checks.filter((c) => c.status === "PASS").length,
      failed: proof.failures.length,
      summary: resolve(directory, "summary.json"),
    }),
  );
  if (proof.status !== "PASSED") process.exitCode = 1;
}
