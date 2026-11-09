import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshotFromInventory, validateStagingConfiguration } from './preflight.mjs';

const runFile = promisify(execFile);
const stageRef = 's'.repeat(20), prodRef = 'p'.repeat(20);
const stageOrigin = 'https://stage.example.com';
const options = { requiredMigrationVersions: ['20260101000100', '20260101000200'] };
const binding = (key, configuredValue, more = {}) => ({ key, type: 'encrypted', target: ['preview'], storedValuePresent: true, ...(configuredValue !== undefined ? { configuredValue } : {}), ...more });
const masked = key => binding(key, undefined, { type: 'sensitive', storedValuePresent: false });
const codes = report => report.findings.map(finding => finding.code);
function complete() {
  const bindings = [
    binding('APP_ENV', 'staging'), binding('NEXT_PUBLIC_APP_URL', undefined, { configuredOrigin: stageOrigin }),
    binding('STAGING_SUPABASE_PROJECT_REF', stageRef), binding('PRODUCTION_SUPABASE_PROJECT_REF', prodRef),
    binding('NEXT_PUBLIC_SUPABASE_URL', undefined, { configuredOrigin: `https://${stageRef}.supabase.co` }),
    binding('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), masked('SUPABASE_SERVICE_ROLE_KEY'), masked('CRON_SECRET'), masked('INTERNAL_WEBHOOK_SECRET'), masked('APP_ENCRYPTION_KEY'),
    binding('AUTH_EMAIL_OTP_LENGTH', '8'), binding('EMAIL_DELIVERY_MODE', 'EXTERNAL'), binding('EMAIL_LIVE_DELIVERY_ENABLED', 'true'), binding('EMAIL_RECIPIENT_ALLOWLIST', 'qa@example.com'),
    masked('RESEND_API_KEY'), binding('RESEND_FROM_EMAIL'), masked('RESEND_WEBHOOK_SECRET'),
    binding('PAYMENT_PROVIDER', 'PAYPAL'), binding('PAYMENT_PROVIDER_ALLOWLIST', 'PAYPAL'), binding('PAYMENT_LIVE_ENABLED', 'true'), binding('PAYPAL_ENV', 'sandbox'),
    ...['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'PAYPAL_WEBHOOK_CERT_URL', 'PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64', 'PAYPAL_ALLOWED_CURRENCIES'].map(masked),
    binding('MALWARE_SCANNER_URL', 'https://scanner.example.com/scan'), binding('MALWARE_SCANNER_ALLOWED_HOSTS', 'scanner.example.com'), masked('MALWARE_SCANNER_TOKEN'), binding('DELIVERY_PROOF_SCANNER_MODE', 'EXTERNAL'),
    binding('SIGNATURE_PROVIDER_MODE', 'EXTERNAL'), binding('SIGNATURE_PROVIDER_CODE', 'YOUSIGN'), masked('YOUSIGN_API_KEY'), masked('YOUSIGN_WEBHOOK_SECRET'), binding('YOUSIGN_ENVIRONMENT', 'sandbox'),
  ];
  return {
    schemaVersion: 1, bindings, production: { appOrigin: 'https://app.example.com', supabaseUrl: `https://${prodRef}.supabase.co` },
    authProjectRef: stageRef,
    auth: { site_url: stageOrigin, uri_allow_list: `${stageOrigin}/fr/auth/callback,${stageOrigin}/ar/auth/callback`, mailer_otp_length: 8, smtpCredentialsConfigured: true, smtp_host: 'smtp.example.com', otpTemplateUsesToken: true, mfa_totp_enroll_enabled: true, mfa_totp_verify_enabled: true },
    appliedMigrations: ['20260101000100', '20260101000200'], migrationInventoryObserved: true,
    worker: {
      nodeVersion: '22.23.4',
      bindings: [binding('APP_ENV'), binding('NEXT_PUBLIC_SUPABASE_URL', undefined, { configuredOrigin: `https://${stageRef}.supabase.co` }), binding('SUPABASE_PROJECT_REF'), masked('SUPABASE_SERVICE_ROLE_KEY'), binding('WORKER_DISPATCH_URL'), binding('WORKER_DISPATCH_ALLOWED_HOSTS'), masked('INTERNAL_WEBHOOK_SECRET'), masked('MALWARE_SCANNER_TOKEN'), binding('CLAMAV_HOST'), binding('CLAMAV_ALLOWED_HOSTS'), binding('CLAMAV_NETWORK_MODE'), binding('CLAMAV_ENGINE_VERSION')],
      runtime: { APP_ENV: 'staging', SUPABASE_PROJECT_REF: stageRef, WORKER_DISPATCH_URL: `${stageOrigin}/api/internal/outbox`, WORKER_DISPATCH_ALLOWED_HOSTS: 'stage.example.com', CLAMAV_HOST: '10.20.30.40', CLAMAV_ALLOWED_HOSTS: '10.20.30.40', CLAMAV_NETWORK_MODE: 'PRIVATE', CLAMAV_ENGINE_VERSION: '1.4.3' },
    },
  };
}
const remove = (snapshot, name) => { snapshot.bindings = snapshot.bindings.filter(row => row.key !== name); };
const set = (snapshot, key, value) => { snapshot.bindings.find(row => row.key === key).configuredValue = value; };

test('complete isolated sandbox configuration passes metadata check with masked sensitive bindings', () => {
  const report = validateStagingConfiguration(complete(), options);
  assert.equal(report.passed, true, JSON.stringify(report));
  assert.equal(report.verification, 'CONFIGURATION_METADATA_ONLY');
  assert.ok(report.limitations.some(item => item.includes('certification')));
});

test('detects a provider-issued 8 digit OTP when absent UI setting falls back to 6', () => {
  const snapshot = complete(); remove(snapshot, 'AUTH_EMAIL_OTP_LENGTH');
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('AUTH_OTP_LENGTH_MISMATCH'));
});

test('existing OTP binding with redacted value remains unverified rather than assumed correct', () => {
  const snapshot = complete(); delete snapshot.bindings.find(row => row.key === 'AUTH_EMAIL_OTP_LENGTH').configuredValue;
  const report = validateStagingConfiguration(snapshot, options);
  assert.equal(report.passed, false);
  assert.deepEqual(report.findings.find(row => row.code === 'RUNTIME_VALUE_UNOBSERVED')?.fields, ['AUTH_EMAIL_OTP_LENGTH']);
  assert.ok(!codes(report).includes('AUTH_OTP_LENGTH_MISMATCH'));
});

test('shared production backend and app origins fail isolation even with APP_ENV staging', () => {
  const snapshot = complete();
  snapshot.production = { appOrigin: stageOrigin, supabaseUrl: `https://${stageRef}.supabase.co` };
  const report = validateStagingConfiguration(snapshot, options);
  assert.ok(codes(report).includes('STAGING_APP_ORIGIN_SHARED_WITH_PRODUCTION'));
  assert.ok(codes(report).includes('STAGING_SUPABASE_SHARED_WITH_PRODUCTION'));
});

for (const key of ['STAGING_SUPABASE_PROJECT_REF', 'PRODUCTION_SUPABASE_PROJECT_REF']) {
  test(`Preview isolation requires the ${key} binding`, () => {
    const snapshot = complete(); remove(snapshot, key);
    const missing = validateStagingConfiguration(snapshot, options).findings.find(row => row.code === 'PREVIEW_REFERENCE_CONFIGURATION_MISSING');
    assert.deepEqual(missing?.fields, [key]);
  });
}

test('Preview references must be observed, exact lowercase 20-character values and distinct', () => {
  let snapshot = complete(); set(snapshot, 'STAGING_SUPABASE_PROJECT_REF', prodRef);
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('PREVIEW_DATABASE_REFERENCES_NOT_DISTINCT'));
  for (const reference of ['invalid', stageRef.toUpperCase(), ` ${stageRef}`, `${stageRef} `]) {
    snapshot = complete(); set(snapshot, 'STAGING_SUPABASE_PROJECT_REF', reference);
    assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('PREVIEW_DATABASE_REFERENCE_INVALID'), reference);
  }
  snapshot = complete(); delete snapshot.bindings.find(row => row.key === 'PRODUCTION_SUPABASE_PROJECT_REF').configuredValue;
  const report = validateStagingConfiguration(snapshot, options);
  assert.equal(report.passed, false);
  assert.ok(report.findings.some(row => row.code === 'PREVIEW_DATABASE_REFERENCES_UNOBSERVED' && row.status === 'UNVERIFIED'));
});

