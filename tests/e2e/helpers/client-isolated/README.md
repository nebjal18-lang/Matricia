# Independent native Client browser verification

Run from the repository root with Node 24, installed workspace dependencies,
Docker on `/var/run/docker.sock`, cached Supabase images and `/usr/bin/chromium`.
These are opt-in local test utilities; they never read `.env.local` credentials
or resolve a remote application database. Set `APP_ENV=development` explicitly.

The source must be an explicitly authorized **read-only isolated replay**
manifest (`matricia_replay_<uuid>`, matching label, no network and no ports).
`restore.mjs` takes that manifest as an argument; it does not find a database
by application project name. The source is only inspected and `pg_dump`ed.
Every write targets a fresh, differently labelled container on its own Docker
**internal** network, without published container ports. Host access is through
its inspected private IP and a test-only HTTP gateway bound to `127.0.0.1`.
All mutations and cleanup recheck container labels and network isolation.
Docker endpoint/context selectors are reset to the local Unix socket; proxy/CA
configuration is retained. Images must already exist (`--pull=never`).

```sh
APP_ENV=development node tests/e2e/helpers/client-isolated/provision.mjs
APP_ENV=development node tests/e2e/helpers/client-isolated/restore.mjs /absolute/authorized/held-target.json
APP_ENV=development node tests/e2e/helpers/client-isolated/services.mjs
# Keep this running in its own terminal:
APP_ENV=development node tests/e2e/helpers/client-isolated/gateway.mjs
# In another terminal, once the gateway is ready:
APP_ENV=development node tests/e2e/helpers/client-isolated/actors.mjs
APP_ENV=development node tests/e2e/helpers/client-isolated/seed-questionnaire.mjs
# Keep this running in its own terminal:
APP_ENV=development node tests/e2e/helpers/client-isolated/run-app.mjs
# Then run the assertions:
APP_ENV=development node tests/e2e/helpers/client-isolated/questionnaire-browser.mjs
APP_ENV=development node tests/e2e/helpers/client-isolated/portfolio-browser.mjs
APP_ENV=development node tests/e2e/helpers/client-isolated/browser.mjs
node --test tests/e2e/helpers/client-isolated/safety.test.mjs
# Run sequentially, with no other fixture/browser script in progress:
APP_ENV=development node tests/e2e/helpers/client-isolated/quota-race.mjs
```

Use `run-app.mjs --production` to run a complete local build (including Next
TypeScript validation) followed by a loopback-only production-mode server.
`APP_ENV` remains development and the database stays isolated. A failed build
does not start the server; no check is skipped.

Use `browser.mjs --full-client` for all 22 existing Client/shared entry routes,
including subscription, Box configuration, procurement, finance, onboarding
and organization/dashboard. It records the selected context at every width.
`browser.mjs --menus-probe` narrows the keyboard/stacking/public-session check
to FR/AR at 360 pixels.

Use `browser.mjs --probe` for the two modules affected by the composite-role
pagination regression. The full matrix covers nine Client pages in FR/AR at
360, 375, 390, 768 and 1440 pixels. It asserts native session access, document
overflow, technical loading failures, client/admin denial and foreign
organization denial. Screenshots and JSON record the exact code commit, source
archive hash and assertion scope. The questionnaire scenario exercises real
Server Actions, required/hidden rules, independent server rejection, native
save/reload, offline queue/reconnect, RTL and unchanged user text, keyboard
filters, draft resume and final read-only submission. A successful page request
alone is not evidence of a successful business operation.

Auth users have unique `@example.invalid` addresses. GoTrue creates native OTP
sessions, enrolls TOTP and verifies AAL2. **User JWTs are never fabricated.**
For a long run, `refresh-sessions.mjs` refreshes the same native sessions through
GoTrue and persists them only in ignored private state. It checks the exact user
identity and AAL2 after each refresh; it never creates replacement actors.
The harness creates its own temporary anon/service configuration keys. Role
bootstrap uses explicit local test SQL. `seed-questionnaire.mjs` extracts the
reviewed historical dossier/catalogue fixture from
`supabase/tests/0301_client_questionnaire_presentation.test.sql`, maps every
fixture UUID to valid random UUIDs (including UUIDs embedded in rule JSON),
and preserves existing native user/organization identities. It never executes
the SQL fixture's fabricated `auth.sessions` or JWT claims.

The portfolio scenario natively creates a site, project, task and exact MAD
budget draft, verifies persisted organization links and amounts through RLS,
and reloads entered Arabic labels. Its explicit TEST-only trial project quota
is not a production offer. Run it once per fresh fixture (site quota is one).

The dossier and document-scan rows are **historical SQL fixtures**. They do not
certify native compliance onboarding, physical file upload, real antivirus,
governed catalogue publication, electronic signature, PSP payment or the whole
purchase workflow. No real email or external integration is configured. The
canonical URL `https://matricia.test.invalid` satisfies canonical validation for
this local test only; it is not a published preview or a DNS validation.

