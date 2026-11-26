# SEC-01..SEC-03 security remediation ? 2026-11-19

## Changes

- SEC-01: [additive migration](../../../supabase/migrations/20261119101000_audit_document_authorization.sql) restricts the client document download RPC to CLIENT_OWNER/CLIENT_ADMIN of the document tenant, matching the tenant vault policy. Existing scan, hash, expiry and audit requirements remain. Reuse bindings are consent records, not Viewer grants. Central platform vault readers do not gain a new download permission.
- SEC-02: demo identity is read before link generation: exact email, reserved .test/.invalid address, server app_metadata.matricia_demo=true and exact persona. Link and OTP identity are checked again. Authorization happens before session/MFA; failures after verification attempt invoke local sign-out, including transport exceptions and role fallback. Existing regional accounts cannot be relabelled into demo accounts; persona/territory/slot must already match.
- Removed direct platform-role upsert fallback: a rejected/missing admin RPC now fails closed.
- Added database environment gates to ensure_demo_admin_platform_role_v1 and reset_demo_box_network_v1 by CREATE OR REPLACE in the new migration. Only DEVELOPMENT/STAGING rows permit progress; production, null and absent configuration deny before effects. Existing service-role / actor / AAL2 requirements remain. Admin provisioning also requires a synthetic address and both trusted metadata flags. Old migrations unchanged; duplicate version reconciliation remains root ownership.
- SEC-03: local email confirmation enabled, signup and six-digit/600-second OTP retained. No running Auth configuration changed.

## Validation

- pnpm.cmd --filter @matricia/web exec vitest run 'app/[locale]/connexion': **11 files, 86 tests passed**, including existing OTP/consent flows and new identity, ordering, cleanup and config regressions.
- git diff --check: passed.
- ESLint on all changed TypeScript/tests: passed (after dependency update completed).
- Initial full TypeScript strict analysis: 794 diagnostics, one in ownership (test call-order indexing); this was corrected. The remaining diagnostics are outside ownership. Final targeted compiler analysis: **18 demo source/test files, zero diagnostics**, with noUncheckedIndexedAccess, exactOptionalPropertyTypes, noImplicitOverride and noFallthroughCasesInSwitch enabled; noEmit and incremental=false. VS Code diagnostics also report no errors on the edited action, identity and regional provisioning modules.
- Node runtime is 24.11.0; repository requests Node 22.x. Dependencies are borrowed through node_modules junctions; no dependency manifests/locks changed.

## SQL suite and limits

[0412 SQL regression](../../../supabase/tests/0412_audit_document_authorization.test.sql) **executed successfully: 17/17 pgTAP assertions, finish() returned no failures, psql exit 0, ROLLBACK completed**.

Authorized native target: exclusive database matricia_security_remediation_20261119 in container supabase_db_Matricia (host port 54322). Before creation, metadata queried through template1 showed zero connections to matricia_audit_20261119_b578c75c and no destination database. Created using that exact audit template; no existing database reset, no query/mutation against the original postgres application database, no remote connection. Clone identity is recorded in its database comment. Clone retained for root inspection; migration remains applied there.

The three functions and application tables are owned by supabase_admin in the template. The initial postgres-role attempts were denied (function ownership/table ACL), rolled back, and caused no durable changes. Applying the additive migration as its actual owner supabase_admin succeeded (three CREATE FUNCTION / ACL changes / COMMIT). The functional assertions then explicitly switch to authenticated or service_role and assert the effective SQL role. They do not substitute owner privileges for application authorization. pgTAP runs in the owner harness because application roles lack USAGE on extensions; no schema or function privilege was broadened to make the tests pass.

Native execution revealed and fixed only test-harness defects: an ambiguous binding document_id, malformed dollar quoting in two development checks, and pgTAP invocation outside the application-role exception subtransaction. These were the initial native-test fixes; the subsequent independent review corrections are recorded below.

Verified matrix:

| Case | Native result |
| --- | --- |
| Owner A / Admin A | SELECT one document and download RPC ALLOW, audit recorded |
| Viewer A unbound / bound / revoked binding | SELECT zero and RPC 42501 DENY |
| Revoked Admin A / Owner B | SELECT zero and RPC 42501 DENY |
| Both demo functions: PRODUCTION / null environment / missing row | 42501 environment DENY before effects |
| DEVELOPMENT provisioning with null user | Existing input validation retained |
| DEVELOPMENT reset without actor | Existing authorization DENY retained |
| Download / admin provisioning / reset execute ACL | authenticated-only / service_role-only / authenticated + service_role respectively; anon denied |
| DEVELOPMENT service_role, wrong persona then marked synthetic admin | Wrong persona denied with zero role effects; valid synthetic admin granted |

The suite uses synthetic auth users and sessions with row_security_active asserted. All fixtures roll back. Afterward: environment DEVELOPMENT restored, zero doc01/sec02 test users, zero synthetic test documents; all three functions retain supabase_admin ownership and SECURITY DEFINER. Bindings and scan metadata are synthetic; no Storage binary transfer or antivirus efficacy is claimed.

Reproduction from repository root (reserved clone only):

~~~powershell
Get-Content -Raw -Encoding utf8 supabase/tests/0412_audit_document_authorization.test.sql | docker exec -i supabase_db_Matricia psql -U supabase_admin -d matricia_security_remediation_20261119 -X -v ON_ERROR_STOP=1
~~~

Native Auth email delivery/confirmation and cookie revocation were not exercised against a running server. Mock tests verify that the local signOut API is invoked; backend signOut outages still require an integration check. AAL2 enrollment remains demo-only and can rotate factors on a previously validated synthetic account. Production demo gate tests remain green.

No deployment, production mutation, financial file edit, original audit edit, PROJECT_STATE/PLANS/config manifest edit, or release sign-off. Independent security review and native Auth/Storage validation remain integration gates; this native SQL/ACL gate is now passed.

## Independent review follow-up (after 9f264e65)

- Destination acceptance now requires the exact requested workspace-home pathname and workspace query, a safe current-locale URL, and no explicit demo refusal or role-fallback marker. Login/role-missing, disabled, unavailable, unauthenticated login, incident and MFA redirects remain refusals and trigger local signOut. Regression matrix covers client/provider/franchise and both FR/AR; successful home paths remain covered.
- The security migration now preserves the latest 18170000 reset Box alias to reset_demo_workspace_v1, rather than restoring the obsolete partial Box deletion implementation. Its outer environment guard remains fail closed and its execute ACL retains authenticated plus service_role; canonical actor/AAL2/environment validation remains delegated to the full workspace function.
- Native SQL now verifies service_role denial for production/null/absent environment, preserved ACL, and actual full-workspace organization archival/membership revocation through the Box alias on a synthetic fixture. Fixed the development denial test to use an authenticated JWT role as well as the authenticated SQL role (no stale service_role claim).
- Final rerun: 86/86 connexion tests (11 files), ESLint passed, strict diagnostics 0 on 18 demo files; 17/17 native pgTAP assertions and empty finish(), rollback verified, environment DEVELOPMENT and zero remaining doc01/sec02 users. Clone identity verified before replacing the candidate migration functions; no database reset.
- Independent retest requested on the exact follow-up commit; no security visa claimed before reviewer response.