test('Preview reference declarations must match both selected staging backend and observed production baseline', () => {
  const snapshot = complete(); set(snapshot, 'STAGING_SUPABASE_PROJECT_REF', 't'.repeat(20)); set(snapshot, 'PRODUCTION_SUPABASE_PROJECT_REF', 'q'.repeat(20));
  const found = codes(validateStagingConfiguration(snapshot, options));
  assert.ok(found.includes('PREVIEW_STAGING_REFERENCE_MISMATCH'));
  assert.ok(found.includes('PREVIEW_PRODUCTION_REFERENCE_MISMATCH'));
});

test('Preview-only reference bindings do not impose a build policy on the development target', () => {
  const snapshot = complete(); remove(snapshot, 'STAGING_SUPABASE_PROJECT_REF'); remove(snapshot, 'PRODUCTION_SUPABASE_PROJECT_REF');
  snapshot.bindings = snapshot.bindings.map(row => ({ ...row, target: ['development'] }));
  assert.equal(validateStagingConfiguration(snapshot, { ...options, target: 'development' }).passed, true);
});

test('missing production baseline cannot produce a passing staging verdict', () => {
  const snapshot = complete(); delete snapshot.production;
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('PRODUCTION_BASELINE_UNOBSERVED'));
});

test('a non-Supabase production URL cannot establish backend isolation', () => {
  const snapshot = complete(); snapshot.production.supabaseUrl = 'https://not-a-supabase-project.example.com';
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('PRODUCTION_BASELINE_UNOBSERVED'));
});