All credentials, native sessions, dump and private state are in ignored
`work/client-browser-isolated/<run-uuid>/` with restrictive permissions. Never
commit them or print their contents. Default local app/gateway ports are
19173/19174; an occupied port must fail, not reuse another application.

After saving the nonsecret evidence, stop the two terminal processes with
Ctrl-C, then remove **only this run's** inspected containers/internal network:

```sh
APP_ENV=development node tests/e2e/helpers/client-isolated/cleanup.mjs
```

Private test files remain ignored for investigation and should be removed when
no longer needed. Cleanup never removes the source replay or shared services.

The quota race prepares a separate native organization and explicit TEST-only
cap of one site, launches two genuine authenticated SDK requests concurrently,
requires exactly one persisted grant and one quota refusal, and verifies
foreign-organization denial. Its temporary selected-actor/fixture changes are
restored in `finally`. Never run it concurrently with other harness commands.
A PostgreSQL deadlock fails the assertion even if only one site persists.

For the canonical source, run `APP_ENV=development node
tests/e2e/helpers/client-isolated/canonical-source.mjs`. Its retained manifest is
`work/canonical-acl-source/<uuid>/source-target.json`. This applies the complete
migration set to an owned no-network source; it is **setup only**, with no green
SQL test receipt. Restore into a fresh target using `restore.mjs`; restoration
recreates `postgres` from `template0` so image-default object ACLs cannot survive
the canonical dump. Inspect with `acl-fidelity.mjs <source-manifest>` before
actors/fixtures. `--align` may only match canonical grants when every object
definition and owner matches; arbitrary runtime grants are never admissible.

The historical 457-migration ACL receipt is retained separately from the current
458-migration inspection. Migration 37000 changes exactly three deferred
invariant guards to SECURITY DEFINER with `search_path=pg_catalog` and revokes
direct execution from PUBLIC/anon/authenticated/service_role. Source and target
guards, bodies and ACLs must match. It grants no ledger access. Full SQL test
receipts belong to the separate strict replay, not these browser helpers.
Run `guard-fidelity.mjs <source-manifest>` to reproduce the guard inspection.

After the Owner matrix, `prepare-buyer-box.mjs` prepares four separate genuine
GoTrue/TOTP actors: a plain Owner, a plain Buyer and two independent Finance
reviewers. Its staff-role and historical plan bootstrap is explicitly TEST-only;
commercial publication and governed staff onboarding are not certified. All Box
and benefit governance, independent reviews, subscription preparation, DEMO
payment callback, configured Box, canonical ten-credit grant and member limit
of three use the native commands. Never rerun this fixture on an already paid
cohort. If a callback fails, `resume-buyer-box.mjs` requires the preserved exact
DEMO event/intent/paid-at from its private trace; it does not invent a new payment.
The original 2026-11-02 callback was resumed and replayed without duplication.

Run `buyer-browser.mjs` against the ready funded cohort. It reserves through a
real keyboard UI Server Action, verifies used/available 0/3 → 3/0, rejects a
foreign cancellation, releases through touch, and polls the native read until
the committed cancellation restores 0/3. It also checks foreign workspace,
global wallet RLS and Admin RPC refusal. Polling avoids claiming an intermediate
UI transition as persisted business state.

Create a fresh draft through the native `start_questionnaire_session` RPC and
save only its session UUID in ignored `accessibility-draft.json`. Run
`accessibility.mjs --scope=all` for 32 axe scans: portfolio, actions, editable
questionnaire and funded Buyer envelope; FR/AR; 375/768; account menu closed/open
with keyboard. Tags are WCAG2 A/AA and WCAG2.1 A/AA; no rules are excluded.
Indeterminate contrast results are retained separately and never count as a
measured ratio of zero or a pass. `contrast-review.mjs` collects each affected
node's computed color, ancestor backgrounds/gradients, stacking information and
normal/background-only screenshots for a separate rendered contrast review.
These automated checks do not claim full manual WCAG certification.
After correction 236caf9, `contrast-review.mjs --caption-only` measures the
changed caption in all 32 route/locale/width/menu states. It captures the viewport
where every caption is visible. The earlier full review of 1,409 incomplete
nodes stays separate; it is not overwritten in committed evidence.
Run `python tests/e2e/helpers/client-isolated/contrast-pixels.py
work/client-browser-isolated/<uuid>/accessibility` with Python/Pillow/NumPy after the
review capture. It multiplies ancestor opacity, records filters/blend modes,
excludes clipped and menu-occluded pixels, and reports a conservative lower
bound across the actually rendered background under text ranges. Areas with no
visible samples, filters, clipping or occlusion remain separate review items.
The decorative aria-hidden brand initial has the logotype contrast exception.
An additional opaque-glyph measurement compares the normal screenshot with the
rendered background. It keeps pixels matching the composited text color within
two RGB levels and excludes antialias edges. This separates a white badge's
rectangle extending onto white canvas from its actual white-on-blue glyphs.
Unrendered text, clipped areas and menu-covered areas stay explicitly unmeasured.
