#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isIP } from 'node:net';

const NAME = /^[A-Z][A-Z0-9_]{0,99}$/u;
const TARGETS = new Set(['preview', 'development']);
const VALUES = new Set([
  'APP_ENV', 'AUTH_EMAIL_OTP_LENGTH', 'PAYMENT_PROVIDER', 'PAYMENT_PROVIDER_ALLOWLIST', 'PAYMENT_LIVE_ENABLED',
  'PAYPAL_ENV', 'CMI_ENV', 'CMI_GATEWAY_URL', 'CMI_GATEWAY_ALLOWED_HOSTS', 'EMAIL_DELIVERY_MODE',
  'EMAIL_LIVE_DELIVERY_ENABLED', 'EMAIL_RECIPIENT_ALLOWLIST', 'EMAIL_PROVIDER_ENDPOINT', 'EMAIL_PROVIDER_ENDPOINT_ALLOWLIST',
  'MALWARE_SCANNER_URL', 'MALWARE_SCANNER_ALLOWED_HOSTS', 'DELIVERY_PROOF_SCANNER_MODE',
  'SIGNATURE_PROVIDER_MODE', 'SIGNATURE_PROVIDER_CODE', 'YOUSIGN_ENVIRONMENT',
  'SUPABASE_PROJECT_REF', 'WORKER_DISPATCH_URL', 'WORKER_DISPATCH_ALLOWED_HOSTS',
]);
const list = value => Array.isArray(value) ? value : [];
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const string = value => typeof value === 'string' ? value : '';

function httpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) return null;
    return url;
  } catch { return null; }
}
const origin = value => httpsUrl(value)?.origin ?? null;
const projectRef = value => httpsUrl(value)?.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/u)?.[1] ?? null;

// Same literal-address restrictions as the generic HTTP notification transport.
function publicAddress(raw) {
  const address = raw.toLowerCase().replace(/^\[|\]$/gu, '');
  if (address.startsWith('::ffff:')) {
    const mapped = address.slice(7);
    if (isIP(mapped) === 4) return publicAddress(mapped);
    const groups = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u);
    if (!groups) return false;
    const high = Number.parseInt(groups[1], 16), low = Number.parseInt(groups[2], 16);
    return publicAddress(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168 || b === 2 || b === 88 && c === 99))
      || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) !== 6) return false;
  const groups = address.split(':'), first = Number.parseInt(groups[0] || '0', 16), second = Number.parseInt(groups[1] || '0', 16);
  return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && first !== 0x3fff
    && !(first === 0x2001 && (second < 0x0200 || second === 0x0db8));
}

function bindingPresent(binding) {
  if (binding.present === false) return false;
  // Vercel intentionally returns no value for sensitive bindings, including on a decrypted listing.
  if (binding.type === 'sensitive' || binding.valueVisibility === 'MASKED_BY_API') return true;
  return binding.storedValuePresent !== false;
}

function safeBinding(binding) {
  return {
    id: binding.id, key: string(binding.key), target: list(binding.target), gitBranch: binding.gitBranch ?? null,
    type: binding.type, present: binding.present, storedValuePresent: binding.storedValuePresent,
    valueVisibility: binding.valueVisibility, configuredOrigin: binding.configuredOrigin,
    configuredValue: VALUES.has(binding.key) ? binding.configuredValue : undefined,
  };
}

