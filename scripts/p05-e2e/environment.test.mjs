import assert from "node:assert/strict";
import test from "node:test";
import { assertSafeEnvironment, localStatusEnvironment, parseEnv, resolveExpectedDatabaseUrl } from "./environment.mjs";

const metadata = { project_ref: "abcdefghijklmnopqrst", region: "us-west-2", environment: "development" };
const env = {
  APP_ENV: "development",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-test-key",
  DIRECT_URL: "postgresql://postgres:password@db.abcdefghijklmnopqrst.supabase.co:5432/postgres",
  NEXT_PUBLIC_APP_URL: "http://localhost:5173",
};

test("parses quoted environment values without evaluating content", () => {
  assert.deepEqual(parseEnv("A='value'\nB=plain\n# C=hidden\n"), { A: "value", B: "plain" });
});

test("accepts the exact development project and rewrites its direct database endpoint", () => {
  const config = assertSafeEnvironment(env, metadata);
  const database = new URL(resolveExpectedDatabaseUrl(config));
  assert.equal(database.hostname, "aws-0-us-west-2.pooler.supabase.com");
  assert.equal(database.username, "postgres.abcdefghijklmnopqrst");
});

test("rejects production and mismatched Supabase projects", () => {
  assert.throws(() => assertSafeEnvironment({ ...env, APP_ENV: "production" }, { ...metadata, environment: "production" }), /restricted/);
  assert.throws(() => assertSafeEnvironment({ ...env, NEXT_PUBLIC_SUPABASE_URL: "https://different-project.supabase.co" }, metadata), /does not match/);
});

test("rejects a non-local application endpoint", () => {
  assert.throws(() => assertSafeEnvironment({ ...env, E2E_BASE_URL: "https://app.example.com" }, metadata), /exact local HTTP/);
  assert.throws(() => assertSafeEnvironment({ ...env, E2E_BASE_URL: "http://localhost:5173/?token=x" }, metadata), /exact local HTTP/);
  assert.throws(() => assertSafeEnvironment({ ...env, E2E_BASE_URL: "http://user@localhost:5173" }, metadata), /exact local HTTP/);
});

test("rejects URL ports, credentials, query and hash outside the exact allowlist", () => {
  assert.throws(() => assertSafeEnvironment({ ...env, NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co:444/" }, metadata), /does not match/);
  const config = assertSafeEnvironment(env, metadata);
  for (const databaseUrl of [
    "postgresql://other:password@db.abcdefghijklmnopqrst.supabase.co:5432/postgres",
    "postgresql://postgres:password@db.abcdefghijklmnopqrst.supabase.co:6543/postgres",
    "postgresql://postgres:password@db.abcdefghijklmnopqrst.supabase.co:5432/other",
    "postgresql://postgres:password@db.abcdefghijklmnopqrst.supabase.co:5432/postgres?application_name=x",
    "postgresql://postgres:password@db.abcdefghijklmnopqrst.supabase.co:5432/postgres#fragment",
  ]) assert.throws(() => resolveExpectedDatabaseUrl({ ...config, databaseUrl }));
});

import { validateLocalConfiguration } from './local-environment.mjs';
const localEnv = { ...env, E2E_LOCAL_ISOLATED:'1', E2E_LOCAL_PROJECT_ID:'Matricia', NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321', DIRECT_URL:'postgresql://postgres:synthetic@127.0.0.1:54322/postgres' };
const docker = Object.fromEntries(['db','kong','auth','storage'].map(role => [role, { running:true, totpEnrollment:true, totpVerification:true, project:'Matricia', composeProject:'Matricia', image:'ghcr.io/supabase/test:1', ports: { '5432/tcp':[{HostPort:'54322'}], '8000/tcp':[{HostPort:'54321'}] } }]));

test('CLI local configuration cannot fall back to hosted credentials', () => {
  const status = { API_URL:'http://127.0.0.1:54321', DB_URL:localEnv.DIRECT_URL, ANON_KEY:'local-anon', SERVICE_ROLE_KEY:'local-service' };
  const selected = localStatusEnvironment({...localEnv, SUPABASE_DB_POOLER_URL:env.DIRECT_URL}, status);
  assert.equal(selected.SUPABASE_DB_POOLER_URL, '');
  assert.equal(selected.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'local-anon');
  assert.equal(validateLocalConfiguration(selected, 'Matricia', docker).serviceRoleKey, 'local-service');
  assert.throws(() => validateLocalConfiguration(localStatusEnvironment(localEnv, {}), 'Matricia', docker));
  assert.throws(() => validateLocalConfiguration(localStatusEnvironment(localEnv, {...status, DB_URL:env.DIRECT_URL}), 'Matricia', docker));
});
test('explicit local Docker configuration cannot be mistaken for hosted staging evidence', () => {
  const config = validateLocalConfiguration(localEnv, 'Matricia', docker);
  assert.equal(config.environment, 'development');
  assert.equal(config.runtimeMode, 'isolated-local-docker');
  assert.equal(resolveExpectedDatabaseUrl(config), localEnv.DIRECT_URL);
  assert.throws(() => assertSafeEnvironment(localEnv, metadata), /does not match/);
});
test('local mode rejects production, hosted API/database, wrong project and hosted pooler', () => {
  for (const overrides of [{APP_ENV:'production'}, {APP_ENV:'staging'}, {E2E_LOCAL_ISOLATED:''}, {E2E_LOCAL_PROJECT_ID:'other'}, {NEXT_PUBLIC_SUPABASE_URL:env.NEXT_PUBLIC_SUPABASE_URL}, {DIRECT_URL:env.DIRECT_URL}, {SUPABASE_DB_POOLER_URL:env.DIRECT_URL}, {NEXT_PUBLIC_APP_URL:'https://example.invalid'}]) assert.throws(() => validateLocalConfiguration({...localEnv,...overrides}, 'Matricia', docker));
});
test('local mode rejects stopped or differently labelled Docker services and wrong bindings', () => {
  for (const overrides of [{running:false}, {project:'different'}, {composeProject:'different'}, {image:'custom/database'}, {ports:{}}]) assert.throws(() => validateLocalConfiguration(localEnv, 'Matricia', {...docker,db:{...docker.db,...overrides}}));
  assert.throws(() => validateLocalConfiguration(localEnv, 'Matricia', {...docker,auth:undefined}));
  assert.throws(() => resolveExpectedDatabaseUrl({...validateLocalConfiguration(localEnv,'Matricia',docker),localDockerVerified:false}));
});

test('local mode refuses disabled TOTP before creating any identity', () => {
  for (const key of ['totpEnrollment','totpVerification']) assert.throws(() => validateLocalConfiguration(localEnv,'Matricia',{...docker,auth:{...docker.auth,[key]:false}}),/LOCAL_TOTP_DISABLED/);
});

test('local mode accepts official ECR images while retaining identity guards', () => {
  const ecr = Object.fromEntries(Object.entries(docker).map(([role, container]) => [role, {...container, image: container.image.replace('ghcr.io/', 'public.ecr.aws/')} ]));
  assert.equal(validateLocalConfiguration(localEnv, 'Matricia', ecr).localDockerVerified, true);
  for (const role of Object.keys(ecr)) {
    for (const override of [{project:'other'}, {composeProject:'other'}, {running:false}, {image:'public.ecr.aws/supabase-impostor/postgres:17'}, {image:'public.ecr.aws.attacker.invalid/supabase/postgres:17'}]) {
      assert.throws(() => validateLocalConfiguration(localEnv, 'Matricia', {...ecr, [role]: {...ecr[role], ...override}}), /Docker identity/);
    }
  }
});