test('branch preview overrides are resolved without changing production baseline', () => {
  const snapshot = complete();
  snapshot.bindings = snapshot.bindings.map(row => ({ ...row, target: ['production', 'preview'] }));
  snapshot.bindings.find(row => row.key === 'NEXT_PUBLIC_APP_URL').configuredOrigin = 'https://app.example.com';
  snapshot.bindings.find(row => row.key === 'NEXT_PUBLIC_SUPABASE_URL').configuredOrigin = `https://${prodRef}.supabase.co`;
  snapshot.bindings.push(binding('NEXT_PUBLIC_APP_URL', undefined, { gitBranch: 'staging-fix', configuredOrigin: stageOrigin }), binding('NEXT_PUBLIC_SUPABASE_URL', undefined, { gitBranch: 'staging-fix', configuredOrigin: `https://${stageRef}.supabase.co` }));
  assert.equal(validateStagingConfiguration(snapshot, { ...options, branch: 'staging-fix' }).passed, true);
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('STAGING_SUPABASE_SHARED_WITH_PRODUCTION'));
});

test('Auth project, callback origins, SMTP and TOTP must match staging configuration', () => {
  const snapshot = complete(); snapshot.authProjectRef = prodRef;
  Object.assign(snapshot.auth, { site_url: 'https://old.example.com', uri_allow_list: 'https://old.example.com/fr/auth/callback', smtpCredentialsConfigured: false, mfa_totp_verify_enabled: false });
  const found = codes(validateStagingConfiguration(snapshot, options));
  for (const code of ['AUTH_PROJECT_MISMATCH', 'AUTH_SITE_URL_MISMATCH', 'AUTH_CALLBACKS_MISSING', 'AUTH_SMTP_NOT_CONFIGURED', 'AUTH_TOTP_DISABLED']) assert.ok(found.includes(code), code);
});

test('cron and invitation keys need bindings while masked service roles count as present', () => {
  const snapshot = complete(); remove(snapshot, 'CRON_SECRET'); remove(snapshot, 'APP_ENCRYPTION_KEY');
  const missing = validateStagingConfiguration(snapshot, options).findings.find(row => row.code === 'WEB_CONFIGURATION_MISSING');
  assert.deepEqual(missing.fields, ['CRON_SECRET', 'APP_ENCRYPTION_KEY']);
});

test('external sandbox payments reject demo, live credentials and non-allowlisted providers', () => {
  const snapshot = complete(); set(snapshot, 'PAYMENT_PROVIDER_ALLOWLIST', 'CMI'); set(snapshot, 'PAYPAL_ENV', 'live');
  let found = codes(validateStagingConfiguration(snapshot, options));
  assert.ok(found.includes('PAYMENT_PROVIDER_NOT_ALLOWLISTED'));
  assert.ok(found.includes('PAYPAL_SANDBOX_REQUIRED'));
  set(snapshot, 'PAYMENT_PROVIDER', 'DEMO');
  found = codes(validateStagingConfiguration(snapshot, options));
  assert.ok(found.includes('PAYMENT_EXTERNAL_SANDBOX_REQUIRED'));
});