/** Adapt the read-only API collector output. Ignore raw response values and unsuccessful requests. */
export function snapshotFromInventory(inventory, runtime = {}) {
  const reads = list(object(inventory).requests).filter(row => row.status === 200);
  const latest = kind => reads.filter(row => row.kind === kind).at(-1);
  const bindings = list(latest('envs')?.data?.envs).map(safeBinding);
  for (const row of reads.filter(row => row.kind === 'env')) {
    for (const entry of list(row.data?.envs)) {
      const binding = bindings.find(item => item.key === entry.key && item.id === entry.id)
        ?? bindings.find(item => item.key === entry.key && JSON.stringify(item.target) === JSON.stringify(list(entry.target)) && item.gitBranch === (entry.gitBranch ?? null));
      if (binding && origin(entry.configuredOrigin)) binding.configuredOrigin = origin(entry.configuredOrigin);
    }
  }
  const authRead = latest('auth');
  const authRef = string(authRead?.path).match(/^\/v1\/projects\/([a-z0-9]{20})\/config\/auth$/u)?.[1] ?? null;
  const migrations = reads.filter(row => row.kind === 'migrations' && (!authRef || string(row.path).startsWith(`/v1/projects/${authRef}/`))).at(-1);
  return {
    schemaVersion: 1, bindings, auth: authRead?.data ?? null, authProjectRef: authRef,
    appliedMigrations: list(migrations?.data?.migrations).map(row => row.version),
    migrationInventoryObserved: Boolean(migrations), runtime: object(runtime),
    inventoryProjectAmbiguous: new Set(reads.filter(row => ['env', 'envs'].includes(row.kind)).map(row => string(row.path).match(/^\/v\d+\/projects\/([^/?]+)\/env/u)?.[1]).filter(Boolean)).size > 1,
  };
}

