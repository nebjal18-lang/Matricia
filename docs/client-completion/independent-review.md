# Independent Client source review — 2026-11-02

Reviewer: `/root/client_independent_review`, independent from implementation. Initial integration: `/workspace/audit30`, branch `codex/client-completion-20261102`, initial base `a237ae1`.

## Scope and limits

Read AGENTS and scoped Client SQL, server actions and payment API. Focus: exact money, independent approvals, tenant authority, transaction capability binding, acquired Box promises, native execution and refunds. This is a source review, not application certification. The reviewer did not mutate a database or fixtures, independently run SQL, exercise an external PSP, or execute a concurrent revocation race. Commands used were source reads/searches, git revision inspection, SHA-256 calculation and reads of existing test-result summaries. The only reviewer-created file is this report, requested by root.

Implementation-worker and root test results are explicitly attributed below. Earlier failed iterations were retained; they must not be cited as successful final runs. Production, external provider contracts, restoration, real email, storage/scanning and the full visual/mobile/RTL matrix are outside this review's evidence.

## Findings and remediation status

| ID | Concrete cause and impact | Source remediation reviewed | Status / evidence |
|---|---|---|---|
| R1 | 25030 restricted measurement context/evidence to client_portfolio_read, excluding legitimate Finance/Compliance reviewers. Rewards dashboard and native referral proof verification failed. | 29000 adds scoped Client read OR existing AAL2 rewards review authority; no portfolio mutation expansion. | Addressed in inspected source. Root final 0329: 16 assertions passed in client-followup-sql.log. |
| R2 | Client baseline/ROI/savings/budget actions converted every currency at two decimals: JPY wrong by100, KWD three decimals refused. | Shared exact parseMoneyInput, declared baseline/budget currency; ROI/savings read immutable authorized VERIFIED baseline currency; allocations read exact-org budget currency. | Addressed in inspected source. Existing remediation final unit log: 62 tests passed; action tests executed by implementation worker. |
| R3 | Native benefit command checked authority before financial/wallet/redemption waits, allowing revoked actor to execute after wait. | 30010 rechecks native actor/AAL2/role after locks; 30030 narrows Buyer to own acquired allocation. | Addressed in inspected source; no independently executed two-session race. Root 0330:24 passed. |
| R4 | Envelope assignment accepted Buyer, but global credits_client_access excluded Buyer, making acquired envelope unusable. | 30000 issues private PID/transaction/actor/org/benefit/correlation-bound reserve/release capability and narrow own-Box reader. Global wallet/financial ACL remains unchanged. | Addressed in inspected source; root 0330:24 passed. Exact overlapping Box context tracked separately under R7. |
| R5 | Native execution selected latest approved binding rather than implementation acquired pre-payment; later binding could change purchased effect. | 30010 freezes native binding in pre-PSP Box terms, persists immutable reservation source, executes exact acquired binding. Missing executor blocks before PSP. | Addressed in inspected source; overlap consistency closed R7. Worker lineage0336=16 and pre-PSP0337=3 raw TAP assertions read, zero failures/errors. |
| R6 | AFTER approval trigger immediately issued money under Compliance actor; ensure wallet/award ACL rejected and rolled back valid independent decision. | 32000 immutable execution request + Outbox; actual Finance/AAL2/session execution with post-wait checks; exact approval/source/rule/audience/wallet binding; immutable completion and historical replay. No impersonation or Compliance financial grant. | Addressed in inspected source. Root final R6 v2 native replay:32 assertions passed. |
| R7 | Valid overlapping full-paid cycles could share benefit. Explicit member Box A was replaced by envelope trigger's latest Box B, while native source chose a different acquired context. Valid operation could fail or use inconsistent promise. | 30050 exact command capability selects policy/period/allocation, checks native allocation against acquired source; ambiguous ordinary callers fail explicitly. 31110 preserves original full-paid Box lineage across differential upgrades. | Addressed in source at Box62317c8. Read worker TAP logs:0338 overlap18/18;0336 lineage16/16;0337 missing-executor pre-PSP3/3, all zero not-ok/error lines. Root fresh integrated replay remains required. |
| R8 | Refund-aware economic amount used cumulative quantity through current fact minus all recognized allocations. After a refund, earlier pending library A consumption could be attributed to later ready library B. Example100credits/100minor: consume50+refund50; A consumes50 pending mandate; B consumes50 ready receives100minor; A later receives0. Conservation alone did not protect correct library P&L. | 30070 reconstructs immutable movement chronology into original-credit position slices and sums exact cumulative-floor values per fact, independent of reconciliation order. Original post-allocation funded cap is retained. | Addressed in inspected source at64c38291. Worker actual native0340:24/24; reviewer read final raw TAP (zero not-ok/errors). Covers pending-A/ready-B late reconciliation, exact3333/5001 split, fragmented refunded positions, both book P&L and total conservation. Root final integrated replay remains required. |

