import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { prepareSqlTest } from "../db-test-support.mjs";

// Explicit local disposable resources only. Never accepts a URL, provider key,
// public database, hosted target or persistent migration. Every fixture rolls back.
const [container, database] = process.argv.slice(2);
if (!container || !/^supabase_db_MatriciaV1Closure[0-9]+$/u.test(container)
  || !database || !/^matricia_[a-z0-9_]*validation_[0-9]{8}$/u.test(database)) throw new Error("EXPLICIT_DISPOSABLE_SIGNATURE_VALIDATION_REQUIRED");
const root = new URL("../../", import.meta.url);
const command = ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"];
const probe = spawnSync("docker", command, {input: "select (to_regclass('private.yousign_requests_v1') is not null)::text||'|'||(select count(*)=0 from public.signature_provider_configs where provider_code='YOUSIGN')::text;", encoding: "utf8", maxBuffer: 1024 * 1024});
if (probe.error || probe.status !== 0 || probe.stdout.trim() !== "true|true") throw new Error("EMPTY_OWNED_NATIVE_SIGNATURE_VALIDATION_REQUIRED");
const configurationInstalled = spawnSync("docker", command, {input: "select (to_regclass('private.admin_configuration_revisions_v1') is not null)::text||'|'||(to_regprocedure('public.get_yousign_runtime_environment_v1()') is not null)::text;", encoding: "utf8", maxBuffer: 1024 * 1024});
if (configurationInstalled.error || configurationInstalled.status !== 0 || !/^(?:true|false)\|(?:true|false)$/u.test(configurationInstalled.stdout.trim())) throw new Error("OWNED_CONFIGURATION_DATABASE_REQUIRED");
const migration = [configurationInstalled.stdout.trim().startsWith("false|") ? "20261109110000_admin_configuration_onboarding.sql" : null, configurationInstalled.stdout.trim().endsWith("|false") ? "20261109111000_yousign_governed_live_transport.sql" : null].filter(Boolean).map(name => readFileSync(new URL(`supabase/migrations/${name}`, root), "utf8").replace(/^begin;/u, "").replace(/commit;\s*$/u, "")).join("\n");
const fixture = prepareSqlTest(readFileSync(new URL("supabase/tests/0241_signature_canonical_source_archives.test.sql", root), "utf8")).replace(/^begin;/u, "").replace(/select\s*\*\s*from\s+finish\(\);\s*rollback;\s*$/iu, "");
const native = readFileSync(new URL("supabase/tests/helpers/yousign-transport-acceptance.sql", root), "utf8")
  .replaceAll("'DEVELOPMENT'", "'PRODUCTION'").replaceAll("https://api-sandbox.yousign.app/v3", "https://api.yousign.app/v3");
const additional = `
select ok((private.require_yousign_envelope_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'))).id is not null,'synthetic live policy retains all exact native evidence bindings');
update private.admin_execution_environment_v1 set environment='STAGING' where singleton;
select throws_ok($$select private.require_yousign_envelope_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'))$$,'55000','YOUSIGN_GOVERNED_PROVIDER_POLICY_REQUIRED','live source cannot be dispatched from a trusted staging deployment');
update private.admin_execution_environment_v1 set environment='PRODUCTION' where singleton;
select throws_ok($$select private.require_signature_environment_v1('PRODUCTION','MATRICIA_DEV_MOCK')$$,'42501','SIGNATURE_DEPLOYMENT_ENVIRONMENT_MISMATCH','enabling live support never enables production development mocks');
select throws_ok($$update public.signature_provider_configs set endpoint_base_url='https://api-sandbox.yousign.app/v3' where provider_code='YOUSIGN'$$,'55000',null,'fixed live provider registration cannot be silently rewritten');
insert into private.admin_configuration_revisions_v1(id,environment,section,settings,encrypted_secrets,secret_keys,content_hash,status,created_by,approved_by,approved_at)
values('ab930000-0000-4000-8000-000000000001','PRODUCTION','YOUSIGN','{"YOUSIGN_ENVIRONMENT":"live"}','v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Q0lQSEVSVEVYVA',array['YOUSIGN_API_KEY','YOUSIGN_WEBHOOK_SECRET'],repeat('9',64),'ACTIVE','a2200000-0000-4000-8000-000000000002','f2120000-0000-4000-8000-000000000002',clock_timestamp());
select throws_ok($$select private.require_yousign_envelope_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'))$$,'55000','YOUSIGN_ACTIVE_CONFIGURATION_REQUIRED','previously admitted native source cannot use a newly activated account revision');
update private.admin_configuration_revisions_v1 set status='RETIRED',retired_at=clock_timestamp() where id='ab930000-0000-4000-8000-000000000001';
select throws_ok($$select private.require_yousign_envelope_v1((select(v->>'envelope_id')::uuid from y391 where k='envelope'))$$,'55000','YOUSIGN_ACTIVE_CONFIGURATION_REQUIRED','deactivation never falls back to an old provider attestation or legacy key');

`;
const sql = `begin;\n${migration}\n${fixture}\nupdate private.admin_execution_environment_v1 set environment='PRODUCTION' where singleton;\n${native}\n${additional}\nselect * from finish();\nrollback;\n`;
const result = spawnSync("docker", command, {input: sql, encoding: "utf8", maxBuffer: 12 * 1024 * 1024});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
process.stdout.write(output.split("\n").filter(line => /^(?:not ok|ok |1\.\.|#)|ERROR:|CONTEXT:/.test(line)).join("\n") + "\n");
if (result.error || result.status !== 0 || /^not ok\b/mu.test(output) || !/^1\.\.[1-9][0-9]*$/mu.test(output)) process.exitCode = 1;