test('payment provider allowlist rejects unknown entries even when selected provider is present', () => {
  const snapshot = complete(); set(snapshot, 'PAYMENT_PROVIDER_ALLOWLIST', 'PAYPAL,BOGUS');
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('PAYMENT_PROVIDER_ALLOWLIST_INVALID'));
});

test('CMI sandbox is supported with complete gateway allowlist configuration', () => {
  const snapshot = complete(); set(snapshot, 'PAYMENT_PROVIDER', 'CMI'); set(snapshot, 'PAYMENT_PROVIDER_ALLOWLIST', 'CMI');
  snapshot.bindings.push(binding('CMI_ENV', 'demo'), masked('CMI_MERCHANT_ID'), masked('CMI_STORE_KEY'), binding('CMI_GATEWAY_URL', 'https://sandbox-payment.example.com/pay'), binding('CMI_GATEWAY_ALLOWED_HOSTS', 'sandbox-payment.example.com'));
  assert.equal(validateStagingConfiguration(snapshot, options).passed, true);
});

test('scanner, email and signature cannot rely on demo modes or an unallowlisted target', () => {
  const snapshot = complete(); set(snapshot, 'EMAIL_DELIVERY_MODE', 'DEMO'); set(snapshot, 'DELIVERY_PROOF_SCANNER_MODE', 'SANDBOX'); set(snapshot, 'SIGNATURE_PROVIDER_MODE', 'MOCK'); set(snapshot, 'MALWARE_SCANNER_ALLOWED_HOSTS', '*');
  const found = codes(validateStagingConfiguration(snapshot, options));
  for (const code of ['EMAIL_EXTERNAL_REQUIRED', 'SCANNER_EXTERNAL_REQUIRED', 'SIGNATURE_EXTERNAL_REQUIRED', 'ENDPOINT_NOT_ALLOWLISTED']) assert.ok(found.includes(code), code);
});

test('generic HTTP email transport requires a literal global IP matching its runtime policy', () => {
  const snapshot = complete(); remove(snapshot, 'RESEND_API_KEY'); remove(snapshot, 'RESEND_FROM_EMAIL'); remove(snapshot, 'RESEND_WEBHOOK_SECRET');
  snapshot.bindings.push(binding('EMAIL_PROVIDER_ENDPOINT', 'https://mailer.example.com/send'), binding('EMAIL_PROVIDER_ENDPOINT_ALLOWLIST', 'https://mailer.example.com/send'), masked('EMAIL_PROVIDER_TOKEN'));
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('EMAIL_HTTP_PUBLIC_IP_REQUIRED'));
  for (const address of ['127.0.0.1', '[::ffff:127.0.0.1]', '192.0.2.1', '198.18.0.1', '[2001:db8::1]']) {
    set(snapshot, 'EMAIL_PROVIDER_ENDPOINT', `https://${address}/send`); set(snapshot, 'EMAIL_PROVIDER_ENDPOINT_ALLOWLIST', `https://${address}/send`);
    assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('EMAIL_HTTP_PUBLIC_IP_REQUIRED'), address);
  }
  set(snapshot, 'EMAIL_PROVIDER_ENDPOINT', 'https://8.8.8.8/send'); set(snapshot, 'EMAIL_PROVIDER_ENDPOINT_ALLOWLIST', 'https://8.8.8.8/send');
  assert.equal(validateStagingConfiguration(snapshot, options).passed, true);
});

test('unknown or missing migration metadata fails closed; every required version is compared', () => {
  const snapshot = complete(); snapshot.appliedMigrations = ['20260101000200'];
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('MIGRATIONS_MISSING'));
  snapshot.migrationInventoryObserved = false;
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('MIGRATION_INVENTORY_UNOBSERVED'));
  assert.ok(codes(validateStagingConfiguration(complete())).includes('REQUIRED_MIGRATIONS_UNOBSERVED'));
});