## Further concurrency findings from actual recipe

- R9: Root/browser execution reproduced SQLSTATE40P01: one command held a child organization's FK KEY SHARE and waited for the subscription financial lock; the winner held financial and audit sealing requested incompatible organization FOR UPDATE. This was an incident with one persisted operation, not a successful quota race. Shared34000 changes audit organization lock to FOR NO KEY UPDATE, retaining audit-to-audit serialization while allowing child FK KEY SHARE. Narrow UI retries or only patching three entrypoints would not fix the common cause. Addressed in source at86f4231. Read worker two-real-PostgreSQL-session summary: no retry, one persisted site, second54000 quota refusal, no deadlock. Synthetic SQL actor explicitly distinguished from browser/GoTrue evidence.
- R10: Existing audit identity defaults were assigned before BEFORE-trigger lock acquisition. A delayed lower-id event could link to a higher-id event; the next order-by-id lookup then skipped the delayed event. 34000 assigns final identity only after organization/platform serialization, retains original hash payload, and fails closed if identity does not exceed the prior scope head. No old event is rewritten. Addressed in source at86f4231. Worker deterministic delayed-identity test confirms final seal-order IDs, three linear canonical hashes. Reviewer read evidence; did not execute the harness.

## Additional focused review

- Immediate upgrade 31000/31100: no concrete financial, tenant or transaction-capability bypass identified in inspected paths. Quote→accepted preparation→intent→paid event→canonical composite funding remain bound. Original period and exact configured rounding are pinned. Differential upgrade cannot receive full target immediate credit grant. No commercial policy is seeded. This is source-level evidence only, not external capture certification.
- Upgrade 31120 addresses missing durable governance Outbox transitions; zero-rounded options disappear without loosening actual quote validation.
- C10 33000 stores typed canonical commands and exact original arguments/key, links independent approvals, explicitly checks persisted approval states and active policies, revalidates source/CAS and live requester authority, and records completion only for real canonical success. No bypass identified. 33100 addresses misleading resume availability across linked decisions/roles. Root native0333 final:39 passed.
- Accounting own-envelope lifecycle advertised native execution although command permitted Owner/Admin/Buyer/operations only. 30060 now narrows projection/RFQ access to actual native ACL; no broader accounting grant. Source rechecked; worker0339 TAP8/8, zero not-ok/errors.

- Quote comparison35000/adaptor: immutable raw PostgreSQL JSON numbers above2^53 were being rounded before Client parsing. New exact-text transport wraps canonical compare writer and SECURITY INVOKER snapshot read. It keeps RLS and canonical private writer guards, revokes private base, converts only returned copies, leaves raw snapshot/inputhash/cache facts unchanged. No permission/hash regression identified in inspected source/0342 fixture. Worker frozenfa137f78 native0342 raw log read:30/30, complete TAP plan, zero not-ok/errors. Includes actual select_quote_and_notify after exact-text comparison response to preserve hash-based admission. Reviewer did not execute it.

## Test-result attribution

Read existing summary files, did not execute them:

