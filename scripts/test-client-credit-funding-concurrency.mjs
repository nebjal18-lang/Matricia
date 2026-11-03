#!/usr/bin/env node
// Disposable-clone proof of financial→wallet ordering for credit admissions.
import{spawn,execFileSync}from'node:child_process';
import{randomUUID,createHash}from'node:crypto';
import{readFile,mkdir,writeFile}from'node:fs/promises';
import{resolve,dirname}from'node:path';
import{fileURLToPath}from'node:url';
const database='matricia_delivery_ice_concurrency',container='supabase_db_Matricia',root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),runId=randomUUID(),clients=[];
const assert=(v,code)=>{if(!v)throw new Error(code)},quote=v=>`'${String(v).replaceAll("'","''")}'`,hash=v=>createHash('sha256').update(v).digest('hex');
const args=process.argv.slice(2),plan={database,container,mainDatabaseAccess:false,connections:3,fixtureMode:'SYNTHETIC_SQL_ACTOR_WITH_NATIVE_AUTH_SESSION_ROW_AND_SYNTHETIC_PAYMENT_COMMANDS',cleanup:'close only own connections; retain UUID fixtures in disposable clone; no backend cancellation or termination',cases:['subscription grant waits on financial lock before taking wallet; committed hold refuses it','reservation waits on financial lock before taking wallet; committed hold refuses it']};
assert(args.length===1&&['--plan','--execute'].includes(args[0]),'ARGUMENTS');if(args[0]==='--plan'){console.log(JSON.stringify(plan,null,2));process.exit(0);}
assert(process.env.APP_ENV==='development'&&process.env.LOCAL_CLIENT_CREDIT_CLONE===database,'EXPLICIT_LOCAL_DEVELOPMENT_CLONE_REQUIRED');process.umask(0o077);
const dockerEnv={...process.env,DOCKER_HOST:'unix:///var/run/docker.sock'};for(const key of['DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
const docker=(parameters,options={})=>execFileSync('docker',parameters,{env:dockerEnv,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe'],...options});
const inspected=JSON.parse(docker(['inspect','--format','{"name":{{json .Name}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}}}',container]));assert(inspected.name===`/${container}`&&inspected.running===true&&inspected.labels?.['com.supabase.cli.project']==='Matricia','LOCAL_SUPABASE_CONTAINER_REQUIRED');
const evidence=resolve(root,'work/client-credit-concurrency',runId);await mkdir(evidence,{recursive:true,mode:0o700});
const report={...plan,runId,startedAt:new Date().toISOString(),status:'FAILED',assertions:0,cases:[],connectionsClosed:false};
function check(v,code){report.assertions+=1;assert(v,code);}
class Session{
 constructor(name){
  this.name=name;this.buffer='';this.pending=null;this.closed=false;
  // PostgreSQL truncates application_name at 63 bytes; keep the full run UUID.
  this.applicationName=`ccf-${runId}-${name}`;
  this.child=spawn('docker',['exec','-i','--env',`PGAPPNAME=${this.applicationName}`,container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{env:dockerEnv,stdio:['pipe','pipe','pipe']});
  // Never emit stderr: it can contain synthetic emails or complete SQL text.
  this.child.stderr.on('data',bytes=>{const match=bytes.toString('utf8').match(/ERROR:\s*([A-Z0-9]{5})/);if(match)this.sqlstate=match[1];});
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
  this.child.on('exit',()=>{this.closed=true;this.fail(this.sqlstate?`PSQL_${this.sqlstate}`:'PSQL_CLOSED');});
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
  if(this.closed)return;
  const exited=new Promise(done=>this.child.once('exit',done));
  this.child.stdin.end('rollback;\n\\q\n');
  let timer;try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('OWN_CONNECTION_CLOSE_TIMEOUT')),18000);})]);}finally{clearTimeout(timer);}
 }
}

