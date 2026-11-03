#!/usr/bin/env node
// Executes rollback-only SQL contracts against an explicitly owned, no-network
// native-replay container. Never resolves the application database configuration.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { prepareSqlTest } from '../../../scripts/db-test-support.mjs';

const [targetFile, ...files] = process.argv.slice(2);
if (process.env.APP_ENV !== 'development' || !targetFile || files.length === 0
  || files.some(file => !file.endsWith('.test.sql'))) {
  throw new Error('EXPLICIT_DEVELOPMENT_ISOLATED_TARGET_AND_SQL_CONTRACTS_REQUIRED');
}
process.umask(0o077);
const target = JSON.parse(await readFile(resolve(targetFile), 'utf8'));
if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(target.token ?? '')
  || target.name !== `matricia_replay_${target.token.replaceAll('-', '')}`
  || target.label !== `matricia.isolated-replay=${target.token}`
  || target.database !== 'postgres' || target.isolated !== true
  || target.network !== 'none' || target.publicPorts !== 0) {
  throw new Error('ISOLATED_REPLAY_OWNERSHIP_REQUIRED');
}
const dockerEnvironment = { ...process.env, DOCKER_HOST: 'unix:///var/run/docker.sock' };
for (const key of ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete dockerEnvironment[key];
function docker(args, options = {}) {
  return execFileSync('docker', args, {
    env: dockerEnvironment, encoding: 'utf8', timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options,
  });
}
const inspect = JSON.parse(docker(['inspect', '--format', '{"Config":{"Labels":{{json .Config.Labels}}},"HostConfig":{"NetworkMode":{{json .HostConfig.NetworkMode}}},"State":{"Running":{{json .State.Running}}},"NetworkSettings":{"Ports":{{json .NetworkSettings.Ports}}}}', target.name]));
if (inspect.Config.Labels?.['matricia.isolated-replay'] !== target.token
  || inspect.HostConfig.NetworkMode !== 'none' || !inspect.State.Running
  || Object.values(inspect.NetworkSettings.Ports ?? {}).some(bindings => bindings?.length)) {
  throw new Error('ISOLATED_CONTAINER_WITHOUT_NETWORK_OR_PUBLISHED_PORTS_REQUIRED');
}
const directory = resolve(dirname(targetFile), 'targeted-fixtures', randomUUID());
await mkdir(directory, { recursive: true, mode: 0o700 });
const results = [];
for (const file of files) {
  const bytes = await readFile(resolve(file));
  const source = bytes.toString('utf8');
  if (/\b(?:session_replication_role|disable\s+trigger|enable\s+trigger)\b/i.test(source)) {
    throw new Error(`FIXTURE_GUARD_BYPASS_REFUSED:${basename(file)}`);
  }
  let output = '', commandFailed = false;
  try {
    output = docker(['exec', '-i', target.name, 'psql', '-X', '-U', 'supabase_admin', '-d', target.database,
      '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: prepareSqlTest(source) });
  } catch (error) {
    commandFailed = true;
    output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
  }
  await writeFile(resolve(directory, `${basename(file)}.log`), output, { mode: 0o600 });
  const plans = [...output.matchAll(/^1\.\.(\d+)\s*$/gm)];
  const assertions = [...output.matchAll(/^(not )?ok\s+(\d+)\b.*$/gm)];
  const passed = !commandFailed && plans.length === 1 && Number(plans[0][1]) > 0
    && assertions.length === Number(plans[0][1])
    && assertions.every((assertion, index) => !assertion[1] && Number(assertion[2]) === index + 1)
    && !/^Bail out!/im.test(output)
    && !/^(?:not )?ok\b[^\n]*#\s*(?:SKIP|TODO)\b/im.test(output);
  const result = { file: basename(file), sha256: createHash('sha256').update(bytes).digest('hex'),
    passed, assertions: assertions.length, commandFailed,
    failures: output.split('\n').filter(line => /^(?:not ok|ERROR:|CONTEXT:|#\s*(?:Failed|got:|expected:))/.test(line)) };
  results.push(result);
  console.log(JSON.stringify(result));
}
await writeFile(resolve(directory, 'summary.json'), JSON.stringify({
  classification: 'SYNTHETIC_SQL_CONTRACTS_ON_FRESH_ISOLATED_REPLAY',
  candidateRuntime: 'caller-owned native-replay container; no shared database access',
  target: { name: target.name, network: 'none', publicPorts: 0 }, results,
}, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ evidence: directory, passed: results.every(result => result.passed),
  assertions: results.reduce((total, result) => total + result.assertions, 0) }));
if (results.some(result => !result.passed)) process.exitCode = 1;