- `/tmp/client-followup-sql.log`:0329=16 PASS;0330=24 PASS; original0332=106 PASS. The combined run also contains an older R6 failure, so its aggregate is **not** a passing complete run.
- `/tmp/client-r6-v2-native.log`:0334=32 PASS; evidence `work/isolated-replay/ec4b51ab-5dc6-4a3d-8638-a83a900f2db9/targeted-fixtures/059038d6-61db-4f71-bc87-5a632ac12262`.
- `/tmp/client-approval-availability-native.log`:0333=39 PASS; evidence suffix `80aa410c-1a45-4809-b5f1-1473cd1f7935` under same isolated replay.
- `/tmp/client-review-remediation-unit-final.log`:3 files,62 tests PASS.
- Upgrade worker reported native full-cycle/prorata/annual and governance tests plus21 unit tests passing. This review inspected the source, not their complete runtime outputs.
- Legacy tests refused for trigger-bypass syntax were not run by reviewer and are not treated as passes.

## Inspected source SHA-256

Paths relative to named worktree; hashes identify exactly inspected material, not deployment contents.

`/workspace/client-review-fixes` at `e31c1098b9c020e1f7dcc1acbd599e91f3a2759e`:

```text
9b557de1301122c0c7b30d7add5918ba1a158693c3adc9c347754f9b651ffd10  supabase/migrations/20261102029000_client_measurement_review_access.sql
99a04c6a801b0bdf5887ba8889776193a63a50353d9738acc1fe39d929381a89  supabase/migrations/20261102032000_client_referral_reward_execution_queue.sql
6c7798f2aa3ac5af4c515d34617b87cd92486daa96a2085182919907c2bfbb04  apps/web/modules/client/screens/recompenses/actions.ts
a0dd3540cef082ff1012d6b28a35b7ab1bbfecb67d5bdb4e8d82613a0db8dd1a  apps/web/modules/client/screens/portefeuille/actions.ts
90fc25bad725a5f5646d2284a38f07635aac3e0f8ca63ddcb9c24d3dc74e18e6  apps/web/modules/client/data/portfolio/model.ts
```

`/workspace/client-subscription-upgrade`:

```text
b549124955532322dd6d15f9376ae3f6c54da4e7ab0611e500794f99276a2d65  supabase/migrations/20261102031000_governed_immediate_subscription_upgrade.sql
c914a7a210c1556adfb88296cd794944e9fe2d6d8399c0b4aba6e7f3cf15714e  supabase/migrations/20261102031100_remaining_period_subscription_upgrade.sql
2a1b2087d0f2e5d2a4253764dffc09bcc25a89d4ba0b04ba4fe2b2eda0d8dfd8  supabase/migrations/20261102031120_subscription_upgrade_outbox_and_payable_options.sql
```

`/workspace/audit30`:

```text
c98f2aa3a26837328c435046f3ab50ebc262e4ed45e90e624aa1650aa34a2c75  supabase/migrations/20261102033000_client_approved_command_resume.sql
7b29bfe2f1b4f1fbdf2873fb27ad5604719e8f253c41b655f7cc5185c3053104  supabase/migrations/20261102033100_client_approval_resume_availability.sql
```

`/workspace/client-boxes-finish` at frozen commit `62317c8`:

```text
50cc304e1a79878a4bc701b0cbc9d695af4c8c84a3bc5d4d0f297dffebdd5e13  supabase/migrations/20261102030000_scoped_member_box_commands.sql
ff0f9fb3ea8cc94ce0db73abf2ad1de5f3baa0e2a9b46db367c694776fb494c6  supabase/migrations/20261102030010_native_benefit_acquired_execution.sql
00bfd7e373efde8bb22a2e4aed975ad01661accf6375f94add40c87274a49428  supabase/migrations/20261102030030_client_benefit_lifecycle_workspace.sql
780c577ed4149ccbdd8507877cec2fa06456db208f533ae36071a8477b2f0178  supabase/migrations/20261102030050_exact_acquired_box_reservation_context.sql
6b5e214a7b0e1d27fe369b5ddd8b1d0c218851281739defab26b7d92e230f53e  supabase/migrations/20261102030060_match_native_execution_role_projection.sql
efbb6de62abd1ab95697d2be3fcb6958959540327177bbcee40a2e945f33406d  supabase/migrations/20261102031110_preserve_acquired_box_upgrade_lineage.sql
```

