if (!process.argv.includes('--coordinated')) throw new Error('ORCHESTRATOR_COORDINATED_STAGE_REQUIRED');
import { requireDevelopment, docker, loadOwnState } from './safety.mjs';
requireDevelopment();
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateCanonicalSourceTarget,requireFreshRestoreState } from './safety.mjs';
import {execFileSync}from 'node:child_process';
import { createHash } from 'node:crypto';
const s = await loadOwnState(), statePath = resolve(s.directory, 'state.private.json');
requireFreshRestoreState(s);
const target = JSON.parse(docker(['inspect', '--format', '{"labels":{{json .Config.Labels}},"networks":{{json .NetworkSettings.Networks}}}', s.database], { encoding: 'utf8' }));
if (target.labels['matricia.provider-browser-test'] !== s.token || !target.networks[s.network])
    throw new Error('OWNED_TEST_TARGET_REQUIRED');
s.dbHost = target.networks[s.network].IPAddress;
s.dbPort = 5432;
const source = validateCanonicalSourceTarget(JSON.parse(await readFile(resolve(process.argv[2] ?? ''), 'utf8')));
const sourceInspect = JSON.parse(docker(['inspect', '--format', '{"labels":{{json .Config.Labels}},"network":"{{.HostConfig.NetworkMode}}","ports":{{json .NetworkSettings.Ports}}}', source.name], { encoding: 'utf8' }));
if (sourceInspect.labels['matricia.isolated-replay'] !== source.token || sourceInspect.network !== 'none' || Object.values(sourceInspect.ports ?? {}).some(value => value?.length))
    throw new Error('SOURCE_ISOLATION_NOT_VERIFIED');
const archive = docker(['exec', source.name, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc'], { encoding: null });
await writeFile(resolve(s.directory, 'baseline.private.dump'), archive, { mode: 0o600 });
s.baselineArchiveSha256 = createHash('sha256').update(archive).digest('hex');
s.baselineMigrationCount=source.migrationCount;s.canonicalSourceManifest=resolve(process.argv[2]);
// Restoring over the image's initialized database retains its unrelated
// default ACL grants. Only a fresh owned target may be reset to template0.
docker(['exec','-i',s.database,'psql','-X','-U','supabase_admin','-d','template1','-v','ON_ERROR_STOP=1'],{input:'drop database postgres with (force);\ncreate database postgres with template template0 owner supabase_admin;\n'});
try {
    docker(['exec', '-i', s.database, 'pg_restore', '-U', 'supabase_admin', '-d', 'postgres', '--clean', '--if-exists', '--exit-on-error'], { input: archive });
}
catch (e) {
    await writeFile(resolve(s.directory, 'restore.log'), String(e.stderr ?? ''), { mode: 0o600 });
    throw new Error('OWNED_TEST_RESTORE_FAILED');
}
// Fresh test runtime passwords, not source cluster credentials or user sessions.
docker(['exec', '-i', s.database, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: Buffer.from(`alter role supabase_auth_admin password '${s.dbSecret}';alter role supabase_storage_admin password '${s.dbSecret}';alter role authenticator password '${s.dbSecret}';alter role supabase_admin password '${s.dbSecret}';`) });
s.status = 'RESTORED_AWAITING_ACL';
await writeFile(statePath, JSON.stringify(s), { mode: 0o600 });
execFileSync(process.execPath,[resolve('tests/e2e/helpers/provider-browser/acl-fidelity.mjs'),resolve(process.argv[2]),'--align'],{env:process.env,stdio:['ignore','pipe','pipe'],timeout:90000});
s.status='RESTORED';s.schemaStatus='BASELINE_CANONICAL458';await writeFile(statePath,JSON.stringify(s),{mode:0o600});
console.log(JSON.stringify({ canonicalAclFidelity:'MATCHED',status: s.status, archiveSha256: s.baselineArchiveSha256, database: s.database }));
