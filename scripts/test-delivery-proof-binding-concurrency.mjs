#!/usr/bin/env node
// Local SQL/RLS proof only. Fixtures are synthetic; no Storage bytes or user
// cryptographic JWTs are fabricated. Root later drops the disposable clone.
import {spawn,execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const database='matricia_delivery_ice_concurrency';
const container='supabase_db_Matricia';
const args=process.argv.slice(2);
const assert=(condition,code)=>{if(!condition)throw new Error(code);};
assert(args.length===1&&['--plan','--execute'].includes(args[0]),'ARGUMENTS');
const plan={database,container,connections:2,mainDatabaseAccess:false,scope:'SQL_STORAGE_METADATA_NO_PHYSICAL_BYTES',fixtureMode:'SYNTHETIC_HISTORICAL_MISSION_SQL_ACTOR_BOUND_SESSION_NO_USER_JWT',cleanup:'close own clients; SELECT-only backend verification; retain UUID fixtures for root clone drop',cases:['bind first; owner delete waits and cannot orphan proof','delete first; binder waits and cannot bind missing object']};
if(args[0]==='--plan'){console.log(JSON.stringify(plan,null,2));process.exit(0);}
assert(process.env.APP_ENV==='development','DEVELOPMENT_REQUIRED');
assert(process.env.LOCAL_DELIVERY_PROOF_CLONE===database,'EXPLICIT_DISPOSABLE_CLONE_REQUIRED');
process.umask(0o077);
const dockerEnv={...process.env,DOCKER_HOST:'unix:///var/run/docker.sock'};
for(const key of ['DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
const docker=(parameters,options={})=>execFileSync('docker',parameters,{env:dockerEnv,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe'],...options});
const inspected=JSON.parse(docker(['inspect','--format','{"name":{{json .Name}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}}}',container]));
assert(inspected.name===`/${container}`&&inspected.running===true,'LOCAL_SUPABASE_CONTAINER_REQUIRED');
assert(inspected.labels?.['com.supabase.cli.project']==='Matricia'&&inspected.labels?.['com.docker.compose.project']==='Matricia','LOCAL_SUPABASE_LABELS_REQUIRED');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runId=randomUUID();const clients=[];const startedAt=new Date().toISOString();
const evidence=resolve(root,'work/delivery-proof-concurrency',runId);await mkdir(evidence,{recursive:true,mode:0o700});
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const hash=value=>createHash('sha256').update(value).digest('hex');
const migration=resolve(root,'supabase/migrations/20261031264021_delivery_proof_storage_binding.sql');
const fixture=resolve(root,'supabase/tests/0244_delivery_proof_storage_scope.test.sql');
const recipe=fileURLToPath(import.meta.url);
const sources=async()=>({migration:hash(await readFile(migration)),fixture:hash(await readFile(fixture)),recipe:hash(await readFile(recipe))});
const sourceHashes=await sources();
const report={...plan,runId,startedAt,sourceHashes,status:'FAILED',assertions:0,cases:[],connectionsClosed:false};
const check=(condition,code)=>{report.assertions+=1;assert(condition,code);};
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
async function runtimeFingerprint(client){
 const value=await client.json(`select jsonb_build_object('binder',pg_get_functiondef('private.bind_delivery_proof_storage()'::regprocedure),'absenceHelper',pg_get_functiondef('private.delivery_proof_storage_owner_unbound_v1(text,text)'::regprocedure),'foreignKey',(select pg_get_constraintdef(oid)from pg_constraint where conrelid='public.delivery_proofs'::regclass and conname='delivery_proofs_storage_object_binding_v1'),'policies',(select jsonb_agg(jsonb_build_array(policyname,qual)order by policyname)from pg_policies where schemaname='storage'and tablename='objects'and policyname in('delivery_proof_storage_owner_unbound_read','delivery_proof_storage_orphan_delete','delivery_proof_storage_party_read')));`);
 check(Boolean(value.foreignKey?.includes('FOREIGN KEY')),'NATIVE_BINDING_FK_REQUIRED');return hash(JSON.stringify(value));
}
async function verifyBackendCleanup(){
 // This connection is READ ONLY. No SQL cancellation or termination is used.
 const names=clients.map(client=>quote(client.applicationName)).join(',');
 const pids=clients.flatMap(client=>Number.isSafeInteger(client.pid)?[client.pid]:[]);
 const input=`begin read only;select jsonb_build_object('database',current_database(),'remaining',(select count(*)from pg_stat_activity where datname=${quote(database)}and application_name in(${names})),'capturedPidsRemaining',(select count(*)from pg_stat_activity where datname=${quote(database)}and pid in(${pids.length?pids.join(','):'0'})));commit;`;
 const end=Date.now()+5000;let result;
 do{
  const lines=docker(['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],{input,stdio:['pipe','pipe','pipe']}).trim().split('\n');result=JSON.parse(lines.find(line=>line.startsWith('{')));
  if(result.database===database&&result.remaining===0&&result.capturedPidsRemaining===0)break;
  await new Promise(done=>setTimeout(done,100));
 }while(Date.now()<end);
 check(result.database===database&&result.remaining===0&&result.capturedPidsRemaining===0,'OWN_BACKENDS_MUST_BE_CLOSED');
 return{...result,readOnly:true,backendTerminationPerformed:false};
}
let control,worker;
try{
 const source=await readFile(fixture,'utf8');const cut=source.indexOf('insert into public.delivery_proofs');
 check(cut>0&&source.slice(0,cut).includes('insert into public.delivery_versions'),'FIXTURE_SEED_CONTRACT_REQUIRED');
 // Only the committed security fixture's upstream synthetic facts are copied.
 // Remove its pgTAP/temporary observations and grant/config mutations. All
 // entity UUIDs and emails are remapped to this run; no old fixture is touched.
 let setup=source.slice(0,cut).replace(/^select plan\(\d+\);\n/m,'').replace(/^update private\.admin_execution_environment_v1[^\n]*\n/m,'').replace(/^grant [^\n]*\n/gm,'').replace(/^create temporary table storage244_observed[^\n]*\n/m,'').replace(/^insert into storage244_observed[^\n]*\n/gm,'');
 const mapping=new Map();setup=setup.replace(/f244[a-f0-9]{4}-[a-f0-9-]{27}/g,old=>{if(!mapping.has(old))mapping.set(old,randomUUID());return mapping.get(old);}).replaceAll('p244-',`race-${runId}-`);
 const id=old=>{check(mapping.has(old),'FIXTURE_ID_REQUIRED');return mapping.get(old);};
 const provider=id('f2440000-0000-4000-8000-000000000002');const version=id('f2440010-0000-4000-8000-000000000001');const deliverable=id('f244000a-0000-4000-8000-000000000001');const session=randomUUID();
 const path=file=>`${provider}/${deliverable}/${file}`;
 const actor=async(client,asAuthenticated=false)=>{await client.query(`begin;set local statement_timeout='12s';set local storage.allow_delete_query='true';${asAuthenticated?'set local role authenticated;':''}select set_config('request.jwt.claims',${quote(JSON.stringify({sub:provider,role:'authenticated',aal:'aal1',session_id:session}))},true);`);};
 const bind=(proof,file)=>`insert into public.delivery_proofs(id,delivery_version_id,proof_type,storage_path,evidence_hash,metadata,created_by)values(${quote(proof)},${quote(version)},'DOCUMENT',${quote(path(file))},repeat('b',64),'{}',${quote(provider)});`;
 control=new Session('proof-control');worker=new Session('proof-worker');
 for(const client of clients){
  const identity=await client.json("select jsonb_build_object('database',current_database(),'pid',pg_backend_pid(),'environment',(select environment from private.admin_execution_environment_v1 where singleton));");
  check(identity.database===database&&identity.environment==='DEVELOPMENT','TRUSTED_DEVELOPMENT_CLONE_REQUIRED');client.pid=identity.pid;
 }
 report.runtimeSha256=await runtimeFingerprint(control);
 await control.query(setup+`insert into auth.sessions(id,user_id,created_at,updated_at,aal)values(${quote(session)},${quote(provider)},now(),now(),'aal1');commit;`);
 const wait=async()=>{const end=Date.now()+5000;while(Date.now()<end){
  const value=await control.json(`select jsonb_build_object('type',wait_event_type,'event',wait_event,'blockers',pg_blocking_pids(pid))from pg_stat_activity where datname=${quote(database)}and pid=${worker.pid};`);
  if(value.type==='Lock'&&value.blockers.includes(control.pid))return{type:value.type,event:value.event};
  await new Promise(done=>setTimeout(done,30));
 }throw new Error('LOCK_OVERLAP_NOT_OBSERVED');};
 await actor(control);const proofA=randomUUID();await control.query(bind(proofA,'pending.pdf'));
 await actor(worker,true);
 const deletion=worker.json(`with removed as(delete from storage.objects where bucket_id='delivery-proofs'and name=${quote(path('pending.pdf'))}returning 1)select jsonb_build_object('deleted',count(*))from removed;`).then(value=>({sqlstate:'00000',...value}),error=>({sqlstate:error.sqlstate??error.message}));
 const waitA=await wait();await control.query('commit;');const deleteResult=await deletion;await worker.query('rollback;');
 const countsA=await control.json(`select jsonb_build_object('objects',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name=${quote(path('pending.pdf'))}),'bindings',(select count(*)from public.delivery_proofs where id=${quote(proofA)}));`);
 check((deleteResult.sqlstate==='23503'||deleteResult.deleted===0)&&countsA.objects===1&&countsA.bindings===1,'BOUND_OBJECT_DELETION_RACE');
 report.cases.push({name:'bind_first_owner_delete_waits',wait:waitA,result:deleteResult,counts:countsA});
 await actor(control);await control.query(`delete from storage.objects where bucket_id='delivery-proofs'and name=${quote(path('clean.pdf'))};`);
 await actor(worker);const proofB=randomUUID();
 const binding=worker.query(bind(proofB,'clean.pdf')).then(()=>({sqlstate:'00000'}),error=>({sqlstate:error.sqlstate??error.message}));
 const waitB=await wait();await control.query('commit;');const bindResult=await binding;await worker.query('rollback;');
 const countsB=await control.json(`select jsonb_build_object('objects',(select count(*)from storage.objects where bucket_id='delivery-proofs'and name=${quote(path('clean.pdf'))}),'bindings',(select count(*)from public.delivery_proofs where id=${quote(proofB)}));`);
 check(bindResult.sqlstate==='22000'&&countsB.objects===0&&countsB.bindings===0,'DELETED_OBJECT_BINDING_RACE');
 report.cases.push({name:'delete_first_binder_waits',wait:waitB,result:bindResult,counts:countsB});
 check(JSON.stringify(await sources())===JSON.stringify(sourceHashes),'SOURCE_CHANGED_DURING_PROOF');
 check(await runtimeFingerprint(control)===report.runtimeSha256,'RUNTIME_CHANGED_DURING_PROOF');report.status='PASS';
}catch(error){report.failure=error.sqlstate?`SQLSTATE_${error.sqlstate}`:/^[A-Z0-9_]+$/.test(error.message)?error.message:'HARNESS_FAILED';process.exitCode=1;}
finally{
 const closed=await Promise.allSettled(clients.map(client=>client.close()));
 report.clientProcessesClosed=closed.every(item=>item.status==='fulfilled')&&clients.every(client=>client.closed);
 try{report.backendCleanup=await verifyBackendCleanup();report.connectionsClosed=true;}catch{report.connectionsClosed=false;}
 if(!report.connectionsClosed||!report.clientProcessesClosed){report.status='FAILED';report.failure='CONNECTION_CLEANUP_FAILED';process.exitCode=1;}
 report.finishedAt=new Date().toISOString();report.durationMs=Date.parse(report.finishedAt)-Date.parse(startedAt);
 await writeFile(resolve(evidence,'summary.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2));
}