Read worker raw logs `/tmp/client-boxes-0336_acquired_box_prorata_upgrade_lineage.test.sql.log`, `0337_unconfigured_box_before_psp`, `0338_overlapping_paid_box_exact_context`, `0339_accounting_native_role_projection` with the same prefix/suffix: respectively16,3,18,8 ok assertions, complete TAP plans and zero not-ok/error lines. These were executed by the Box implementation worker, not reviewer.

`/workspace/client-benefit-refunds` at frozen commit `64c38291a5a446af9c79406b0b2119aecdbeb726`:

```text
7441877784ce40925ad85b9134405afac9e3803c4241d66959322e33f4ce995d  supabase/migrations/20261102030020_governed_benefit_refunds.sql
1c42a8ba33f6fdbee997f85ca604e7946211ec2397f8d1b9196fe18d144b56f1  supabase/migrations/20261102030070_refund_consumption_exact_library_slices.sql
f247b59425cdaa5bf69bd21b33a5a26b416243571a719f954b1e92663df8b907  supabase/tests/0340_refund_pending_library_exact_slices.test.sql
2d2e426d9b8dacdee215bb68da411783de6f15ed9ca5f08f91723474399c14f6  /tmp/matricia-refunds0332/test0340.log
```

Reviewer read final0340 raw log:24 ok,1..24 complete plan, zero not-ok and ERROR/FATAL lines. Worker also reports original0332=106 and0247/0248=73/37 after30070. These are worker-executed runs, not reviewer runs. Already-posted wrong allocations require a separate governed correction; the additive migration does not rewrite immutable accounting history. Long lot-history performance was not benchmarked by this source review.

The R1–R8 source remediation review is complete with no further concrete blocker identified in the inspected paths. Root's fresh integrated replay and remaining browser/provider recipe remain necessary. R9/R10 source remediation and implementation-worker native evidence were subsequently reviewed below. No further concrete blocker was identified in these inspected paths; this remains a scoped review, not a general security certification.


Quote transport source at `/workspace/client-contract-acceptance`, frozen `fa137f78b2d78ec906d3b4975542eb96b71a2d9e`:

```text
514cb509bedafcc8ad6c72cf5b992b5a0a05a152154fa1bfef3e96b2962127f2  supabase/migrations/20261102035000_client_quote_comparison_exact_transport.sql
611db481590d6f40e960ffb9c4adbbb4a38677d7760e13b8257b546f48848d77  supabase/tests/0342_client_quote_exact_transport_acceptance.test.sql
0ed3cf7d332df04f06f64efaba470d256c6cadd9160b8899ac2cf6a7c592347e  apps/web/modules/client/data/rfq/server-repository.ts
```

Worker evidence read: `work/contracts-acceptance/0342_client_quote_exact_transport_acceptance.test.sql.log` contains30 ok,1..30, zero not-ok/ERROR/FATAL. These are local native SQL fixture results, not external deployment certification.


Audit/quota source at `/workspace/client-boxes-finish`, frozen `86f42315302e4cbc1b5fb7be9605d31fb9066227`:

```text
c1e9c489730bcd405f030fced0c4acaffdc7d0dc255d11058e883a28b2b57428  supabase/migrations/20261102034000_quota_audit_lock_and_chain_order.sql
0b276a14e109f1fb247edfb1fbd00896b611b7664ab7ff64d51f6fe9c903261a  supabase/tests/0341_quota_audit_lock_and_chain_order.test.sql
4f022fc50aa415aad269745a63d0c9f55dffd5c21c828815ddd1e04a42e9e217  supabase/tests/helpers/verify-quota-audit-concurrency.mjs
1c87566c6d5d5b672310f04f4b326f8496bc34f6428ebb7ef5705535f814f42d  /tmp/client-quota-audit-concurrency/summary.json
```

