if (!process.argv.includes('--coordinated')) throw new Error('ORCHESTRATOR_COORDINATED_STAGE_REQUIRED');
import { requireDevelopment, docker, validateOwnState } from './safety.mjs';
requireDevelopment();
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { writeFile, mkdir, readFile, statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = process.cwd();
const previousPointer=resolve(root,'work/provider-browser-isolated/current.private.json');
try {
 const pointer=JSON.parse(await readFile(previousPointer,'utf8'));
 const previous=validateOwnState(JSON.parse(await readFile(resolve(pointer.directory,'state.private.json'),'utf8')),root);
 if(previous.status!=='CLEANED')throw new Error('PRESERVE_EXISTING_PROVIDER_RUN_BEFORE_NEW_PROVISION');
} catch(error) { if(error.code!=='ENOENT')throw error; }
const space=await statfs(root,{bigint:true});
if(space.bavail*space.bsize<4n*1024n**3n)throw new Error('OWNED_PROVIDER_SETUP_REQUIRES_4_GIB_FREE');
docker(['image','inspect','ghcr.io/supabase/postgres:17.6.1.167','--format','{{.Id}}']);
process.umask(0o077);
const token = randomUUID(), tag = token.replaceAll('-', '').slice(0, 16), label = `matricia.provider-browser-test=${token}`;
const directory = resolve(root, 'work/provider-browser-isolated', token);
await mkdir(directory, { recursive: true });
const network = `matricia_provider_browser_${tag}`, name = `matricia_provider_browser_db_${tag}`;
const dbSecret = randomBytes(32).toString('hex'), jwtSecret = randomBytes(32).toString('hex');
function sign(role) { const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url'); const a = enc({ alg: 'HS256', typ: 'JWT' }), b = enc({ role, iss: 'supabase-local-browser-test', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 8 * 3600 }); return `${a}.${b}.${createHmac('sha256', jwtSecret).update(`${a}.${b}`).digest('base64url')}`; }
const anonKey = sign('anon'), serviceKey = sign('service_role');
const envFile = resolve(directory, 'db.env');
await writeFile(envFile, `POSTGRES_PASSWORD=${dbSecret}\nPGDATA=/var/lib/postgresql/data\n`, { mode: 0o600 });
const state = { token, label, network, database: name, directory, status: 'CREATING', appPort: 19273, gatewayPort: 19274, anonKey, serviceKey, jwtSecret, dbSecret, children: [name] };
await writeFile(resolve(directory, 'state.private.json'), JSON.stringify(state), { mode: 0o600 });
await writeFile(resolve(root, 'work/provider-browser-isolated/current.private.json'), JSON.stringify({ directory }), { mode: 0o600 });
docker(['network', 'create', '--internal', '--label', label, network]);
try {
 const output=docker(['run', '--detach', '--pull=never', '--name', name, '--label', label, '--network', network, '--network-alias', 'db', '--env-file', envFile, 'ghcr.io/supabase/postgres:17.6.1.167', 'postgres', '-D', '/etc/postgresql', '-c', 'shared_preload_libraries=pg_cron', '-c', 'cron.database_name=postgres'],{timeout:300000});
 await writeFile(resolve(directory,'database-bootstrap.log'),output,{mode:0o600});
} catch(error) {
 state.status='PROVISION_FAILED';await writeFile(resolve(directory,'state.private.json'),JSON.stringify(state),{mode:0o600});
 const safe=String(error.stderr??error.message).split(dbSecret).join('[REDACTED]').split(jwtSecret).join('[REDACTED]');
 await writeFile(resolve(directory,'database-bootstrap.log'),safe,{mode:0o600});throw new Error('OWNED_PROVIDER_DATABASE_INITIALIZATION_FAILED');
}
let ready = false;
for (let i = 0; i < 60; i++) {
    try {
        docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-p', '5432', '-U', 'postgres']);
        ready = true;
        break;
    }
    catch { }
    await new Promise(r => setTimeout(r, 1000));
}
if (!ready)
    throw new Error('ISOLATED_DATABASE_NOT_READY');
const inspected = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Networks}}', name]));
state.dbHost = inspected[network].IPAddress;
state.dbPort = 5432;
state.status = 'DATABASE_READY';
await writeFile(resolve(directory, 'state.private.json'), JSON.stringify(state), { mode: 0o600 });
console.log(JSON.stringify({ directory, database: name, dbPort: state.dbPort, status: state.status }));