test('worker project and dispatch must match staging and worker inventory cannot be omitted', () => {
  const snapshot = complete(); snapshot.worker.runtime.SUPABASE_PROJECT_REF = prodRef; snapshot.worker.runtime.WORKER_DISPATCH_URL = 'https://app.example.com/api/internal/outbox';
  let found = codes(validateStagingConfiguration(snapshot, options));
  assert.ok(found.includes('WORKER_PROJECT_MISMATCH')); assert.ok(found.includes('WORKER_DISPATCH_TARGET_INVALID'));
  delete snapshot.worker;
  found = codes(validateStagingConfiguration(snapshot, options)); assert.ok(found.includes('WORKER_CONFIGURATION_UNOBSERVED'));
});

test('worker dispatch allowlist rejects wildcards and duplicates that prevent worker startup', () => {
  const snapshot = complete();
  for (const hosts of ['stage.example.com,*', 'stage.example.com,stage.example.com']) {
    snapshot.worker.runtime.WORKER_DISPATCH_ALLOWED_HOSTS = hosts;
    assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_DISPATCH_TARGET_INVALID'));
  }
});

for (const key of ['MALWARE_SCANNER_TOKEN', 'CLAMAV_HOST', 'CLAMAV_ALLOWED_HOSTS', 'CLAMAV_NETWORK_MODE', 'CLAMAV_ENGINE_VERSION']) {
  test(`worker startup requires the ${key} binding`, () => {
    const snapshot = complete(); snapshot.worker.bindings = snapshot.worker.bindings.filter(row => row.key !== key);
    const missing = validateStagingConfiguration(snapshot, options).findings.find(row => row.code === 'WORKER_CONFIGURATION_MISSING');
    assert.deepEqual(missing?.fields, [key]);
  });
}

test('worker scanner credentials remain presence-only and their masked values are never required', () => {
  const snapshot = complete();
  const scanner = snapshot.worker.bindings.find(row => row.key === 'MALWARE_SCANNER_TOKEN');
  assert.equal(scanner.storedValuePresent, false);
  assert.equal(scanner.type, 'sensitive');
  assert.equal(validateStagingConfiguration(snapshot, options).passed, true);
});

test('worker Node version must be observed and stay within Node22', () => {
  const snapshot = complete(); delete snapshot.worker.nodeVersion;
  let report = validateStagingConfiguration(snapshot, options);
  assert.ok(codes(report).includes('WORKER_NODE_VERSION_UNOBSERVED'));
  assert.equal(report.findings.find(row => row.code === 'WORKER_NODE_VERSION_UNOBSERVED').status, 'UNVERIFIED');
  for (const version of ['20.19.0', '24.13.0', '26.0.0', '22.x']) {
    snapshot.worker.nodeVersion = version;
    assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_NODE_VERSION_UNSUPPORTED'), version);
  }
  snapshot.worker.nodeVersion = 'v22.23.4';
  assert.equal(validateStagingConfiguration(snapshot, options).passed, true);
});

test('worker ClamAV nonsecret values must be observed even when their bindings are present', () => {
  for (const key of ['CLAMAV_HOST', 'CLAMAV_ALLOWED_HOSTS', 'CLAMAV_NETWORK_MODE', 'CLAMAV_ENGINE_VERSION']) {
    const snapshot = complete(); delete snapshot.worker.runtime[key];
    const report = validateStagingConfiguration(snapshot, options);
    assert.equal(report.passed, false);
    assert.ok(report.findings.some(row => row.code === 'WORKER_CLAMAV_VALUES_UNOBSERVED' && row.status === 'UNVERIFIED' && row.fields.includes(key)), key);
  }
});

test('ClamAV allowlist must be well formed, contain its host and not have duplicate entries', () => {
  for (const allowed of ['', '*', '10.20.30.41', '10.20.30.40,10.20.30.40', '10.20.30.40,https://clamav.internal']) {
    const snapshot = complete(); snapshot.worker.runtime.CLAMAV_ALLOWED_HOSTS = allowed;
    assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_CLAMAV_ALLOWLIST_INVALID'), allowed);
  }
});