Read worker raw logs `/tmp/client-boxes-0341_quota_audit_lock_and_chain_order.test.sql.log` and `/tmp/client-boxes-0008_p03_audit_outbox.test.sql.log`: respectively14/14 and17/17, complete plans, zero not-ok/ERROR/FATAL. Read deterministic harness source and final JSON summary: two real PostgreSQL sessions, synthetic SQL actor, network-none container, zero retries; quota one accepted/one54000 refusal and exactly one active site; delayed preallocated identity then later audit seal yields one linear canonical chain. The summary explicitly sets `nativeGoTrueCertified:false`; this review does not reclassify it as a browser-auth certification. Separate browser cohorts are root/browser worker evidence, not independently reviewed here.

## R11 — grouped-purchase mutual RLS recursion

Root/browser reproduction reported native SQLSTATE42P17 while Owner opened grouped purchases, including an empty result filter. Source20260912006600 policies `reservations_scoped_read` and `provider_allocations_scoped_read` expanded one another's inline EXISTS queries. This failed during policy planning, regardless of whether rows existed. The reservation policy also used `allocation.reservation_id=id` with an unqualified `id` binding to the inner allocation rather than the outer reservation, breaking intended Provider linkage.

Additive36000 changes the two policies to private SECURITY DEFINER boolean predicates taking only the canonical reservation/allocation ID. Each predicate checks real current auth.uid and active session, retrieves actual linked rows, then permits only Client-organization membership, assigned Provider membership or the existing central/Auditor read authority. Fixed search_path, explicit row bindings, boolean-only return and authenticated EXECUTE grant preserve policy invocation without exposing row contents. No direct table writes or additional financial authority are granted; sensitive command AAL2 guards remain in place. Consumption policies become nonrecursive transitively. No further concrete blocking finding was identified in this source.

Source/test SHA-256 verified in `/workspace/client-review-fixes`, frozen commit `17a020b40010c7225bb3a508490b5b69c420a828`:

```text
5b7b64403fbbff95f816df796b71a9a4c3776fbcfcf10e7fbb222f63ad2d477f  supabase/migrations/20261102036000_volume_reservation_read_scope.sql
d52ff2931bce3b1af7badd6954557b55146e164db8f2e7bddfd9060f57e5693e  supabase/tests/0343_volume_read_rls_recursion.test.sql
```

Worker evidence read at `work/volume-rls343/`:

- `volume343-before.sql` explicitly expects42P17 for populated owned projection and zero-row filter; `volume343-before.log` contains2/2 expected-error assertions passing.
- `volume343-after.log`:27/27 assertions, complete TAP plan, zero not-ok/ERROR/FATAL lines. Covers exact Client projection, empty filter, Client A/B isolation, two Providers sharing one reservation but denied peer allocation, unassigned Provider, central Finance/Auditor, denied writes, AAL2-sensitive command unchanged and revoked session.
- Actual table reads execute under SET ROLE authenticated; pgTap assertions run as database owner. These are synthetic SQL actor fixtures, not nativeGoTrue browser certification.
- The private schema has no authenticated USAGE, so direct helper foreign-ID boolean tests use owner execution with bound actor claims. The browser cannot directly invoke private schema helpers; production table RLS still invokes the predicates with authenticated EXECUTE permissions.
- Worker aligned disposable-clone table ACLs to source-held SELECT-only grants because the destination image's inherited defaults added CRUD. For legacy0049 compatibility, later aligned the volume tables and three existing RPC ACLs to held read-only source metadata; recorded exact commands in ignored `source-acl-alignment.sql`. Source-held/browser objects were not written. Reviewer read latest0049-compat.log:30/30 and repeated0343-after:27/27, zero not-ok/errors. This is source-ACL fidelity, not a permission expansion in the source migration.

R11 cause is addressed in reviewed frozen source and worker SQL regression. Root's fresh integrated migration/tests and nativeGoTrue grouped-purchase browser follow-up remain required. Root reported a prior full456-migration/30-new-test pass before R11; that evidence must not be described as including36000.


