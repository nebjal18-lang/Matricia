import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { provision, elevateToAal2, toPlaywrightState } from "../../../scripts/p05-e2e/provision.mjs";
import { loadSafeConfiguration } from "../../../scripts/p05-e2e/environment.mjs";
import { buildChildEnvironment, validateFreshManifest } from "../../../scripts/p05-e2e/security.mjs";
import { runSecuredBrowserSuite, writeLocalSuiteEvidence } from "./secured-browser-runner.mjs";
import { seedMatFunc032Reconciliation, cleanMatFunc032Seed } from "./local-mat-func-032-seed.mjs";

const root = process.cwd();
const directory = resolve(root, "artifacts/test-results", `.local-mat-func-032-${randomUUID()}`);
let config, fixture, summary, failure, proof, stage = "configuration", cleanupVerified = true;

try {
  process.env.MATRICIA_DEMO_ACCESS_ENABLED = "false";
  config = await loadSafeConfiguration(root);
  assert.equal(config.runtimeMode, "isolated-local-docker");
  assert.equal(config.localDockerVerified, true);

  stage = "fixture";
  fixture = await provision();
  await validateFreshManifest(fixture.manifest, config);

  const db = fixture.resources.database;
  const reconciler = fixture.sessions.noRole;
  const reconcilerId = fixture.resources.userIds[3];
  await elevateToAal2(reconciler);

  stage = "seed-open-invoice-and-reviewed-payment";
  const seeded = await seedMatFunc032Reconciliation(fixture);
  assert.notEqual(seeded.paymentDeclaredByUserId, reconcilerId);
  assert.equal(seeded.financeReviewerUserId, reconcilerId);

  const beforeAllocations = await db`
    select count(*)::int as count from public.provider_payment_allocations
    where payment_id = ${seeded.paymentId}::uuid`;
  assert.equal(beforeAllocations[0].count, 0);
  const [beforePayment] = await db`
    select p.amount_minor::text as amount,
      coalesce((select sum(a.amount_minor) from public.provider_payment_allocations a where a.payment_id = p.id), 0)::text as allocated
    from public.provider_payments p where p.id = ${seeded.paymentId}::uuid`;
  assert.equal(beforePayment.allocated, "0");
  assert.equal(beforePayment.amount, seeded.amountMinor);
  const [beforeInvoice] = await db`
    select (i.total_minor - coalesce((select sum(a.amount_minor) from public.provider_payment_allocations a where a.invoice_id = i.id), 0)
      - coalesce((select sum(c.total_minor) from public.provider_credit_notes c where c.invoice_id = i.id), 0))::text as outstanding_minor
    from public.provider_invoices i where i.id = ${seeded.invoiceId}::uuid`;
  assert.ok(BigInt(beforeInvoice.outstanding_minor) > 0n);

  await mkdir(directory, { recursive: true, mode: 0o700 });
  const reconcilerState = resolve(directory, "reconciler.json");
  await writeFile(reconcilerState, JSON.stringify(toPlaywrightState(reconciler.cookies, config.baseUrl)), { mode: 0o600 });
  const manifestPath = resolve(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({
    ...fixture.manifest,
    expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    reconcilerState,
    paymentId: seeded.paymentId,
    invoiceId: seeded.invoiceId,
    amountMinor: seeded.amountMinor,
    paymentReference: seeded.paymentReference,
    invoiceNumber: seeded.invoiceNumber,
    before: {
      allocations: 0,
      unallocated: seeded.unallocatedBefore,
      outstanding: seeded.outstandingBefore,
    },
  }), { mode: 0o600 });

  stage = "browser";
  summary = await runSecuredBrowserSuite({
    root,
    config,
    environment: buildChildEnvironment(process.env, {
      E2E_BASE_URL: config.baseUrl,
      E2E_LOCAL_MAT_FUNC_032_MANIFEST: manifestPath,
    }),
    specifications: ["tests/e2e/local-mat-func-032-reconciliation.spec.ts"],
    output: resolve(directory, "browser"),
    expectedTests: 1,
    projects: ["chromium-desktop"],
  });

  stage = "native-proof";
  const afterAllocations = await db`
    select id::text, amount_minor::text, reconciliation_batch_id::text, invoice_id::text
    from public.provider_payment_allocations
    where payment_id = ${seeded.paymentId}::uuid
    order by created_at, id`;
  assert.equal(afterAllocations.length, 1);
  assert.equal(afterAllocations[0].amount_minor, seeded.amountMinor);
  assert.equal(afterAllocations[0].invoice_id, seeded.invoiceId);
  const batchId = afterAllocations[0].reconciliation_batch_id;
  assert.ok(batchId);

  const [batch] = await db`
    select id::text from public.provider_reconciliation_batches where id = ${batchId}::uuid`;
  assert.equal(batch?.id, batchId);

  const [afterPayment] = await db`
    select p.amount_minor::text as amount,
      coalesce((select sum(a.amount_minor) from public.provider_payment_allocations a where a.payment_id = p.id), 0)::text as allocated
    from public.provider_payments p where p.id = ${seeded.paymentId}::uuid`;
  assert.equal(afterPayment.allocated, seeded.amountMinor);
  assert.equal(BigInt(afterPayment.amount) - BigInt(afterPayment.allocated), 0n);

  const [afterInvoice] = await db`
    select (i.total_minor - coalesce((select sum(a.amount_minor) from public.provider_payment_allocations a where a.invoice_id = i.id), 0)
      - coalesce((select sum(c.total_minor) from public.provider_credit_notes c where c.invoice_id = i.id), 0))::text as outstanding_minor
    from public.provider_invoices i where i.id = ${seeded.invoiceId}::uuid`;
  assert.equal(afterInvoice.outstanding_minor, "0");

  const audit = await db`
    select action, actor_user_id::text
    from public.audit_events
    where action = 'provider.payment.reconciled'
      and resource_id = ${batchId}`;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_user_id, reconcilerId);

  const outbox = await db`
    select event_type from public.event_outbox
    where organization_id = ${seeded.providerOrganizationId}::uuid
      and event_type = 'ProviderPaymentReconciledV1'
      and aggregate_id = ${seeded.paymentId}`;
  assert.ok(outbox.length >= 1);

  proof = {
    paymentId: seeded.paymentId,
    invoiceId: seeded.invoiceId,
    reconciliationBatchId: batchId,
    amountMinor: seeded.amountMinor,
    allocationsAfter: afterAllocations.length,
    outstandingAfter: afterInvoice.outstanding_minor,
    unallocatedAfter: "0",
    auditReconciled: true,
    outboxPresent: true,
    reconcilerId,
    noSqlAllocationInsert: true,
  };
} catch (error) {
  failure = error;
  summary ??= error.browserSummary;
} finally {
  if (fixture) {
    try {
      await cleanMatFunc032Seed(fixture);
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
  suite: "lot2-mat-func-032",
  config,
  summary,
  failure,
  cleanupVerified,
  proof: { ...proof, stage },
});
await writeLocalSuiteEvidence({
  root,
  suite: "mat-func-032-reconciliation",
  config,
  summary,
  failure,
  cleanupVerified,
  proof: { ...proof, stage },
});

if (failure) {
  console.error("MAT_FUNC_032_RECONCILIATION_FAILED");
  console.error(failure);
  process.exitCode = 1;
} else {
  console.log("MAT_FUNC_032_RECONCILIATION_PASSED");
  console.log(JSON.stringify(proof, null, 2));
}