test('ClamAV host and network mode reject malformed targets and public native TCP endpoints', () => {
  for (const host of ['https://clamav.internal', 'clamav.internal/scan', 'clamav .internal']) {
    const snapshot = complete(); snapshot.worker.runtime.CLAMAV_HOST = host; snapshot.worker.runtime.CLAMAV_ALLOWED_HOSTS = host;
    assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_CLAMAV_HOST_INVALID'), host);
  }
  for (const address of ['8.8.8.8', '169.254.169.254', '100.64.0.1', '2001:4860:4860::8888', '::ffff:10.0.0.1']) {
    const snapshot = complete(); snapshot.worker.runtime.CLAMAV_HOST = address; snapshot.worker.runtime.CLAMAV_ALLOWED_HOSTS = address;
    assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_CLAMAV_ADDRESS_NOT_PRIVATE'), address);
  }
  const snapshot = complete(); snapshot.worker.runtime.CLAMAV_NETWORK_MODE = 'PUBLIC';
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_CLAMAV_NETWORK_MODE_INVALID'));
});

test('ClamAV DNS metadata must match its host and every resolved address must be private', () => {
  const snapshot = complete(); snapshot.worker.runtime.CLAMAV_HOST = 'clamav.internal'; snapshot.worker.runtime.CLAMAV_ALLOWED_HOSTS = 'clamav.internal';
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_CLAMAV_DNS_UNOBSERVED'));
  snapshot.worker.clamavResolution = { host: 'another.internal', addresses: ['10.0.0.4'] };
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_CLAMAV_DNS_UNOBSERVED'));
  snapshot.worker.clamavResolution = { host: 'clamav.internal', addresses: ['10.0.0.4', '8.8.8.8'] };
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_CLAMAV_ADDRESS_NOT_PRIVATE'));
  snapshot.worker.clamavResolution.addresses = ['10.0.0.4', 'fd00::1'];
  assert.equal(validateStagingConfiguration(snapshot, options).passed, true);
});

test('LOCAL ClamAV accepts loopback and refuses nonloopback private addresses', () => {
  const snapshot = complete(); snapshot.worker.runtime.CLAMAV_NETWORK_MODE = 'LOCAL';
  assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_CLAMAV_ADDRESS_NOT_PRIVATE'));
  for (const address of ['127.0.0.1', '::1']) {
    snapshot.worker.runtime.CLAMAV_HOST = address; snapshot.worker.runtime.CLAMAV_ALLOWED_HOSTS = address;
    assert.equal(validateStagingConfiguration(snapshot, options).passed, true, address);
  }
});

test('ClamAV requires an exact engine version pin instead of a wildcard or stale attestation string', () => {
  for (const pin of ['', '*', 'latest', '1.4', '1.4.3/db:123@2026-11-09', '1.4.3-' + 'a'.repeat(80)]) {
    const snapshot = complete(); snapshot.worker.runtime.CLAMAV_ENGINE_VERSION = pin;
    assert.ok(codes(validateStagingConfiguration(snapshot, options)).includes('WORKER_CLAMAV_ENGINE_PIN_INVALID'), pin);
  }
});

test('ClamAV optional settings use runtime bounds and unknown bound values remain unverified', () => {
  for (const [key, invalid] of [['CLAMAV_PORT', '0'], ['CLAMAV_PORT', '65536'], ['CLAMAV_TIMEOUT_MS', '99'], ['CLAMAV_TIMEOUT_MS', '120001'], ['CLAMAV_CHUNK_BYTES', '1023'], ['CLAMAV_CHUNK_BYTES', '1048577'], ['CLAMAV_MAX_DATABASE_AGE_HOURS', '0'], ['CLAMAV_MAX_DATABASE_AGE_HOURS', '169'], ['PORT', '8080x'], ['PORT', ' 8080 ']]) {
    const snapshot = complete(); snapshot.worker.bindings.push(binding(key)); snapshot.worker.runtime[key] = invalid;
    assert.ok(validateStagingConfiguration(snapshot, options).findings.some(row => row.code === 'WORKER_NUMERIC_SETTING_INVALID' && row.fields.includes(key)), `${key}:${invalid}`);
  }
  const snapshot = complete(); snapshot.worker.bindings.push(binding('CLAMAV_PORT'));
  assert.ok(validateStagingConfiguration(snapshot, options).findings.some(row => row.code === 'WORKER_CLAMAV_VALUES_UNOBSERVED' && row.fields.includes('CLAMAV_PORT')));
  snapshot.worker.runtime.CLAMAV_PORT = '3310'; snapshot.worker.runtime.CLAMAV_MAX_DATABASE_AGE_HOURS = ' ';
  assert.equal(validateStagingConfiguration(snapshot, options).passed, true);
});