## R12 — deferred ledger invariants lose trusted execution context

Root/browser encountered actual service-role HTTP403/SQLSTATE42501 on `financial_entries` after successful governed setup and payment preparation. The foundational `assert_financial_journal_has_entries` and `assert_financial_journal_balanced` constraint-trigger functions were SECURITY INVOKER and initially deferred. Their reads execute when constraints flush after the canonical SECURITY DEFINER callback has returned, under the actual service caller, which intentionally lacks raw ledger SELECT. Running the same flow as database owner masked this defect. The same context issue affected deferred `assert_credit_wallet_nonnegative`: Buyer RLS could hide all entries, making the invoker sum incorrectly appear zero instead of validating the true wallet.

Additive37000 changes exactly these three trigger-only invariant functions to SECURITY DEFINER, pins search_path to pg_catalog and revokes direct EXECUTE from public/anon/authenticated/service_role. Their pure SELECT-and-raise bodies, exact NEW organization/journal/wallet predicates, DEFERRABLE constraints, ledger ACLs and RLS remain unchanged. It neither writes financial facts nor grants raw ledger privileges. This fixes the common trusted-read context rather than weakening the financial invariant or broadening service/Buyer access.

Reviewer identified and had the worker correct a proof gap before freeze: an earlier `SET CONSTRAINTS ALL IMMEDIATE` persisted into the positive credit-worker check, so that check would have fired inside its definer command. Frozen0344 explicitly restores `credit_wallet_nonnegative DEFERRED` immediately before executing the native worker and flushes top-level after return while current_user remains service_role.

Frozen contents inspected at `/workspace/client-payment-service-context`, commit `8fa721f4736e7a57632c63fc153f0c2ba3ac8fcc`:

```text
c43f147cd392fe4ef3d3e96baa5266a63476d93bf550bac019e72e78eb473539  supabase/migrations/20261102037000_deferred_ledger_invariant_execution_context.sql
e986a8bc3087bad61a800448e9c3cee6ceb0f55a4e0fecb695a70f25b55f808f  supabase/tests/0344_payment_deferred_service_context.test.sql
```

Worker evidence read at `work/payment37000/`:

- `red.log`:9 successful prerequisite/access assertions, then42501 permission denied for financial_entries from deferred journal-has-entries guard at top-level constraint flush after callback return. This is the expected pre-fix failure, not a passing complete run.
- `green.log`:31/31 assertions, complete TAP plan, zero not-ok/ERROR/FATAL. Actual SET LOCAL ROLE service_role executes registration/callback and post-return constraint flush; native paid-credit worker similarly returns before wallet flush. Authenticated and anonymous callback/direct-ledger attempts remain denied; malformed gateway/proof fail; exact replay creates one cycle, one balanced journal, two financial entries, ten paid credits, one activation audit and one paid Outbox event.
- Rollback-only append-only fixtures prove the definer checks still reject empty and unbalanced journals under service role and true negative balance despite Buyer-visible ledger count zero. Balancing entries complete fixtures before rollback; no trigger disable, UPDATE or DELETE bypass.
- Worker reports original457 guard owners/flags and ledger ACLs were matched before applying the delta to its private clone. Test service/auth claims are local SQL fixtures under actual database roles; they do not certify a genuine GoTrue browser session or real external PSP signature/capture. Root/browser retains the exact original native intent/event for retry.

R12 cause is addressed in reviewed source and worker regression. No additional concrete blocker was identified in the inspected change. Root fresh integrated replay and genuine service-client/Buyer browser after-proof remain required.

## Final handoff

R1–R12 identified causes are addressed in the frozen source reviewed here. No additional concrete blocking finding remained in these inspected changes at handoff. Integration validation belongs to root: fresh migration replay, final type/lint/build/tests, browser recipe and honest external-access/integration limitations. No merge, production deployment, remote database write, secret inspection or external message was performed by this reviewer.
