#!/usr/bin/env node
// SQL-only synthetic identities; no cryptographic user JWT is fabricated.
// Commits are confined to root's disposable clone. No fixture is deleted.
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const database='matricia_delivery_ice_concurrency';
const container='supabase_db_Matricia';
const source='/workspace/delivery-root/supabase/migrations/20261031264010_platform_account_access_decisions.sql';
const sessionGateSource='/workspace/delivery-root/supabase/migrations/20261031264020_live_session_authorization.sql';
const args=process.argv.slice(2);
const assert=(condition,code)=>{if(!condition)throw new Error(code);};
assert(args.length===1&&['--plan','--execute'].includes(args[0]),'ARGUMENTS');
const plan={database,container,connections:3,mainDatabaseAccess:false,fixtureMode:'SYNTHETIC_SQL_IDENTITIES_BOUND_AUTH_SESSIONS_NO_USER_JWT',cleanup:'close connections; retain only own UUID fixtures for root to drop clone',cases:['reviewer revoked while decision awaits global advisory lock','requester revoked while decision awaits global advisory lock','two identical requests overlap on the native idempotency lock']};
if(args[0]==='--plan'){console.log(JSON.stringify(plan,null,2));process.exit(0);}
assert(process.env.APP_ENV==='development','DEVELOPMENT_REQUIRED');
assert(process.env.LOCAL_PLATFORM_ACCOUNT_CLONE===database,'EXPLICIT_DISPOSABLE_CLONE_REQUIRED');
process.umask(0o077);
const dockerEnv={...process.env,DOCKER_HOST:'unix:///var/run/docker.sock'};
for(const key of ['DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
const docker=(parameters,options={})=>execFileSync('docker',parameters,{env:dockerEnv,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe'],...options});
const inspected=JSON.parse(docker(['inspect','--format','{"name":{{json .Name}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}}}',container]));
assert(inspected.name===`/${container}`&&inspected.running===true,'LOCAL_SUPABASE_CONTAINER_REQUIRED');
assert(inspected.labels?.['com.supabase.cli.project']==='Matricia'&&inspected.labels?.['com.docker.compose.project']==='Matricia','LOCAL_SUPABASE_LABELS_REQUIRED');
const runId=randomUUID();const startedAt=new Date().toISOString();
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const evidence=resolve(root,'work/platform-account-concurrency',runId);
await mkdir(evidence,{recursive:true,mode:0o700});
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceHash=hash(await readFile(source));
const sessionGateSourceHash=hash(await readFile(sessionGateSource));
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const clients=[];
const actorSessions=new Map();
const report={...plan,runId,startedAt,sourceSha256:sourceHash,sessionGateSourceSha256:sessionGateSourceHash,status:'FAILED',assertions:0,cases:[],connectionsClosed:false};
function check(condition,code){report.assertions+=1;assert(condition,code);}
class Session{
 constructor(name){
  this.name=name;this.buffer='';this.pending=null;this.closed=false;
  // PostgreSQL truncates application_name at 63 bytes; keep the full run UUID.
  this.applicationName=`pac-${runId}-${name}`;
  this.child=spawn('docker',['exec','-i','--env',`PGAPPNAME=${this.applicationName}`,container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=0','-v','VERBOSITY=sqlstate'],{env:dockerEnv,stdio:['pipe','pipe','pipe']});
  // Never emit stderr: it can contain synthetic emails or complete SQL text.
  this.child.stderr.on('data',()=>{});
  this.child.stdout.on('data',bytes=>{
   this.buffer+=bytes.toString('utf8');
   while(this.buffer.includes('\n')){
    const index=this.buffer.indexOf('\n');const line=this.buffer.slice(0,index).replace(/\r$/,'');this.buffer=this.buffer.slice(index+1);
    if(!this.pending)continue;
    if(line.startsWith(`${this.pending.marker} `)){
     const pending=this.pending;this.pending=null;clearTimeout(pending.timer);
     const state=line.slice(pending.marker.length+1).trim();
     if(state==='00000')pending.resolve(pending.lines.filter(Boolean));else pending.reject(Object.assign(new Error('SQL_OPERATION_FAILED'),{sqlstate:state}));
    }else{this.pending.lines.push(line);if(this.pending.lines.join('\n').length>1048576){this.pending.reject(new Error('SQL_OUTPUT_LIMIT'));clearTimeout(this.pending.timer);this.pending=null;}}
   }
  });
  this.child.on('error',()=>this.fail('PSQL_START_FAILED'));
  this.child.on('exit',()=>{this.closed=true;this.fail('PSQL_CLOSED');});
  this.child.stdin.on('error',()=>this.fail('PSQL_STDIN_FAILED'));
  clients.push(this);
 }
 fail(code){if(this.pending){const pending=this.pending;this.pending=null;clearTimeout(pending.timer);pending.reject(new Error(code));}}
 query(sql){
  assert(!this.pending&&!this.closed,'SESSION_OPERATION_OVERLAP');
  return new Promise((resolveQuery,reject)=>{
   const marker=`done_${randomUUID().replaceAll('-','')}`;
   const timer=setTimeout(()=>{this.fail('SQL_TIMEOUT');},20000);
   this.pending={marker,lines:[],resolve:resolveQuery,reject,timer};
   this.child.stdin.write(`${sql}\n\\echo ${marker} :SQLSTATE\n`);
  });
 }
 async json(sql){const lines=await this.query(sql);return JSON.parse(lines.at(-1));}
 async close(){
  if(this.pending)this.fail('CONNECTION_CLEANUP');
  if(this.closed)return;
  try{await this.query('rollback;');}catch{/* failed transaction or timeout */}
  const exit=new Promise(resolveExit=>this.child.once('exit',resolveExit));
  this.child.stdin.end('\\q\n');
  let timeout;try{await Promise.race([exit,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('CLOSE_TIMEOUT')),5000);})]);}finally{clearTimeout(timeout);if(!this.closed)this.child.kill('SIGTERM');}
 }
}
async function actor(client,user){
 assert(actorSessions.has(user),'SYNTHETIC_ACTOR_SESSION_REQUIRED');
 await client.query(`begin;set local role authenticated;set local statement_timeout='15s';set local lock_timeout='12s';select set_config('request.jwt.claim.sub',${quote(user)},true);select set_config('request.jwt.claims',${quote(JSON.stringify({sub:user,role:'authenticated',aal:'aal2',session_id:actorSessions.get(user)}))},true);`);
}
function requestSql(target,sourceHash,key){return`select public.request_platform_account_change_v1(${quote(target)},'REVOKE_SESSIONS',null,${quote(sourceHash)},'Synthetic clone concurrency security request',${quote(key)},'DEVELOPMENT',null);`;}
async function waitAdvisory(control,pids,blockerPid){
 const end=Date.now()+8000;let observed;
 while(Date.now()<end){
  observed=await control.json(`select coalesce(jsonb_agg(jsonb_build_object('pid',pid,'wait',wait_event,'type',wait_event_type,'blockers',pg_blocking_pids(pid))order by pid),'[]')from pg_stat_activity where datname=${quote(database)}and pid in(${pids.join(',')});`);
  if(observed.length===pids.length&&observed.every(row=>row.wait==='advisory'&&row.type==='Lock'&&row.blockers.includes(blockerPid)))return observed;
  await new Promise(done=>setTimeout(done,50));
 }
 throw new Error('ADVISORY_OVERLAP_NOT_OBSERVED');
}
async function createFixture(control,label){
 const fixture=Object.fromEntries(['requester','reviewer','target','sessionA','sessionB','requesterSession','reviewerSession'].map(key=>[key,randomUUID()]));
 await control.query(`begin;
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
 ${['requester','reviewer','target'].map(role=>`(${quote(fixture[role])},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${quote(`concurrency-${runId}-${label}-${role}@example.invalid`)},'',now(),'{}','{}',now(),now())`).join(',')};
 insert into public.platform_user_roles(user_id,role_code)values(${quote(fixture.requester)},'MATRICIA_ADMIN'),(${quote(fixture.reviewer)},'MATRICIA_ADMIN');
 insert into auth.sessions(id,user_id,created_at,updated_at,aal)values(${quote(fixture.sessionA)},${quote(fixture.target)},now(),now(),'aal1'),(${quote(fixture.sessionB)},${quote(fixture.target)},now(),now(),'aal1'),(${quote(fixture.requesterSession)},${quote(fixture.requester)},now(),now(),'aal2'),(${quote(fixture.reviewerSession)},${quote(fixture.reviewer)},now(),now(),'aal2');commit;`);
 actorSessions.set(fixture.requester,fixture.requesterSession);actorSessions.set(fixture.reviewer,fixture.reviewerSession);
 fixture.sourceHash=(await control.query(`select private.platform_account_source_hash_v1(${quote(fixture.target)});`)).at(-1);
 return fixture;
}
async function verifyBackendCleanup(){
 // A separate READ-ONLY connection checks the server, rather than trusting
 // DockerCLI exit. Never terminate a backend from a SQL WHERE expression:
 // PostgreSQL may reorder predicates ahead of their scope filters.
 const names=clients.map(client=>quote(client.applicationName)).join(',');
 const pids=clients.flatMap(client=>Number.isSafeInteger(client.pid)?[client.pid]:[]);
 const own=`datname=${quote(database)}and application_name in(${names})`;
 const query=()=>JSON.parse(docker(['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],{input:`begin read only;select jsonb_build_object('database',current_database(),'remaining',(select count(*)from pg_stat_activity where ${own}),'capturedPidsRemaining',(select count(*)from pg_stat_activity where datname=${quote(database)}and pid in(${pids.length?pids.join(','):'0'})));commit;`,stdio:['pipe','pipe','pipe']}).trim().split('\n').filter(line=>line.startsWith('{')).at(-1));
 const deadline=Date.now()+5000;let after;
 do{
  after=query();check(after.database===database,'CLEANUP_CLONE_DATABASE_REQUIRED');
  if(after.remaining===0&&after.capturedPidsRemaining===0)break;
  await new Promise(done=>setTimeout(done,100));
 }while(Date.now()<deadline);
 check(after.remaining===0&&after.capturedPidsRemaining===0,'OWN_POSTGRES_BACKENDS_MUST_BE_CLOSED');
 return{...after,readOnly:true,backendTerminationPerformed:false};
}
async function revocationCase(control,worker,revokedRole){
 const f=await createFixture(control,revokedRole);const key=`race-${runId}-${revokedRole}`;
 await actor(worker,f.requester);const request=await worker.json(requestSql(f.target,f.sourceHash,key));await worker.query('commit;');
 const requestId=request.request_id;
 await control.query("begin;select pg_advisory_xact_lock(hashtextextended('platform.account.access',0));");
 await actor(worker,f.reviewer);
 const decision=worker.query(`select public.decide_platform_account_change_v1(${quote(requestId)},true,${quote(f.sourceHash)},'Independent synthetic concurrency review','DEVELOPMENT',${quote(f.target)});`).then(()=>({state:'00000'}),error=>({state:error.sqlstate??error.message}));
 const waits=await waitAdvisory(control,[worker.pid],control.pid);
 await control.query(`update public.platform_user_roles set revoked_at=clock_timestamp()where user_id=${quote(f[revokedRole])}and role_code='MATRICIA_ADMIN'and revoked_at is null;commit;`);
 const result=await decision;await worker.query('rollback;');
 check(result.state==='42501',`${revokedRole.toUpperCase()}_REVOCATION_MUST_DENY`);
 const counts=await control.json(`select jsonb_build_object('requests',(select count(*)from public.platform_account_change_requests_v1 where id=${quote(requestId)}),'decisions',(select count(*)from public.platform_account_change_decisions_v1 where request_id=${quote(requestId)}),'sessions',(select count(*)from auth.sessions where user_id=${quote(f.target)}),'executionAudits',(select count(*)from public.audit_events where correlation_id=${quote(requestId)}and action='account.change.decided'),'executionOutbox',(select count(*)from public.event_outbox where aggregate_type='platform_account_change'and aggregate_id=${quote(requestId)}and event_type='PlatformAccountAccessChangedV1'));`);
 check(counts.requests===1&&counts.decisions===0&&counts.sessions===2&&counts.executionAudits===0&&counts.executionOutbox===0,`${revokedRole.toUpperCase()}_REVOCATION_HAS_NO_EXECUTION_EFFECT`);
 report.cases.push({name:`${revokedRole}_revoked_during_global_lock_wait`,status:'PASS',sqlstate:result.state,advisoryWaitersObserved:waits.length,counts});
}
let control,workerA,workerB;
try{
 control=new Session('control');workerA=new Session('workerA');workerB=new Session('workerB');
 for(const client of clients){
  const identity=await client.json("select jsonb_build_object('database',current_database(),'pid',pg_backend_pid(),'environment',(select environment from private.admin_execution_environment_v1 where singleton));");
  check(identity.database===database&&identity.environment==='DEVELOPMENT','TRUSTED_DEVELOPMENT_CLONE_REQUIRED');client.pid=identity.pid;
  await client.query("set statement_timeout='15s';");
 }
 report.runtimeFunctionSha256=hash((await control.query("select pg_get_functiondef('public.request_platform_account_change_v1(uuid,text,text,text,text,text,text,text)'::regprocedure)||pg_get_functiondef('public.decide_platform_account_change_v1(uuid,boolean,text,text,text,uuid)'::regprocedure);")).join('\n'));
 report.sessionGateRuntimeSha256=hash((await control.query("select pg_get_functiondef('private.current_auth_session_active_v1()'::regprocedure);")).join('\n'));
 await revocationCase(control,workerA,'reviewer');
 await revocationCase(control,workerA,'requester');
 const f=await createFixture(control,'idempotency');const key=`race-${runId}-same-key`;
 await control.query(`begin;select pg_advisory_xact_lock(hashtextextended(${quote(`platform.account.request:${f.requester}:${key}`)},0));`);
 await actor(workerA,f.requester);await actor(workerB,f.requester);
 const execute=client=>client.json(requestSql(f.target,f.sourceHash,key)).then(async result=>{await client.query('commit;');return{result};},async error=>{await client.query('rollback;');return{sqlstate:error.sqlstate??error.message};});
 const a=execute(workerA);const b=execute(workerB);
 const waits=await waitAdvisory(control,[workerA.pid,workerB.pid],control.pid);
 await control.query('commit;');const results=await Promise.all([a,b]);
 check(results.every(item=>item.result?.outcome==='ACCOUNT_CHANGE_REQUESTED'),'CONCURRENT_REQUESTS_MUST_BOTH_SUCCEED');
 check(results[0].result.request_id===results[1].result.request_id,'CONCURRENT_REQUESTS_MUST_HAVE_SAME_UUID');
 const requestId=results[0].result.request_id;
 const counts=await control.json(`select jsonb_build_object('requests',(select count(*)from public.platform_account_change_requests_v1 where created_by=${quote(f.requester)}and idempotency_key=${quote(key)}),'audits',(select count(*)from public.audit_events where correlation_id=${quote(requestId)}and action='account.change.requested'),'outbox',(select count(*)from public.event_outbox where aggregate_type='platform_account_change'and aggregate_id=${quote(requestId)}and event_type='PlatformAccountChangeRequestedV1'),'sessions',(select count(*)from auth.sessions where user_id=${quote(f.target)}));`);
 check(counts.requests===1&&counts.audits===1&&counts.outbox===1&&counts.sessions===2,'CONCURRENT_REQUESTS_MUST_EMIT_ONCE');
 report.cases.push({name:'same_actor_same_idempotency_overlapping_requests',status:'PASS',advisoryWaitersObserved:waits.length,returnedSameUuid:true,counts});
 check(hash(await readFile(source))===sourceHash&&hash(await readFile(sessionGateSource))===sessionGateSourceHash,'SOURCE_CHANGED_DURING_PROOF');report.status='PASS';
}catch(error){report.failure=error.sqlstate?`SQLSTATE_${error.sqlstate}`:/^[A-Z0-9_]+$/.test(error.message)?error.message:'HARNESS_FAILED';process.exitCode=1;}
finally{
 const closed=await Promise.allSettled(clients.map(client=>client.close()));
 try{report.backendCleanup=await verifyBackendCleanup();report.connectionsClosed=true;}catch{report.connectionsClosed=false;}
 report.clientProcessesClosed=closed.every(item=>item.status==='fulfilled')&&clients.every(client=>client.closed);
 if(!report.connectionsClosed||!report.clientProcessesClosed){report.status='FAILED';report.failure='CONNECTION_CLEANUP_FAILED';process.exitCode=1;}
 report.finishedAt=new Date().toISOString();report.durationMs=Date.parse(report.finishedAt)-Date.parse(startedAt);
 await writeFile(resolve(evidence,'summary.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(JSON.stringify(report,null,2));
}
