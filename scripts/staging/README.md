# Staging configuration preflight

This command checks configuration metadata before a hosted staging recipe. It makes no network request, changes no environment, and never prints secret values, provider responses, input paths or raw parse errors.

Run against the sanitized management-API inventory, with migration versions read from the current checkout:

```sh
node scripts/staging/preflight.mjs --inventory /absolute/path/inventory-redacted.json
```

The inventory is the read-only collector format: `requests` contains successful records with `kind=envs`, individual `kind=env` URL origins, `kind=auth`, and `kind=migrations`. The collector must use one Vercel project per file. Environment origins come from individual environment reads; encrypted listing ciphertext is not a configuration value. A `type=sensitive` binding remains present when the API masks its value.

For branch-specific Preview configuration:

```sh
node scripts/staging/preflight.mjs --inventory /absolute/path/inventory-redacted.json --branch staging --runtime /absolute/path/runtime-settings.json
```

`--runtime` supplies **observed non-secret settings only**, for example `APP_ENV`, `AUTH_EMAIL_OTP_LENGTH`, `PAYMENT_PROVIDER`, its allowlist and sandbox selector, external-delivery flags and endpoint allowlists. Use settings observed from the selected deployment, not desired settings, when assessing that deployment. Never put API keys, passwords, webhook secrets, full process environments or database credentials in this file. Unobserved values remain `UNVERIFIED`; they are not inferred from a variable name.

To include a separately hosted worker, use `--snapshot` instead of `--inventory`. The exported `snapshotFromInventory(inventory, runtime)` returns this normalized snapshot; add `worker.bindings` (names and masked-presence metadata), `worker.nodeVersion` (observed full Node22 version), `worker.runtime` (non-secret worker and ClamAV settings), and the worker's `NEXT_PUBLIC_SUPABASE_URL` binding `configuredOrigin`. Worker bindings must include `MALWARE_SCANNER_TOKEN` in addition to service-role and webhook credentials, but no worker secret value is required. ClamAV requires `CLAMAV_HOST`, `CLAMAV_ALLOWED_HOSTS`, `CLAMAV_NETWORK_MODE` and `CLAMAV_ENGINE_VERSION`; the observed non-secret values must be supplied in `worker.runtime`. A normalized snapshot has:

```text
schemaVersion: 1
bindings: Vercel environment metadata, including target and optional gitBranch
runtime: observed non-secret settings
auth: sanitized Auth settings, including SMTP-presence booleans
authProjectRef: reference of the Auth project actually queried
appliedMigrations: applied version strings
migrationInventoryObserved: true only after a successful migration listing
production: appOrigin and supabaseUrl when production baseline is supplied separately
worker: separately hosted worker metadata, nodeVersion, and observed non-secret runtime settings
```

The checks require an HTTPS staging origin and a distinct Supabase project from production, matching Auth project/site URL/FR-AR callbacks, matching provider/UI OTP lengths, SMTP configuration, TOTP availability, secret bindings for cron/outbox/invitations, and complete external email/payment/scanner/signature configuration. Payment DEMO and scanner/email simulation modes are refused for the hosted staging check. YouSign is restricted to its sandbox selector. The worker must use Node22, the staging backend and dispatch to the staging application. Every migration filename in the selected migration directory must have an applied version.

ClamAV's TCP address must be on its exact host allowlist and private for `PRIVATE` mode or loopback for `LOCAL` mode. For a DNS host, supply observed `worker.clamavResolution` metadata as `{ "host": "the configured hostname", "addresses": ["each resolved private address"] }`; an omitted or mismatching observation is `UNVERIFIED`, and any public address fails. The preflight does not perform DNS requests. The runtime still re-resolves and pins the actual address for each connection. The engine setting must be an exact version pin; optional port, timeout, chunk size and signature-database age settings must satisfy the runtime bounds. Native VERSION evidence, actual database freshness, scanner-token validity and the matching web/worker secret remain separate runtime checks, never inferred from these metadata.

Options:

- `--inventory FILE` or `--snapshot FILE`: exactly one input.
- `--runtime FILE`: optional additional observed non-secret settings for the selected deployment.
- `--target preview|development`: defaults to `preview`; production is rejected.
- `--branch NAME`: select exact branch-specific overrides before unscoped Preview bindings.
- `--migration-dir DIRECTORY`: defaults to this checkout's `supabase/migrations`.

Exit status is `0` only when all configuration checks pass, `1` for failures/unverified observations, and `2` for invalid or unreadable input. Output is JSON with fixed finding codes and known configuration key names. Use the JSON verdict as a configuration gate, never as production certification: secret validity, live delivery, native scanning, contract governance, Storage/RLS isolation, two distinct enrolled AAL2 admins, and release approvals require their own evidence.

Tests:

```sh
node --test scripts/staging/preflight.test.mjs
```