test('inventory adapter merges individual decrypted origins and never uses a masked sensitive value as absence', () => {
  const raw = { requests: [
    { kind: 'envs', status: 200, path: '/v10/projects/project-a/env', data: { envs: [{ id: 'one', ...binding('NEXT_PUBLIC_APP_URL', undefined, { configuredOrigin: 'https://ciphertext' }) }, masked('SUPABASE_SERVICE_ROLE_KEY')] } },
    { kind: 'env', status: 200, path: '/v1/projects/project-a/env/one', data: { envs: [{ id: 'one', key: 'NEXT_PUBLIC_APP_URL', target: ['preview'], configuredOrigin: stageOrigin }] } },
    { kind: 'auth', status: 200, path: `/v1/projects/${stageRef}/config/auth`, data: { mailer_otp_length: 8 } },
    { kind: 'migrations', status: 200, path: `/v1/projects/${stageRef}/database/migrations`, data: { migrations: [{ version: '20260101000100' }] } },
    { kind: 'auth', status: 403, path: '/untrusted', data: { mailer_otp_length: 6 } },
  ] };
  const normalized = snapshotFromInventory(raw);
  assert.equal(normalized.bindings[0].configuredOrigin, stageOrigin);
  assert.equal(normalized.auth.mailer_otp_length, 8);
  assert.deepEqual(normalized.appliedMigrations, ['20260101000100']);
  assert.equal(normalized.authProjectRef, stageRef);
  const missing = validateStagingConfiguration(normalized, options).findings.find(row => row.code === 'WEB_CONFIGURATION_MISSING');
  assert.ok(!missing.fields.includes('SUPABASE_SERVICE_ROLE_KEY'));
});

test('an inventory with environment reads from multiple Vercel projects is rejected', () => {
  const raw = { requests: ['project-a', 'project-b'].map(name => ({ kind: 'envs', status: 200, path: `/v10/projects/${name}/env`, data: { envs: [] } })) };
  assert.ok(codes(validateStagingConfiguration(snapshotFromInventory(raw), options)).includes('INVENTORY_PROJECT_AMBIGUOUS'));
});

test('report never includes arbitrary env values, names, exception snippets or input paths', async () => {
  const canary = 'DO-NOT-EMIT-SECRET-CANARY';
  const snapshot = complete(); snapshot.bindings.push({ key: canary, value: canary });
  set(snapshot, 'PAYMENT_PROVIDER', canary);
  assert.ok(!JSON.stringify(validateStagingConfiguration(snapshot, options)).includes(canary));
  const dir = await mkdtemp(join(tmpdir(), 'matricia-preflight-'));
  try {
    const path = join(dir, `${canary}.json`); await writeFile(path, `{ broken-json-${canary}`);
    const script = fileURLToPath(new URL('./preflight.mjs', import.meta.url));
    const failed = await runFile(process.execPath, [script, '--snapshot', path]).catch(error => error);
    assert.equal(failed.code, 2);
    assert.deepEqual(JSON.parse(failed.stdout), { passed: false, error: 'STAGING_PREFLIGHT_INPUT_INVALID' });
    assert.equal(failed.stderr, ''); assert.ok(!failed.stdout.includes(canary));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI emits configuration metadata verdict and correct exit status without any network calls', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'matricia-preflight-'));
  try {
    const path = join(dir, 'snapshot.json'), migrations = join(dir, 'migrations');
    await mkdir(migrations);
    await writeFile(join(migrations, '20260101000100_first.sql'), 'select 1;');
    await writeFile(join(migrations, '20260101000200_second.sql'), 'select 1;');
    await writeFile(path, JSON.stringify(complete()));
    const script = fileURLToPath(new URL('./preflight.mjs', import.meta.url));
    const passed = await runFile(process.execPath, [script, '--snapshot', path, '--migration-dir', migrations]);
    assert.equal(JSON.parse(passed.stdout).passed, true);
    const bad = complete(); remove(bad, 'AUTH_EMAIL_OTP_LENGTH'); await writeFile(path, JSON.stringify(bad));
    const failed = await runFile(process.execPath, [script, '--snapshot', path, '--migration-dir', migrations]).catch(error => error);
    assert.equal(failed.code, 1); assert.ok(codes(JSON.parse(failed.stdout)).includes('AUTH_OTP_LENGTH_MISMATCH'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