async function setup(control){
 let source=await readFile(resolve(root,'supabase/tests/0246_credit_lot_canonical_funding.test.sql'),'utf8');source=source.slice(0,source.indexOf("select is((select v#>>'{terms,quantity}'"));
 source=source.replace('select no_plan();','');const ids=new Map(),mapped=id=>{if(!ids.has(id))ids.set(id,randomUUID());return ids.get(id)};source=source.replace(/[a-f]2460000-0000-4000-8000-[0-9a-f]{12}/g,mapped);
 const tag=`C${runId.replaceAll('-','').slice(0,12).toUpperCase()}`;source=source.replaceAll('FUNDING_246',tag).replaceAll('FUNDING_BENEFIT_246',`${tag}_BENEFIT`).replaceAll('funding246',tag.toLowerCase()).replaceAll('SYNTHETIC-DEMO-EVENT-246',`${tag}-DEMO-EVENT`).replaceAll('SYNTHETIC-CLONE-DEMO-ORDER-246',`${tag}-DEMO-ORDER`).replaceAll('SYNTHETIC-DEMO-CAPTURE-246',`${tag}-DEMO-CAPTURE`).replaceAll('owner-246@example.invalid',`owner-${runId}@example.invalid`).replaceAll('intruder-246@example.invalid',`other-${runId}@example.invalid`);
 const actor=ids.get('a2460000-0000-4000-8000-000000000001'),organization=ids.get('b2460000-0000-4000-8000-000000000001'),benefit=ids.get('f2460000-0000-4000-8000-000000000005'),session=randomUUID();
 await control.query(`${source}
insert into auth.sessions(id,user_id,created_at,updated_at,aal)values(${quote(session)},${quote(actor)},now(),now(),'aal2');commit;`);
 const data=await control.json("select jsonb_build_object('payment',(select id::text from public.subscription_payment_events where provider_event_id="+quote(`${tag}-DEMO-EVENT`)+"),'wallet',(select v->>'wallet_id'from p246 where k='wallet'),'terms_hash',(select v#>>'{terms,terms_hash}'from p246 where k='terms'));");
 return{actor,organization,benefit,session,...data};
}
async function actor(client,f){await client.query(`begin;set local lock_timeout='12s';set local statement_timeout='15s';select set_config('request.jwt.claim.sub',${quote(f.actor)},true);select set_config('request.jwt.claims',${quote(JSON.stringify({sub:f.actor,role:'authenticated',aal:'aal2',session_id:f.session}))},true);`);}
function operation(f,kind,key){return kind==='issue'?`select public.issue_subscription_credit_grant_v1(${quote(f.organization)},${quote(f.payment)}::bigint,1,${quote(f.terms_hash)},${quote(key)});`:`select public.reserve_benefit_credits(${quote(f.organization)},${quote(f.wallet)},${quote(f.benefit)},1,clock_timestamp()+interval'1 day',${quote(key)});`;}
function probe(f,kind,key){return`select pg_temp.credit_probe(${quote(operation(f,kind,key))});`;}
async function counts(control,f){return control.json(`select jsonb_build_object('entries',(select count(*)from public.credit_ledger_entries where organization_id=${quote(f.organization)}),'lots',(select count(*)from public.credit_lots where organization_id=${quote(f.organization)}),'movements',(select count(*)from public.credit_lot_movements where organization_id=${quote(f.organization)}),'outbox',(select count(*)from public.event_outbox where organization_id=${quote(f.organization)}),'audit',(select count(*)from public.audit_events where organization_id=${quote(f.organization)}));`);}
async function race(control,locker,worker,f,kind){
 await actor(worker,f);const baseline=await worker.json(probe(f,kind,randomUUID()));check(baseline.state==='00000','BASELINE_REAL_CREDIT_COMMAND_SUCCEEDS');await worker.query('rollback;');
 const before=await counts(control,f);
 await locker.query(`begin;select pg_advisory_xact_lock(hashtextextended('subscription-financial:'||${quote(f.organization)},0));insert into public.subscription_financial_holds(payment_event_id,organization_id,active,reason_code)values(${quote(f.payment)}::bigint,${quote(f.organization)},true,'CONCURRENCY_FIXTURE')on conflict(payment_event_id)do update set active=true,reason_code='CONCURRENCY_FIXTURE';`);
 await actor(worker,f);const waiting=worker.json(probe(f,kind,randomUUID()));waiting.catch(()=>{});
 let blocked=false;const until=Date.now()+8000;while(Date.now()<until){const state=await control.json(`select jsonb_build_object('wait',wait_event,'type',wait_event_type,'blockers',pg_blocking_pids(pid))from pg_stat_activity where datname=${quote(database)}and pid=${worker.pid};`);if(state.wait==='advisory'&&state.type==='Lock'&&state.blockers.includes(locker.pid)){blocked=true;break;}await new Promise(done=>setTimeout(done,50));}
 check(blocked,'FINANCIAL_ADVISORY_WAIT_OBSERVED');
 const free=await control.json(`begin;select pg_temp.wallet_probe(${quote(f.wallet)});`);check(free.walletFree===true,'WAITER_HAS_NOT_ACQUIRED_WALLET_BEFORE_FINANCIAL_LOCK');await control.query('rollback;');
 await locker.query('commit;');const outcome=await waiting;check(outcome.state==='55000'&&outcome.reason==='SUBSCRIPTION_FINANCIAL_HOLD'||kind==='reserve'&&outcome.state==='23514'&&outcome.reason==='INSUFFICIENT_ELIGIBLE_CREDITS','CURRENT_COMMITTED_FUNDING_HOLD_REFUSED');await worker.query('rollback;');
 const after=await counts(control,f);check(JSON.stringify(before)===JSON.stringify(after),'NO_CREDIT_OR_AUDIT_OUTBOX_SIDE_EFFECT_ON_REFUSAL');report.cases.push({kind,financialWaitObserved:true,walletFreeWhileWaiting:true,outcome:outcome.reason,noBusinessSideEffect:true});
 await control.query(`update public.subscription_financial_holds set active=false,reason_code='CONCURRENCY_FIXTURE_RELEASED'where payment_event_id=${quote(f.payment)}::bigint;`);
}
let control,locker,worker;
try{
 control=new Session('control');locker=new Session('locker');worker=new Session('worker');for(const client of[control,locker,worker])client.pid=Number((await client.query('select pg_backend_pid();')).at(-1));
 const installed=await control.json("select jsonb_build_object('database',current_database(),'issue',pg_get_functiondef('public.issue_credits(uuid,uuid,text,bigint,timestamptz,uuid,text,bigint,text,text,text,uuid)'::regprocedure),'reserve',pg_get_functiondef('public.reserve_benefit_credits(uuid,uuid,uuid,bigint,timestamptz,text,uuid)'::regprocedure));");check(installed.database===database,'EXACT_DISPOSABLE_DATABASE');check(installed.issue.indexOf('subscription-financial:')<installed.issue.indexOf('select wallet_type into wallet_kind')&&installed.reserve.indexOf('subscription-financial:')<installed.reserve.indexOf('perform 1 from public.credit_wallets'),'INSTALLED_FINANCIAL_BEFORE_WALLET_ORDER');report.installedSourceSha256=hash(installed.issue+installed.reserve);report.sourceSha256=hash(await readFile(resolve(root,'supabase/migrations/20261031268010_credit_lot_canonical_payment_funding.sql')));
 await worker.query(`create function pg_temp.credit_probe(p_command text)returns jsonb language plpgsql security invoker as $$begin execute p_command;return jsonb_build_object('state','00000','reason','COMPLETED');exception when others then return jsonb_build_object('state',sqlstate,'reason',case when sqlerrm~'^[A-Z0-9_]+$'then sqlerrm else'UNCLASSIFIED_DATABASE_FAILURE'end);end$$;`);
 await control.query(`create function pg_temp.wallet_probe(p_wallet uuid)returns jsonb language plpgsql security invoker as $$begin perform 1 from public.credit_wallets where id=p_wallet for update nowait;return jsonb_build_object('walletFree',true);exception when lock_not_available then return jsonb_build_object('walletFree',false);end$$;`);
 const f=await setup(control);await race(control,locker,worker,f,'issue');
 await actor(control,f);await control.query(operation(f,'issue',randomUUID()));await control.query('commit;');await race(control,locker,worker,f,'reserve');report.status='PASSED';
}catch(error){report.failureCode=/^[A-Z0-9_]+$/.test(error.message)?error.message:'HARNESS_OPERATION_FAILED';}
finally{
 for(const client of[locker,worker,control].filter(Boolean)){try{await client.close();}catch{report.cleanupFailure='OWN_CONNECTION_CLOSE_FAILED';}}
 try{report.connectionsClosed=Number(docker(['exec',container,'psql','-X','-qAt','-U','postgres','-d',database,'-c',`select count(*)from pg_stat_activity where datname=${quote(database)}and application_name like ${quote(`ccf-${runId}-%`)};`]).trim())===0;}catch{report.connectionsClosed=false;}
 if(!report.connectionsClosed||report.cleanupFailure)report.status='FAILED';report.finishedAt=new Date().toISOString();await writeFile(resolve(evidence,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2));
}
if(report.status!=='PASSED')process.exitCode=1;
