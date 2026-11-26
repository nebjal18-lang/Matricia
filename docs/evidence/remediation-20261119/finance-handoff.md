# Finance remediation handoff — 2026-11-19

Scope: FIN-01..FIN-05 only. Implementation prepared for independent review; this is not production approval. No deployment, remote database, shared reset, original audit edit, configuration/dependency edit, or UI change.

## Owned deliverables

- [Additive migration](../../../supabase/migrations/20261119100000_audit_core_finance_integrity.sql)
- [Core regression tests](../../../supabase/tests/0410_audit_core_finance_integrity.test.sql)
- [Volume regression tests](../../../supabase/tests/0411_audit_volume_replay.test.sql)
- This handoff.

## Authority and evidence read

AGENTS.md; Gold Master V4 FINAL §§5.4–5.6, 16.3–16.6, fiscal calculation §20 and volume §21; Core economic rule in docs/finance/REGLE_ECONOMIQUE_PARTENARIAT_CORE_ENTREE_V1.md. Requirements primarily MAT-FUNC-030/032 and financial idempotence/integrity.

Skills read completely: matricia-supabase-rls, matricia-franchise-finance, matricia-domain-invariants, matricia-volume-procurement, supabase-postgres-best-practices; targeted RLS/advisory-lock references. No Next changes, so installed Next guides were not needed.

Original audit read by absolute path under C:/Projects/Matricia/Matricia/docs/audits/2026-11-19-audit-360-b578c75c/: findings FIN-01..05, reviewers/finance.md, probes/core-pot-post.sql, probes/core-pot-owner-constraints-diagnostic.sql and the three corresponding JSON probe results, including the native authenticated deferred-constraint failure. Original evidence was not modified.

## Changes

| Finding | Implemented protection |
|---|---|
| FIN-01 | Core revenue requires the canonical CLASSIFY ledger row, its funding/classification linkage and frozen recognition journal/account mapping. Exact Core net amount, currency and Casablanca effective date checked. Expense/gross VAT/arbitrary journal references rejected. Fee revenue binds to the fee's actual journal and uses revenue credits excluding liability credits. Marketing/operating costs require actual expense journal amounts. Unique economic journal recognition; manual reversals must mirror accounting lines and retain original economic date. |
| FIN-02 | Caller-bound Core RLS predicate gets narrowly scoped EXECUTE; deferred allocation trigger runs SECURITY DEFINER with fixed path. Private helper schema and mutations remain inaccessible. Native authenticated SET CONSTRAINTS tested. |
| FIN-03 | Shared transaction lock serializes Core financial decisions. Private period claims have a GiST exclusion constraint; exact same interval can version, distinct overlapping intervals cannot accrue again. Allocation ledger writes deltas on correction. |
| FIN-04 | Canonical SOURCE_REVIEW_REQUIRED / REFUND / REVERSE events and fee reversals append compensating Core revenue entries with audit/outbox. Revalidation occurs before new closure/payout. A cutoff cannot conceal a new correction, and payout requires current closures to include entries. Existing payouts remain immutable and a corrective closure can expose a recoverable negative balance. |
| FIN-05 | Stable business request hash and authenticated receipt lookup precede effect-dependent guards for post/reversal, closure, payout, provider allocation and consumption. Ingestion remains a canonical bridge and its prior receipt survives invalidation. Closure content hash remains distinct from the stable request hash. |

Core economic split remains 50/50, IT 50/50/0 and standard franchise 50/25/25 remain untouched. No tax rate hardcoded; no FR/AR presentation changed.

The global Core lock intentionally favors financial ordering over parallel throughput. Source events and new Core decisions use the same lock. The invalidation observer only considers matching funding/schedule sources and compensates each entry at most once. A disputed or partially refunded source is fully reserved conservatively rather than silently treating uncertain revenue as acquired.

## Reserved test environment

Authorized identity: **matricia_finance_remediation_20261119**, in **supabase_db_Matricia**, localhost **54322**. No port 55419 or second clone used.

Before creation: template matricia_audit_20261119_b578c75c existed with **0 active connections**; destination did not exist. Created destination using PostgreSQL CREATE DATABASE TEMPLATE. Original audit and postgres application data were not changed. Final clone retained for root. No secrets/connection strings used in output. SQL tests use local Docker psql as supabase_admin for fixtures, then SET LOCAL ROLE authenticated for real RPC and deferred constraint checks. No authenticator HTTP hook was needed for these direct SQL tests.

Migration applied on clone, with subsequent owned function/index corrections applied there. Root owns the separate clean migration replay. The clone's migration history was not forged to pretend that the root clean replay had occurred.

## Executed regression results

Final native suites on reserved clone, exit 0, no `not ok`:

| Suite | Passing assertions |
|---|---:|
| 0410_audit_core_finance_integrity.test.sql | **41** |
| 0411_audit_volume_replay.test.sql | **10** |
| Existing 0386_platform_core_pot_finance.test.sql | 24 |
| Existing 0387_platform_core_pot_ingest_sources.test.sql | 11 |
| Existing 0049_p12_volume_procurement_pools.test.sql | 30 |

Core tests cover inflated amount, VAT/gross, unproven and invented sources, unrelated/expense/foreign-currency journals, wrong date, post mismatch/replay, reuse, net-only recognition, authenticated deferred constraints, overlapping periods, correction without double accrual, full payout replay at zero balance, invalidation before ingestion/after ingestion/after closure/after payout, compensation deduplication, stale cutoff, negative recoverable balance, ingestion/manual reversal replay, anonymous/missing identity/non-finance denials and private-schema boundary.

Volume tests execute full allocation and consumption RPCs, stable retries, changed-payload rejection, permission denials, capacity conservation, one immutable consumption and exactly two outbox events.

Fixture funding/classification rows are synthesized by the clone owner with real constraints enabled, then the affected RPCs and invalidation triggers run natively. This proves the Core boundary and event handling, not a full PSP subscription/refund end-to-end flow. Tests never disable triggers or RLS. Transactional test fixtures roll back.

## Executed concurrent sessions

Separate Docker psql connections, each using BEGIN, authenticated Finance/AAL2 claims, real RPC, SET CONSTRAINTS ALL IMMEDIATE and COMMIT. Session A holds the completed command's transaction for 1 second; B begins after A prints LOCK_HELD and waits for A's commit.

| Scenario | Observed result |
|---|---|
| Overlapping distinct Core periods | A committed; B rejected CORE_POT_PERIOD_OVERLAP. |
| Identical Core closure/key | Both returned identical closure receipt, version 2; no duplicate allocation. |
| Identical full payout/key | Both returned identical payout receipt; remaining balance 0. |
| Identical full provider allocation/key | Both returned identical allocation receipt despite COMMITTED state. |
| Identical full consumption/key | Both returned identical consumption receipt despite CONSUMED state. |

Retained synthetic concurrency fixture references (not secrets):

- Period/closure book: 10926184-8794-4b41-bdf8-6baf7e17b93c.
- Full payout book: b34816d4-1beb-4b66-b629-587b7b6592e2.
- Volume reservation: 72d5d116-a962-44ee-9222-4ea77ada39a5.

Concurrency setup was extracted from the committed SQL regression fixtures up to the relevant command, committed only in the reserved clone, then the two RPC sessions were run via Node child_process and Docker psql. Those small committed fixture histories are retained so root can inspect outcomes; no cleanup by disabling immutability.

## Reproduce native suites

From this worktree, PowerShell (local reserved clone only):

```powershell
Get-Content -Raw -Encoding utf8 supabase/tests/0410_audit_core_finance_integrity.test.sql |
  docker exec -i supabase_db_Matricia psql -X -qAt -U supabase_admin -d matricia_finance_remediation_20261119 -v ON_ERROR_STOP=1
Get-Content -Raw -Encoding utf8 supabase/tests/0411_audit_volume_replay.test.sql |
  docker exec -i supabase_db_Matricia psql -X -qAt -U supabase_admin -d matricia_finance_remediation_20261119 -v ON_ERROR_STOP=1
```

Require exit 0, plans 1..41 / 1..10, and no `not ok`; psql exit alone does not detect pgTAP failures. SQL files are rollback-only. Do not replay the additive migration onto an already migrated database.

## Limits and integration checks

- Independent financial review and root's separate clean migration replay remain required before phase sign-off.
- No production approval, PSP refund E2E, signed franchise entry-fee E2E, UI/browser or load-test claim. Positive Core/volume behavior is covered natively; the fee branch is validated by its source/SQL guards but lacks a full contractual fee fixture in these suites.
- New unique/exclusion constraints intentionally fail migration if historic double-recognition/overlap exists; do not delete historic ledger entries to bypass this. Review and correct historic economics before deployment.
- Historic invalidations already present before this migration are revalidated and block distribution; automatic compensations are emitted on new canonical events. Existing bad histories require supervised immutable corrections.
- Old closure receipts created under the former generated-version hash are not migrated; new and retried post-migration commands use the stable hash. Review legacy receipt compatibility if any pre-production history is to be retained.
- Allocation constraints are initially deferred; native tests force them immediate after each complete RPC, as transaction commit would. Callers that globally force constraints immediate before a multi-row closure are outside the tested normal contract.
- Editor SQL diagnostics returned no errors. git diff --check passed. No old SQL, PLANS, PROJECT_STATE, lockfile, package.json, tsconfig or file outside ownership changed.
