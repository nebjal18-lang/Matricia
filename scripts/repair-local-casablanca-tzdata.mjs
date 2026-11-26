import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import postgres from 'postgres';
import {loadSafeConfiguration} from './p05-e2e/environment.mjs';

// Explicit local maintenance command: never runs as an automatic production repair.
const config=await loadSafeConfiguration(process.cwd());
assert.equal(config.runtimeMode,'isolated-local-docker');assert.equal(config.localDockerVerified,true);
assert.equal(process.env.E2E_LOCAL_PROJECT_ID,'Matricia');
const container='supabase_db_Matricia',directory=resolve('work/timezone-2026e');
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true}).trim();
const metadata=JSON.parse(docker('inspect','--format','{{json .Config.Image}}',container));
assert.match(metadata,/^public\.ecr\.aws\/supabase\/postgres:17\./u);
const configure=docker('exec',container,'pg_config','--configure');
const zoneDirectory=/--with-system-tzdata=([^'\s]+)/u.exec(configure)?.[1];
assert.match(zoneDirectory??'',/^\/nix\/store\/[a-z0-9-]+\/share\/zoneinfo$/u);
const compiler=docker('exec',container,'sh','-c','ls /nix/store/*/bin/zic').split('\n')[0];
assert.match(compiler,/^\/nix\/store\/[a-z0-9.-]+\/bin\/zic$/u);
const response=await fetch('https://data.iana.org/time-zones/tzdb-2026e/africa',{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);
const source=Buffer.from(await response.arrayBuffer());
assert.equal(createHash('sha256').update(source).digest('hex'),'f2851d4be4a4925cbdc9d56e10d780bccadb89d6ffb9aed78c3e35f97c200aed');
await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'africa'),source);
docker('exec',container,'mkdir','-p','/tmp/matricia-tz-2026e');
docker('cp',resolve(directory,'africa'),`${container}:/tmp/matricia-tz-2026e/africa`);
docker('exec',container,compiler,'-b','fat','-d','/tmp/matricia-tz-2026e/out','/tmp/matricia-tz-2026e/africa');
for(const zone of ['Casablanca','El_Aaiun']){
 docker('cp',`${container}:${zoneDirectory}/Africa/${zone}`,resolve(directory,`${zone}.before`));
 docker('cp',`${container}:/tmp/matricia-tz-2026e/out/Africa/${zone}`,resolve(directory,zone));
 docker('cp',resolve(directory,zone),`${container}:${zoneDirectory}/Africa/${zone}`);
}
docker('restart',container);
let verified=false;
for(let attempt=0;attempt<20&&!verified;attempt++){
 const db=postgres(config.databaseUrl,{max:1,connect_timeout:2});
 try{
  const rows=await db`select d::text date,extract(epoch from(d at time zone 'Africa/Casablanca'))::text epoch from unnest(array['2024-01-15 14:30','2024-03-15 14:30','2026-09-19 14:30','2026-09-21 14:30','2026-12-03 14:30']::timestamp[])d`;
  for(const row of rows){const instant=new Date(Number(row.epoch)*1000);const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);const part=t=>parts.find(p=>p.type===t)?.value;assert.equal(`${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`,row.date.slice(0,16));}
  verified=true;
 }catch(error){if(attempt===19)throw error;await new Promise(resolve=>setTimeout(resolve,1000));}finally{await db.end({timeout:2});}
}
assert.equal(verified,true);console.log('Local Casablanca/El_Aaiun IANA 2026e installed; five Node/PostgreSQL historical and future probes passed.');
