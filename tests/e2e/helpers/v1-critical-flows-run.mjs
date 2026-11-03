import { runSecuredBrowserSuite, writeLocalSuiteEvidence } from "./secured-browser-runner.mjs";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSafeConfiguration } from "../../../scripts/p05-e2e/environment.mjs";
import { provision } from "../../../scripts/p05-e2e/provision.mjs";
import { buildChildEnvironment, secureLocalPaths, sha256File, validateFreshManifest } from "../../../scripts/p05-e2e/security.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const runToken = randomUUID();
const output = resolve(root, "artifacts", "test-results", `v1-critical-flows-${runToken}`);
const authSnapshotDirectory = resolve(root, "artifacts", "test-results", `.v1-critical-auth-${runToken}`);
let fixture;
let failure;
let config;
let suiteSummary;
let cleanupFailed=false;

try {
  fixture = await provision();
  config = await loadSafeConfiguration(root);
  await validateFreshManifest(fixture.manifest, config);
  await mkdir(authSnapshotDirectory, { recursive: false, mode: 0o700 });
  await secureLocalPaths(authSnapshotDirectory, []);
  const states = {};
  for (const [key, state] of Object.entries(fixture.manifest.states)) {
    const path = resolve(authSnapshotDirectory, `${key}.json`);
    await copyFile(state.path, path);
    await secureLocalPaths(authSnapshotDirectory, [path]);
    states[key] = { path, sha256: await sha256File(path) };
  }
  const manifestPath = resolve(authSnapshotDirectory, "manifest.json");
  const manifest = { ...fixture.manifest, states };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await secureLocalPaths(authSnapshotDirectory, [manifestPath]);
  await validateFreshManifest(manifest, config);
  const environment = buildChildEnvironment(process.env, {
    E2E_BASE_URL: config.baseUrl,
    E2E_P05_MANIFEST: manifestPath,
    E2E_CLIENT_STORAGE_STATE: manifest.states.clientA.path,
    E2E_ADMIN_STORAGE_STATE: manifest.states.centralAal2.path,
    E2E_CLIENT_B_STORAGE_STATE: manifest.states.clientB.path,
    E2E_COMPLIANCE_STORAGE_STATE: manifest.states.centralAal2.path,
    E2E_COMPLIANCE_AAL1_STORAGE_STATE: manifest.states.centralAal1.path,
    E2E_NO_ROLE_STORAGE_STATE: manifest.states.noRole.path,
  });
  suiteSummary = await runSecuredBrowserSuite({root,config,environment,specifications:["tests/e2e/v1-critical-flows.spec.ts","tests/e2e/p20-admin-diagnostics-authenticated.spec.ts"],output,expectedTests:24});
  console.log("PASS V1 critical-flow E2E suite");
} catch (error) {
  failure = error; suiteSummary ??= error.browserSummary;
} finally {
  if (fixture) {
    try {
      await fixture.cleanup();
      if (fixture.resources.retainedEvidence <= 0) throw new Error("Immutable fixture evidence was not retained");
      console.log("PASS V1 critical-flow remote fixture neutralized");
    } catch (error) {
      cleanupFailed=true; failure = failure
        ? new AggregateError([failure, error], "V1 critical-flow run and cleanup failed")
        : error;
    }
    try {
      const fixtureAuthDirectory = resolve(dirname(fixture.manifestPath));
      const expectedFixtureAuthDirectory = resolve(root, "scripts", "p05-e2e", ".auth");
      if (fixtureAuthDirectory !== expectedFixtureAuthDirectory) throw new Error("Refusing to remove an unverified P05 auth directory");
      await rm(fixtureAuthDirectory, { recursive: true, force: true });
    } catch (error) {
      cleanupFailed=true; failure = failure
        ? new AggregateError([failure, error], "V1 critical-flow run and local auth cleanup failed")
        : error;
    }
  }
  try { await rm(output, { recursive: true, force: true }); }
  catch (error) { cleanupFailed=true; failure ??= error; }
  try { await rm(authSnapshotDirectory, { recursive: true, force: true }); }
  catch (error) { cleanupFailed=true; failure ??= error; }
}

await writeLocalSuiteEvidence({root,suite:"v1-critical",config,summary:suiteSummary,failure,cleanupVerified:!cleanupFailed});
if (failure) {
  console.error("FAIL V1 critical-flow E2E execution failed; no credential or remote detail was printed");
  process.exitCode = 1;
}
