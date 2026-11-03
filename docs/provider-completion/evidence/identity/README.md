# Provider common legal identity

The new `/[locale]/sous-traitant/identite?organizationId=…` route reuses the
canonical common profile fields and validator, including IF/RC, legal address,
contact, representative, authority and declarations. Only Provider Owner/Manager
can read or save this personal/legal profile. URL context is resolved through
authorized Provider memberships; Viewer, foreign and unauthenticated access fail
closed. FR/AR controls preserve the selected organization and locale.

Migration 43000 moves the existing profile command into a non-executable private
primitive. The Client wrapper retains its Client Owner/Admin boundary; the new
Provider wrapper has an optimistic profile version. No Client role, subscription
or trial is created. Existing identifiers or verified common profiles continue
to require the governed Admin identity revision workflow for correction.

Provider submission is immutable and binds the exact canonical profile version,
profile hash and three submitted Provider evidence versions. It uses the existing
qualification document upload, trusted scan and independent review flow for
LEGAL/FISCAL/INSURANCE; no second document vault is introduced. The existing Admin
AAL2 identity screen now displays the common representative/contact/authority.
The existing final identity command refuses the author and submitter as reviewer,
requires the submitted current version, and retains current CLEAN document and
company decision controls. A later address or representative change invalidates
the earlier attestation. Its legal address feeds the existing canonical quote
identity helper. A Provider-only organization may activate after that review
without activating Client or an unverified mixed Client mandate.

The history RLS policy now uses the existing runtime-safe platform-role predicate;
it does not grant runtime execution on the private qualification decision helper.

`0350.rollback.log` proves 28 assertions on the owned isolated canonical 458-schema
TEST target. The migration and fixture ran in one transaction and rolled back;
post-checks confirm the new table/private command/test users are absent and the
original Client command is restored. This is a focused rollback test, not a fresh
migration replay or external document-scanner certification. Unit tests: 37/37;
changed-file ESLint: pass. The global cold TypeScript check was stopped, without a
result, at the orchestrator's request; final integration must run it. Independent
browser/review acceptance is also assigned to the integration phase.

The standard fresh replay invocation is:

```sh
APP_ENV=development node scripts/validate-local-migration-replay.mjs --test=0350_provider_common_legal_identity.test.sql
```

The first fresh-container attempt timed out before bootstrap/migrations. It
cleaned its own container. No production database, secrets or real legal identity
was used to make acceptance pass.
