import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { prepareSqlTest } from "../db-test-support.mjs";

// Explicit local disposable container only; this never accepts a database URL,
// reads a secret, reaches YouSign, or mutates a hosted Supabase project.
const container = process.argv[2];
if (!container || !/^supabase_db_MatriciaV1Closure[0-9]+$/u.test(container)) throw new Error("EXPLICIT_DISPOSABLE_DATABASE_CONTAINER_REQUIRED");
const root = new URL("../../", import.meta.url);
const migration = readFileSync(new URL("supabase/migrations/20261109100000_yousign_sandbox_transport.sql", root), "utf8").replace(/^begin;/u, "").replace(/commit;\s*$/u, "");
const command = ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"];
const probe = spawnSync("docker", command, { input: "select to_regclass('private.yousign_requests_v1') is not null;", encoding: "utf8", maxBuffer: 1024 * 1024 });
if (probe.error || probe.status !== 0 || !["t", "f"].includes(probe.stdout.trim())) throw new Error("DISPOSABLE_DATABASE_UNAVAILABLE");
const fixture = prepareSqlTest(readFileSync(new URL("supabase/tests/0241_signature_canonical_source_archives.test.sql", root), "utf8")).replace(/^begin;/u, "").replace(/select\s*\*\s*from\s+finish\(\);\s*rollback;\s*$/iu, "");
const cases = readFileSync(new URL("supabase/tests/helpers/yousign-transport-acceptance.sql", root), "utf8");
if (/\b(?:begin|commit|rollback)\s*;/iu.test(fixture.replace(/\$\$[\s\S]*?\$\$/gu, ""))) throw new Error("FIXTURE_TRANSACTION_SHAPE_CHANGED");
const sql = `begin;\n${probe.stdout.trim() === "t" ? "" : migration}\n${fixture}\n${cases}\nselect * from finish();\nrollback;\n`;
const result = spawnSync("docker", command, { input: sql, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
process.stdout.write(output.split("\n").filter(line => /^(?:not ok|ok |1\.\.|#)|ERROR:|CONTEXT:/.test(line)).join("\n") + "\n");
if (result.error || result.status !== 0 || /^not ok\b/mu.test(output) || !/^1\.\.[1-9][0-9]*$/mu.test(output)) process.exitCode = 1;