/** Configuration metadata is a prerequisite, never proof of a working external service or release approval. */
export function validateStagingConfiguration(input, options = {}) {
  const snapshot = object(input), target = options.target ?? 'preview', branch = options.branch ?? null;
  const findings = [];
  const add = (code, fields = [], status = 'FAIL') => findings.push({ code, status, fields });
  if (!TARGETS.has(target)) {
    add('STAGING_TARGET_INVALID');
    return result();
  }
  const rawBindings = list(snapshot.bindings);
  if (snapshot.inventoryProjectAmbiguous === true) add('INVENTORY_PROJECT_AMBIGUOUS');
  if (rawBindings.some(row => !NAME.test(string(row?.key)))) add('ENV_NAME_INVALID');
  const bindings = rawBindings.filter(row => NAME.test(string(row?.key))).map(safeBinding);
  const runtime = object(snapshot.runtime);
  const byTarget = (key, selectedTarget) => {
    const rows = bindings.filter(row => row.key === key && row.target.includes(selectedTarget));
    const scoped = branch && selectedTarget === target ? rows.filter(row => row.gitBranch === branch) : [];
    const selected = scoped.length ? scoped : rows.filter(row => !row.gitBranch);
    return selected.length === 1 ? selected[0] : null;
  };
  const env = key => byTarget(key, target);
  const has = key => Boolean(env(key) && bindingPresent(env(key)));
  const value = key => {
    if (!has(key) || !VALUES.has(key)) return null;
    const candidate = env(key).configuredValue ?? runtime[key];
    return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate).trim() : null;
  };
  const requireBindings = (code, names) => {
    const missing = names.filter(key => !has(key));
    if (missing.length) add(code, missing);
  };
  const expect = (key, expected, code) => {
    if (!has(key)) return;
    const actual = value(key);
    if (actual === null) add('RUNTIME_VALUE_UNOBSERVED', [key], 'UNVERIFIED');
    else if (!expected.includes(actual)) add(code, [key]);
  };
  const appOrigin = origin(env('NEXT_PUBLIC_APP_URL')?.configuredOrigin);
  const supabaseUrl = origin(env('NEXT_PUBLIC_SUPABASE_URL')?.configuredOrigin);
  const productionOrigin = origin(byTarget('NEXT_PUBLIC_APP_URL', 'production')?.configuredOrigin) ?? origin(snapshot.production?.appOrigin);
  const productionSupabase = origin(byTarget('NEXT_PUBLIC_SUPABASE_URL', 'production')?.configuredOrigin) ?? origin(snapshot.production?.supabaseUrl);
  if (!appOrigin) add('APP_ORIGIN_UNOBSERVED', ['NEXT_PUBLIC_APP_URL'], 'UNVERIFIED');
  if (!supabaseUrl || !projectRef(supabaseUrl)) add('SUPABASE_PROJECT_UNOBSERVED', ['NEXT_PUBLIC_SUPABASE_URL'], 'UNVERIFIED');
  if (!productionOrigin || !productionSupabase || !projectRef(productionSupabase)) add('PRODUCTION_BASELINE_UNOBSERVED', [], 'UNVERIFIED');
  if (appOrigin && productionOrigin && appOrigin === productionOrigin) add('STAGING_APP_ORIGIN_SHARED_WITH_PRODUCTION', ['NEXT_PUBLIC_APP_URL']);
  if (supabaseUrl && productionSupabase && supabaseUrl === productionSupabase) add('STAGING_SUPABASE_SHARED_WITH_PRODUCTION', ['NEXT_PUBLIC_SUPABASE_URL']);
  if (!snapshot.authProjectRef) add('AUTH_PROJECT_UNOBSERVED', [], 'UNVERIFIED');
  if (supabaseUrl && snapshot.authProjectRef && projectRef(supabaseUrl) !== snapshot.authProjectRef) add('AUTH_PROJECT_MISMATCH');

  requireBindings('WEB_CONFIGURATION_MISSING', ['APP_ENV', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'INTERNAL_WEBHOOK_SECRET', 'APP_ENCRYPTION_KEY']);
  if (!['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].some(has)) add('PUBLIC_SUPABASE_KEY_MISSING');
  expect('APP_ENV', ['staging'], 'APP_ENV_NOT_STAGING');
  const auth = object(snapshot.auth);
  if (!snapshot.auth) add('AUTH_CONFIGURATION_UNOBSERVED', [], 'UNVERIFIED');
  else {
    if (!appOrigin || origin(auth.site_url) !== appOrigin) add('AUTH_SITE_URL_MISMATCH');
    const redirects = typeof auth.uri_allow_list === 'string' ? auth.uri_allow_list.split(',').map(item => item.trim()) : list(auth.uri_allow_list);
    if (appOrigin && ['fr', 'ar'].some(locale => !redirects.includes(`${appOrigin}/${locale}/auth/callback`))) add('AUTH_CALLBACKS_MISSING');
    const uiOtp = has('AUTH_EMAIL_OTP_LENGTH') ? value('AUTH_EMAIL_OTP_LENGTH') : '6';
    if (uiOtp === null) add('RUNTIME_VALUE_UNOBSERVED', ['AUTH_EMAIL_OTP_LENGTH'], 'UNVERIFIED');
    else if (!/^[6-8]$/u.test(uiOtp) || Number(uiOtp) !== auth.mailer_otp_length) add('AUTH_OTP_LENGTH_MISMATCH', ['AUTH_EMAIL_OTP_LENGTH']);
    if (auth.smtpCredentialsConfigured !== true || !string(auth.smtp_host)) add('AUTH_SMTP_NOT_CONFIGURED');
    if (auth.otpTemplateUsesToken !== true) add('AUTH_OTP_TEMPLATE_UNVERIFIED', [], 'UNVERIFIED');
    if (auth.mfa_totp_enroll_enabled !== true || auth.mfa_totp_verify_enabled !== true) add('AUTH_TOTP_DISABLED');
  }

  requireBindings('EMAIL_CONFIGURATION_MISSING', ['EMAIL_DELIVERY_MODE', 'EMAIL_LIVE_DELIVERY_ENABLED', 'EMAIL_RECIPIENT_ALLOWLIST']);
  expect('EMAIL_DELIVERY_MODE', ['EXTERNAL'], 'EMAIL_EXTERNAL_REQUIRED');
  expect('EMAIL_LIVE_DELIVERY_ENABLED', ['true'], 'EMAIL_DELIVERY_DISABLED');
  if (has('EMAIL_RECIPIENT_ALLOWLIST') && value('EMAIL_RECIPIENT_ALLOWLIST') === null) add('RUNTIME_VALUE_UNOBSERVED', ['EMAIL_RECIPIENT_ALLOWLIST'], 'UNVERIFIED');
  else if (has('EMAIL_RECIPIENT_ALLOWLIST') && !value('EMAIL_RECIPIENT_ALLOWLIST')) add('EMAIL_RECIPIENT_ALLOWLIST_EMPTY', ['EMAIL_RECIPIENT_ALLOWLIST']);
  const resend = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'RESEND_WEBHOOK_SECRET'].every(has);
  const httpEmail = ['EMAIL_PROVIDER_ENDPOINT', 'EMAIL_PROVIDER_ENDPOINT_ALLOWLIST', 'EMAIL_PROVIDER_TOKEN'].every(has);
  if (!resend && !httpEmail) add('EMAIL_TRANSPORT_MISSING');
  if (httpEmail) endpointAllowed('EMAIL_PROVIDER_ENDPOINT', 'EMAIL_PROVIDER_ENDPOINT_ALLOWLIST', true);

  requireBindings('PAYMENT_CONFIGURATION_MISSING', ['PAYMENT_PROVIDER', 'PAYMENT_PROVIDER_ALLOWLIST', 'PAYMENT_LIVE_ENABLED']);
  expect('PAYMENT_LIVE_ENABLED', ['true'], 'PAYMENT_EXTERNAL_DELIVERY_DISABLED');
  const provider = value('PAYMENT_PROVIDER')?.toUpperCase();
  if (has('PAYMENT_PROVIDER') && provider === undefined) add('RUNTIME_VALUE_UNOBSERVED', ['PAYMENT_PROVIDER'], 'UNVERIFIED');
  else if (provider && !['CMI', 'PAYPAL'].includes(provider)) add('PAYMENT_EXTERNAL_SANDBOX_REQUIRED', ['PAYMENT_PROVIDER']);
  if (has('PAYMENT_PROVIDER_ALLOWLIST')) {
    const allowlist = value('PAYMENT_PROVIDER_ALLOWLIST');
    if (allowlist === null) add('RUNTIME_VALUE_UNOBSERVED', ['PAYMENT_PROVIDER_ALLOWLIST'], 'UNVERIFIED');
    else {
      const providers = allowlist.split(',').map(item => item.trim().toUpperCase());
      if (providers.some(item => !['DEMO', 'CMI', 'PAYPAL'].includes(item))) add('PAYMENT_PROVIDER_ALLOWLIST_INVALID', ['PAYMENT_PROVIDER_ALLOWLIST']);
      if (!provider || !providers.includes(provider)) add('PAYMENT_PROVIDER_NOT_ALLOWLISTED', ['PAYMENT_PROVIDER_ALLOWLIST']);
    }
  }
  if (provider === 'PAYPAL') {
    requireBindings('PAYPAL_CONFIGURATION_MISSING', ['PAYPAL_ENV', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID', 'PAYPAL_WEBHOOK_CERT_URL', 'PAYPAL_WEBHOOK_CERTIFICATE_PEM_BASE64', 'PAYPAL_ALLOWED_CURRENCIES']);
    expect('PAYPAL_ENV', ['sandbox'], 'PAYPAL_SANDBOX_REQUIRED');
  } else if (provider === 'CMI') {
    requireBindings('CMI_CONFIGURATION_MISSING', ['CMI_ENV', 'CMI_MERCHANT_ID', 'CMI_STORE_KEY', 'CMI_GATEWAY_URL', 'CMI_GATEWAY_ALLOWED_HOSTS']);
    expect('CMI_ENV', ['demo'], 'CMI_SANDBOX_REQUIRED');
    endpointAllowed('CMI_GATEWAY_URL', 'CMI_GATEWAY_ALLOWED_HOSTS');
  }

  requireBindings('SCANNER_CONFIGURATION_MISSING', ['MALWARE_SCANNER_URL', 'MALWARE_SCANNER_ALLOWED_HOSTS', 'MALWARE_SCANNER_TOKEN', 'DELIVERY_PROOF_SCANNER_MODE']);
  expect('DELIVERY_PROOF_SCANNER_MODE', ['EXTERNAL'], 'SCANNER_EXTERNAL_REQUIRED');
  endpointAllowed('MALWARE_SCANNER_URL', 'MALWARE_SCANNER_ALLOWED_HOSTS');

  requireBindings('SIGNATURE_CONFIGURATION_MISSING', ['SIGNATURE_PROVIDER_MODE', 'SIGNATURE_PROVIDER_CODE']);
  expect('SIGNATURE_PROVIDER_MODE', ['EXTERNAL'], 'SIGNATURE_EXTERNAL_REQUIRED');
  expect('SIGNATURE_PROVIDER_CODE', ['YOUSIGN'], 'SIGNATURE_PROVIDER_UNSUPPORTED');
  if (value('SIGNATURE_PROVIDER_CODE') === 'YOUSIGN') {
    requireBindings('YOUSIGN_CONFIGURATION_MISSING', ['YOUSIGN_API_KEY', 'YOUSIGN_WEBHOOK_SECRET', 'YOUSIGN_ENVIRONMENT']);
    expect('YOUSIGN_ENVIRONMENT', ['sandbox'], 'YOUSIGN_SANDBOX_REQUIRED');
  }

  const applied = list(snapshot.appliedMigrations).filter(item => /^\d{14}$/u.test(String(item))).map(String);
  if (snapshot.migrationInventoryObserved !== true) add('MIGRATION_INVENTORY_UNOBSERVED', [], 'UNVERIFIED');
  else {
    const required = list(options.requiredMigrationVersions).filter(item => /^\d{14}$/u.test(String(item))).map(String);
    if (!required.length) add('REQUIRED_MIGRATIONS_UNOBSERVED', [], 'UNVERIFIED');
    else if (required.some(version => !applied.includes(version))) add('MIGRATIONS_MISSING');
  }
  if (snapshot.worker) validateWorker(object(snapshot.worker));
  else add('WORKER_CONFIGURATION_UNOBSERVED', [], 'UNVERIFIED');
  return result();

  function endpointAllowed(endpointKey, allowlistKey, exactUrl = false) {
    if (!has(endpointKey) || !has(allowlistKey)) return;
    const endpoint = value(endpointKey), allowlist = value(allowlistKey);
    if (endpoint === null || allowlist === null) { add('RUNTIME_VALUE_UNOBSERVED', [endpointKey, allowlistKey], 'UNVERIFIED'); return; }
    const url = httpsUrl(endpoint);
    const entries = allowlist.split(',').map(item => item.trim());
    if (!url || !entries.includes(exactUrl ? url.href : url.hostname)) add('ENDPOINT_NOT_ALLOWLISTED', [endpointKey, allowlistKey]);
    if (url && exactUrl && !publicAddress(url.hostname)) add('EMAIL_HTTP_PUBLIC_IP_REQUIRED', [endpointKey]);
  }
  function validateWorker(worker) {
    const workerBindings = list(worker.bindings).filter(row => NAME.test(string(row?.key)));
    const workerHas = key => workerBindings.some(row => row.key === key && bindingPresent(row));
    const missing = ['APP_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_PROJECT_REF', 'SUPABASE_SERVICE_ROLE_KEY', 'WORKER_DISPATCH_URL', 'WORKER_DISPATCH_ALLOWED_HOSTS', 'INTERNAL_WEBHOOK_SECRET', 'MALWARE_SCANNER_TOKEN', 'CLAMAV_HOST', 'CLAMAV_ALLOWED_HOSTS', 'CLAMAV_NETWORK_MODE', 'CLAMAV_ENGINE_VERSION'].filter(key => !workerHas(key));
    if (missing.length) add('WORKER_CONFIGURATION_MISSING', missing);
    const values = object(worker.runtime);
    const nodeVersion = string(worker.nodeVersion);
    if (!nodeVersion) add('WORKER_NODE_VERSION_UNOBSERVED', [], 'UNVERIFIED');
    else if (!/^v?22\.[0-9]+\.[0-9]+$/u.test(nodeVersion)) add('WORKER_NODE_VERSION_UNSUPPORTED');
    if (values.APP_ENV !== 'staging') add('WORKER_ENV_NOT_STAGING', ['APP_ENV']);
    if (!projectRef(supabaseUrl) || values.SUPABASE_PROJECT_REF !== projectRef(supabaseUrl)) add('WORKER_PROJECT_MISMATCH', ['SUPABASE_PROJECT_REF']);
    const workerUrl = workerBindings.find(row => row.key === 'NEXT_PUBLIC_SUPABASE_URL')?.configuredOrigin;
    if (origin(workerUrl) !== supabaseUrl) add('WORKER_SUPABASE_URL_MISMATCH', ['NEXT_PUBLIC_SUPABASE_URL']);
    const dispatch = httpsUrl(values.WORKER_DISPATCH_URL);
    const allowed = string(values.WORKER_DISPATCH_ALLOWED_HOSTS).split(',').map(item => item.trim().toLowerCase());
    const validHosts = allowed.every(host => /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|::1)$/u.test(host)) && new Set(allowed).size === allowed.length;
    if (!dispatch || dispatch.origin !== appOrigin || !allowed.includes(dispatch.hostname) || !validHosts) add('WORKER_DISPATCH_TARGET_INVALID', ['WORKER_DISPATCH_URL', 'WORKER_DISPATCH_ALLOWED_HOSTS']);
    validateClamAv();

    function validateClamAv() {
      const configValue = key => {
        const candidate = values[key];
        return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate).trim() : null;
      };
      const requiredNames = ['CLAMAV_HOST', 'CLAMAV_ALLOWED_HOSTS', 'CLAMAV_NETWORK_MODE', 'CLAMAV_ENGINE_VERSION'];
      const unobserved = requiredNames.filter(key => workerHas(key) && configValue(key) === null);
      if (unobserved.length) add('WORKER_CLAMAV_VALUES_UNOBSERVED', unobserved, 'UNVERIFIED');
      const normalizedHost = raw => {
        const host = string(raw).trim().toLowerCase();
        return host && !host.includes('://') && !/[\s/\\]/u.test(host)
          && (isIP(host) || /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/u.test(host)) ? host : null;
      };
      const hostValue = configValue('CLAMAV_HOST'), allowedValue = configValue('CLAMAV_ALLOWED_HOSTS');
      const host = hostValue === null ? null : normalizedHost(hostValue);
      if (hostValue !== null && !host) add('WORKER_CLAMAV_HOST_INVALID', ['CLAMAV_HOST']);
      if (allowedValue !== null) {
        const hosts = allowedValue.split(',').map(normalizedHost);
        if (!hosts.length || hosts.includes(null) || new Set(hosts).size !== hosts.length || !host || !hosts.includes(host)) add('WORKER_CLAMAV_ALLOWLIST_INVALID', ['CLAMAV_HOST', 'CLAMAV_ALLOWED_HOSTS']);
      }
      const mode = configValue('CLAMAV_NETWORK_MODE');
      if (mode !== null && !['PRIVATE', 'LOCAL'].includes(mode)) add('WORKER_CLAMAV_NETWORK_MODE_INVALID', ['CLAMAV_NETWORK_MODE']);
      const engine = configValue('CLAMAV_ENGINE_VERSION');
      if (engine !== null && (engine.length > 80 || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-.][A-Za-z0-9.-]+)?$/u.test(engine))) add('WORKER_CLAMAV_ENGINE_PIN_INVALID', ['CLAMAV_ENGINE_VERSION']);
      for (const [key, minimum, maximum] of [['CLAMAV_PORT', 1, 65_535], ['CLAMAV_TIMEOUT_MS', 100, 120_000], ['CLAMAV_CHUNK_BYTES', 1_024, 1_048_576], ['CLAMAV_MAX_DATABASE_AGE_HOURS', 1, 168], ['PORT', 1, 65_535]]) {
        const raw = values[key];
        const actual = typeof raw === 'string' || typeof raw === 'number' ? (key === 'CLAMAV_MAX_DATABASE_AGE_HOURS' ? String(raw).trim() : String(raw)) : null;
        if (key === 'CLAMAV_MAX_DATABASE_AGE_HOURS' && actual === '') continue;
        if (workerHas(key) && actual === null) add('WORKER_CLAMAV_VALUES_UNOBSERVED', [key], 'UNVERIFIED');
        else if (actual !== null && (!/^[0-9]+$/u.test(actual) || !Number.isSafeInteger(Number(actual)) || Number(actual) < minimum || Number(actual) > maximum)) add('WORKER_NUMERIC_SETTING_INVALID', [key]);
      }
      if (!host || !['PRIVATE', 'LOCAL'].includes(mode)) return;
      let addresses;
      if (isIP(host)) addresses = [host];
      else {
        const resolution = object(worker.clamavResolution);
        if (normalizedHost(resolution.host) !== host || !Array.isArray(resolution.addresses) || resolution.addresses.length === 0) {
          add('WORKER_CLAMAV_DNS_UNOBSERVED', ['CLAMAV_HOST'], 'UNVERIFIED');
          return;
        }
        addresses = resolution.addresses;
      }
      const validAddress = raw => {
        const address = string(raw).toLowerCase();
        if (isIP(address) === 4) {
          const [a, b] = address.split('.').map(Number);
          return mode === 'LOCAL' ? a === 127 : a === 10 || a === 127 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
        }
        if (isIP(address) !== 6) return false;
        return mode === 'LOCAL' ? address === '::1' : address === '::1' || /^f[cd][0-9a-f]{2}:/u.test(address) || /^fe[89ab][0-9a-f]:/u.test(address);
      };
      if (addresses.some(address => !validAddress(address))) add('WORKER_CLAMAV_ADDRESS_NOT_PRIVATE', ['CLAMAV_HOST', 'CLAMAV_NETWORK_MODE']);
    }
  }
  function result() {
    return { schemaVersion: 1, passed: findings.length === 0, target: TARGETS.has(target) ? target : 'invalid',
      verification: 'CONFIGURATION_METADATA_ONLY', findings,
      limitations: ['Secret values and validity are not inspected.', 'External delivery, RLS, MFA enrollment, policy approvals and release certification require separate native evidence.'] };
  }
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const args = {};
    const names = new Set(['--inventory', '--snapshot', '--runtime', '--target', '--branch', '--migration-dir']);
    for (let index = 0; index < argv.length; index++) {
      const option = argv[index];
      if (!names.has(option) || !argv[index + 1] || argv[index + 1].startsWith('--') || args[option]) throw new Error('ARGUMENTS_INVALID');
      args[option] = argv[++index];
    }
    if (Boolean(args['--snapshot']) === Boolean(args['--inventory'])) throw new Error('INPUT_REQUIRED');
    const load = async name => JSON.parse(await readFile(name, 'utf8'));
    const input = await load(args['--snapshot'] ?? args['--inventory']);
    const runtime = args['--runtime'] ? await load(args['--runtime']) : {};
    const snapshot = args['--inventory'] ? snapshotFromInventory(input, runtime) : { ...object(input), runtime: { ...object(input.runtime), ...object(runtime) } };
    const migrationDir = args['--migration-dir'] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/migrations');
    const requiredMigrationVersions = (await readdir(migrationDir)).map(name => name.match(/^(\d{14})_.+\.sql$/u)?.[1]).filter(Boolean);
    const report = validateStagingConfiguration(snapshot, { target: args['--target'], branch: args['--branch'], requiredMigrationVersions });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.passed ? 0 : 1;
  } catch {
    // Never expose parser snippets, absolute input paths, env values, URLs or provider errors.
    process.stdout.write(`${JSON.stringify({ passed: false, error: 'STAGING_PREFLIGHT_INPUT_INVALID' })}\n`);
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = await main();
