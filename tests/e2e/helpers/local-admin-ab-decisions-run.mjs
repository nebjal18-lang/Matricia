import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { provision, elevateToAal2, toPlaywrightState } from "../../../scripts/p05-e2e/provision.mjs";
import { loadSafeConfiguration } from "../../../scripts/p05-e2e/environment.mjs";
import { buildChildEnvironment, validateFreshManifest } from "../../../scripts/p05-e2e/security.mjs";
import { runSecuredBrowserSuite, writeLocalSuiteEvidence } from "./secured-browser-runner.mjs";

const root = process.cwd();
const directory = resolve(root, "artifacts/test-results", `.local-admin-ab-${randomUUID()}`);
let config, fixture, summary, failure, proof, stage = "configuration", cleanupVerified = true;
const actionIds = [];

async function rpc(client, name, input) {
  const result = await client.rpc(name, input);
  assert.equal(result.error, null, `ADMIN_${name.toUpperCase()}_FAILED`);
  return result.data;
}

try {
  config = await loadSafeConfiguration(root);
  assert.equal(config.runtimeMode, "isolated-local-docker");
  assert.equal(config.localDockerVerified, true);
  stage = "fixture";
  fixture = await provision();
  await validateFreshManifest(fixture.manifest, config);

  const db = fixture.resources.database;
  const requester = fixture.sessions.central.client;
  const validator = fixture.sessions.noRole;
  const requesterId = fixture.resources.userIds[2];
  const validatorId = fixture.resources.userIds[3];
  const org = fixture.manifest.fixtures.organizationA.id;

  await db`insert into public.platform_user_roles(user_id, role_code, granted_by)
    values (${requesterId}::uuid, 'MATRICIA_ADMIN', null), (${validatorId}::uuid, 'MATRICIA_ADMIN', null)
    on conflict do nothing`;
  await elevateToAal2(validator);

  const hash = (seed) => createHash("sha256").update(seed).digest("hex");
  const labelA = `Lot1-A ${fixture.manifest.runId.slice(0, 8)}`;
  const labelB = `Lot1-B ${fixture.manifest.runId.slice(0, 8)}`;
  const resourceA = `lot1-resource-A-${fixture.manifest.runId.slice(0, 8)}`;
  const resourceB = `lot1-resource-B-${fixture.manifest.runId.slice(0, 8)}`;

  stage = "seed-requests";
  const reqA = await rpc(requester, "request_admin_operational_action", {
    p_work_item_id: null,
    p_organization_id: org,
    p_action_type: "ASSIGN_CASE",
    p_target_environment: "DEVELOPMENT",
    p_resource_type: "organization",
    p_resource_id: resourceA,
    p_request_payload_hash: hash(`A:${resourceA}`),
    p_redacted_summary: { label: "A", title: labelA },
    p_reason: `Lot1 request A pending independent validation ${labelA}`,
    p_production_authorization_reference: null,
    p_support_user_id: null,
    p_support_access_mode: null,
    p_support_expires_at: null,
    p_idempotency_key: randomUUID(),
  });
  const reqB = await rpc(requester, "request_admin_operational_action", {
    p_work_item_id: null,
    p_organization_id: org,
    p_action_type: "ASSIGN_CASE",
    p_target_environment: "DEVELOPMENT",
    p_resource_type: "organization",
    p_resource_id: resourceB,
    p_request_payload_hash: hash(`B:${resourceB}`),
    p_redacted_summary: { label: "B", title: labelB },
    p_reason: `Lot1 request B pending independent validation ${labelB}`,
    p_production_authorization_reference: null,
    p_support_user_id: null,
    p_support_access_mode: null,
    p_support_expires_at: null,
    p_idempotency_key: randomUUID(),
  });
  actionIds.push(reqA.action_request_id, reqB.action_request_id);

  stage = "refused-rpc";
  const selfDeny = await requester.rpc("decide_admin_operational_action", {
    p_action_request_id: reqB.action_request_id,
    p_decision: "APPROVE",
    p_reason: "Self approve must stay denied",
    p_expected_row_version: 1,
    p_idempotency_key: randomUUID(),
  });
  assert.equal(selfDeny.error?.code, "42501");
  const synthDeny = await requester.rpc("decide_admin_operational_action", {
    p_action_request_id: "72afb969-56bf-407d-89b9-11405d862e2d",
    p_decision: "APPROVE",
    p_reason: "Demo synthetic id must stay denied",
    p_expected_row_version: 1,
    p_idempotency_key: randomUUID(),
  });
  assert.equal(synthDeny.error?.code, "42501");

  const before = await db`
    select id::text, status, requested_by::text, resource_id
    from public.admin_operational_action_requests
    where id in (${reqA.action_request_id}::uuid, ${reqB.action_request_id}::uuid)
    order by resource_id`;
  assert.equal(before.length, 2);
  assert.ok(before.every((row) => row.status === "PENDING_APPROVAL"));
  const decisionsBefore = await db`
    select count(*)::int as count from public.admin_operational_action_decisions
    where action_request_id in (${reqA.action_request_id}::uuid, ${reqB.action_request_id}::uuid)`;
  assert.equal(decisionsBefore[0].count, 0);

  await mkdir(directory, { recursive: true, mode: 0o700 });
  const requesterState = resolve(directory, "requester.json");
  const validatorState = resolve(directory, "validator.json");
  await writeFile(requesterState, JSON.stringify(toPlaywrightState(fixture.sessions.central.cookies, config.baseUrl)), { mode: 0o600 });
  await writeFile(validatorState, JSON.stringify(toPlaywrightState(validator.cookies, config.baseUrl)), { mode: 0o600 });
  const manifestPath = resolve(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    ...fixture.manifest,
    expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    requesterState,
    validatorState,
    actionA: { id: reqA.action_request_id, label: labelA, resourceId: resourceA },
    actionB: { id: reqB.action_request_id, label: labelB, resourceId: resourceB },
    before,
  }), { mode: 0o600 });

  stage = "browser";
  summary = await runSecuredBrowserSuite({
    root,
    config,
    environment: buildChildEnvironment(process.env, {
      E2E_BASE_URL: config.baseUrl,
      E2E_LOCAL_ADMIN_AB_MANIFEST: manifestPath,
    }),
    specifications: ["tests/e2e/local-admin-ab-decisions.spec.ts"],
    output: resolve(directory, "browser"),
    expectedTests: 1,
    projects: ["chromium-desktop"],
  });

  stage = "native-proof";
  const after = await db`
    select id::text, status, resource_id
    from public.admin_operational_action_requests
    where id in (${reqA.action_request_id}::uuid, ${reqB.action_request_id}::uuid)
    order by resource_id`;
  const [rowA] = after.filter((row) => row.id === reqA.action_request_id);
  const [rowB] = after.filter((row) => row.id === reqB.action_request_id);
  assert.equal(rowA.status, "PENDING_APPROVAL");
  assert.equal(rowB.status, "AUTHORIZED");
  const [decision] = await db`
    select decided_by::text, decision, reason
    from public.admin_operational_action_decisions
    where action_request_id = ${reqB.action_request_id}::uuid`;
  assert.equal(decision.decided_by, validatorId);
  assert.equal(decision.decision, "APPROVE");
  const aDecisions = await db`
    select count(*)::int as count from public.admin_operational_action_decisions
    where action_request_id = ${reqA.action_request_id}::uuid`;
  assert.equal(aDecisions[0].count, 0);
  const audit = await db`
    select action, actor_user_id::text
    from public.audit_events
    where resource_id = ${reqB.action_request_id}
      and action = 'admin.action.decided'`;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_user_id, validatorId);

  proof = {
    refusedSelfApprove: true,
    refusedSyntheticId: true,
    authorizedOnlyB: true,
    validatorId,
    actionA: reqA.action_request_id,
    actionB: reqB.action_request_id,
    before,
    after,
  };
} catch (error) {
  failure = error;
  summary ??= error.browserSummary;
} finally {
  if (fixture) {
    try {
      const db = fixture.resources.database;
      for (const id of actionIds) {
        await db`update public.admin_operational_action_requests set status = 'CANCELLED', row_version = row_version + 1 where id = ${id}::uuid and status = 'PENDING_APPROVAL'`;
      }
    } catch (error) {
      cleanupVerified = false;
      failure ??= error;
    }
  }
  for (const cleanup of [
    () => fixture?.cleanup(),
    () => rm(directory, { recursive: true, force: true }),
    () => rm(resolve(root, "scripts/p05-e2e/.auth"), { recursive: true, force: true }),
  ]) {
    try { await cleanup(); } catch (error) { cleanupVerified = false; failure ??= error; }
  }
}

await writeLocalSuiteEvidence({
  root,
  suite: "admin-ab-decisions",
  config,
  summary,
  failure,
  cleanupVerified,
  proof: { ...proof, stage },
});
if (failure) {
  console.error("ADMIN_AB_DECISIONS_FAILED");
  console.error(failure);
  process.exitCode = 1;
} else {
  console.log("ADMIN_AB_DECISIONS_PASSED");
  console.log(JSON.stringify(proof, null, 2));
}
