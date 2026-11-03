#!/usr/bin/env node
// Explicitly owned, disposable PostgreSQL container only. This harness never
// reads app credentials, opens an external DB URL, or changes production data.
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const [container, outputDirectory] = process.argv.slice(2);
if (process.env.APP_ENV !== 'development' || !/^matricia_[a-z0-9_]+$/.test(container ?? '') || !outputDirectory) throw new Error('EXPLICIT_DEVELOPMENT_OWNED_CONTAINER_AND_EVIDENCE_REQUIRED');
const inspection = JSON.parse(execFileSync('docker', ['inspect', '--format', '{{json .}}', container], {encoding:'utf8'}));
if (!inspection.State.Running || inspection.HostConfig.NetworkMode !== 'none' || Object.values(inspection.NetworkSettings.Ports ?? {}).some(value => value?.length)) throw new Error('NO_NETWORK_NO_PUBLIC_PORTS_CONTAINER_REQUIRED');
const psql = ['exec','-i',container,'psql','-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres'];
function query(sql) { return execFileSync('docker', psql, {input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim(); }
const token=randomUUID(), tag=token.replaceAll('-','').slice(0,12), directory=resolve(outputDirectory);
await mkdir(directory,{recursive:true,mode:0o700});
const summary={scope:'TWO_REAL_POSTGRESQL_SESSIONS_WITH_SYNTHETIC_SQL_ACTOR',nativeGoTrueCertified:false,token,status:'RUNNING',source:'0341_quota_audit_lock_and_chain_order.test.sql',containerNetwork:'none',retries:0};
class Session {
 constructor(label) { this.label=label;this.output='';this.errors='';this.process=spawn('docker',[...psql.slice(0,psql.indexOf('ON_ERROR_STOP=1')),'ON_ERROR_STOP=0',...psql.slice(psql.indexOf('ON_ERROR_STOP=1')+1)],{stdio:['pipe','pipe','pipe']});this.process.stdout.on('data',chunk=>{this.output+=chunk;});this.process.stderr.on('data',chunk=>{this.errors+=chunk;}); }
 async send(sql) {const marker=`END_${randomUUID().replaceAll('-','')}`,from=this.output.length,errorFrom=this.errors.length;this.process.stdin.write(`${sql}\n\\echo ${marker}\n`);await until(()=>this.output.includes(marker,from),`${this.label}_COMMAND_TIMEOUT`);return{output:this.output.slice(from,this.output.indexOf(marker,from)).trim(),errors:this.errors.slice(errorFrom)};}
 close(){this.process.stdin.end('rollback;\n\\q\n');}
}
async function until(predicate,error){const deadline=Date.now()+15000;while(!predicate()){if(Date.now()>deadline)throw new Error(error);await new Promise(resolve=>setTimeout(resolve,20));}}
let a,b;
try {
 let setup=(await readFile(new URL('../0341_quota_audit_lock_and_chain_order.test.sql',import.meta.url),'utf8')).split('-- ROLLBACK_ONLY_ASSERTIONS:')[0].replace('select no_plan();','');
 const maps=new Map();for(const prefix of ['a3410000','b3410000','c3410000','f3410000','f3411000','f3412000','f3413000'])maps.set(prefix,randomUUID().slice(0,8));
 for(const[from,to]of maps)setup=setup.replaceAll(from,to);
 const ice=String(BigInt('0x'+tag)%900000000000000n+100000000000000n);
 setup=setup.replaceAll('997245000000001',ice).replaceAll('99724501',tag.slice(0,8)).replaceAll('TEST245',`TEST${tag}`).replaceAll('TEST_0341_',`TEST_CONCURRENT_${tag.toUpperCase()}_`).replaceAll('@example.invalid',`-${tag}@example.invalid`);
 query(setup+'\ncommit;');
 const actor=`${maps.get('a3410000')}-0000-4000-8000-000000000001`,org=`${maps.get('b3410000')}-0000-4000-8000-000000000001`;
 summary.organizationId=org;
 const claims=`select set_config('request.jwt.claim.sub','${actor}',true);select set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated","aal":"aal2"}',true);`;
 const command=suffix=>`select public.create_client_site('${org}','TEST_${suffix}_${tag.toUpperCase()}','Site de test ${suffix}','موقع اختبار ${suffix}','{"country":"MA","city":"TEST"}','TEST deterministic financial/FK/audit lock order','${randomUUID()}','${randomUUID()}');`;
 a=new Session('A');b=new Session('B');
 await a.send(`begin;${claims}select pg_advisory_xact_lock(hashtextextended('subscription-financial:${org}',0));`);
 // This is exactly the row-lock mode acquired by the child's organization FK.
 await b.send(`begin;${claims}select 1 from public.organizations where id='${org}'for key share;select pg_backend_pid();`);
 const bPid=Number((await b.send('select pg_backend_pid();')).output);
 const waiting=b.send(`set local role authenticated;\\set VERBOSITY verbose\n${command('B')}`);
 await until(()=>query(`select wait_event='advisory' from pg_stat_activity where pid=${bPid};`)==='t','B_DID_NOT_WAIT_FOR_FINANCIAL_LOCK');
 const first=await a.send(`set local role authenticated;${command('A')}commit;`);
 const second=await waiting;
 if(first.errors || !first.output.includes('CLIENT_SITE_CREATED'))throw new Error('FIRST_REAL_SITE_COMMAND_FAILED');
 if(!/54000:\s*SUBSCRIPTION_QUOTA_EXCEEDED/.test(second.errors)||/40P01/.test(second.errors))throw new Error('SECOND_COMMAND_DID_NOT_RETURN_EXACT_QUOTA_REFUSAL');
 await b.send('rollback;');
 summary.quotaRace={accepted:1,rejectedCode:'54000',rejectedReason:'SUBSCRIPTION_QUOTA_EXCEEDED',deadlock:false,persistedActiveSites:Number(query(`select count(*)from public.client_sites where organization_id='${org}'and status='ACTIVE';`))};
 if(summary.quotaRace.persistedActiveSites!==1)throw new Error('QUOTA_OVERRUN');
 // The lower identity is allocated in one open session, then the other commits
 // first. The delayed writer must get a new final ID after its chain scope lock.
 await a.send('begin;');
 const low=(await a.send("select nextval(pg_get_serial_sequence('public.audit_events','id')::regclass);")).output;
 if(!/^\d+$/.test(low))throw new Error('PREALLOCATED_ID_REQUIRED');
 const audit=(action,id='')=>`insert into public.audit_events(${id?'id,':''}organization_id,actor_type,action,resource_type,correlation_id,metadata,event_hash)${id?'overriding system value ':''}values(${id?`${id},`:''}'${org}','SYSTEM','${action}','concurrency_test','${randomUUID()}','{}',repeat('f',64));`;
 const highAction=`test.audit.${tag}.high`,lowAction=`test.audit.${tag}.low`,finalAction=`test.audit.${tag}.final`;
 const high=await b.send(`begin;${audit(highAction)}commit;`);if(high.errors)throw new Error('HIGH_ID_AUDIT_FAILED');
 const delayed=await a.send(`${audit(lowAction,low)}commit;`);if(delayed.errors)throw new Error('DELAYED_ID_AUDIT_FAILED');
 query(audit(finalAction));
 const ordered=JSON.parse(query(`select jsonb_agg(jsonb_build_object('id',id::text,'action',action)order by id)from public.audit_events where organization_id='${org}'and action in('${highAction}','${lowAction}','${finalAction}');`));
 if(ordered.map(row=>row.action).join('|')!==[highAction,lowAction,finalAction].join('|'))throw new Error('AUDIT_ID_SEAL_ORDER_INCORRECT');
 const linear=query(`select not exists(select 1 from(select previous_hash,lag(event_hash)over(order by id)prior_hash from public.audit_events where organization_id='${org}')chain where previous_hash is distinct from prior_hash);`)==='t';
 const hashes=query(`select bool_and(event_hash=encode(extensions.digest(convert_to(jsonb_build_object('previous_hash',coalesce(previous_hash,''),'organization_id',organization_id,'actor_user_id',actor_user_id,'actor_type',actor_type,'action',action,'resource_type',resource_type,'resource_id',resource_id,'correlation_id',correlation_id,'occurred_at',occurred_at,'request_ip',request_ip,'user_agent',user_agent,'metadata',metadata)::text,'UTF8'),'sha256'),'hex'))from public.audit_events where organization_id='${org}';`)==='t';
 if(!linear||!hashes)throw new Error('AUDIT_CHAIN_OR_CANONICAL_HASH_BROKEN');
 summary.audit={delayedPreallocatedIdentity:true,finalIdsFollowSealOrder:true,linear,canonicalHashes:hashes,events:ordered.length};
 summary.status='PASSED';
} catch(error) {summary.status='FAILED';summary.failure=String(error.message).slice(0,500);process.exitCode=1;}
finally {a?.close();b?.close();await writeFile(resolve(directory,'summary.json'),JSON.stringify(summary,null,2),{mode:0o600});console.log(JSON.stringify(summary));}
