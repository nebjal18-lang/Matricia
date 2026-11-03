#!/usr/bin/env node
// Isolated PostgreSQL concurrency proof; no signed user JWT, payment or approval
// is fabricated. Historical publication/matching preconditions are declared.
import{spawn,execFileSync}from'node:child_process';
import{randomUUID,createHash}from'node:crypto';
import{readFile,mkdir,writeFile}from'node:fs/promises';
import{resolve,dirname}from'node:path';
import{fileURLToPath}from'node:url';
const database='matricia_delivery_ice_concurrency',container='supabase_db_Matricia',root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),runId=randomUUID(),clients=[];
const assert=(condition,code)=>{if(!condition)throw new Error(code);};
const quote=value=>`'${String(value).replaceAll("'","''")}'`,hash=value=>createHash('sha256').update(value).digest('hex');
const args=process.argv.slice(2),plan={database,container,mainDatabaseAccess:false,connections:3,fixtureMode:'SYNTHETIC_SQL_IDENTITIES_WITH_NATIVE_AUTH_SESSION_ROWS_AND_HISTORICAL_MATCHING',cleanup:'close only own connections; retain UUID fixtures in disposable clone; no backend cancellation or termination',cases:['financial suspension commits while open awaits financial advisory lock','identity anomaly commits while open awaits financial advisory lock','actor role revocation commits while open awaits financial advisory lock']};
assert(args.length===1&&['--plan','--execute'].includes(args[0]),'ARGUMENTS');if(args[0]==='--plan'){console.log(JSON.stringify(plan,null,2));process.exit(0);}
assert(process.env.APP_ENV==='development'&&process.env.LOCAL_CLIENT_RFQ_CLONE===database,'EXPLICIT_LOCAL_DEVELOPMENT_CLONE_REQUIRED');process.umask(0o077);
const dockerEnv={...process.env,DOCKER_HOST:'unix:///var/run/docker.sock'};for(const key of['DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete dockerEnv[key];
const docker=(parameters,options={})=>execFileSync('docker',parameters,{env:dockerEnv,encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe'],...options});
const inspected=JSON.parse(docker(['inspect','--format','{"name":{{json .Name}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}}}',container]));assert(inspected.name===`/${container}`&&inspected.running===true&&inspected.labels?.['com.supabase.cli.project']==='Matricia','LOCAL_SUPABASE_CONTAINER_REQUIRED');
const evidence=resolve(root,'work/client-rfq-concurrency',runId);await mkdir(evidence,{recursive:true,mode:0o700});
const report={...plan,runId,startedAt:new Date().toISOString(),status:'FAILED',assertions:0,cases:[],connectionsClosed:false};
function check(condition,code){report.assertions+=1;assert(condition,code);}
class Session{
 constructor(name){
  this.name=name;this.buffer='';this.pending=null;this.closed=false;
  // PostgreSQL truncates application_name at 63 bytes; keep the full run UUID.
  this.applicationName=`cfr-${runId}-${name}`;
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
 const original=await readFile(resolve(root,'supabase/tests/0213_client_request_tax_origins.test.sql'),'utf8');
 let source=original.slice(0,original.indexOf("select set_config('test.tax213_payload'"));assert(source.includes('questionnaire_versions set status'),'PUBLISHED_FIXTURE_REQUIRED');
 source=source.split('\n').filter(line=>!line.includes('select no_plan()')&&!line.startsWith('UPDATE private.admin_execution_environment_v1')&&!line.startsWith('insert into public.tax_categories')).join('\n');
 const ids=new Map(),mapped=value=>{if(!ids.has(value))ids.set(value,randomUUID());return ids.get(value);};for(const suffix of['001','002','003'])mapped(`a2130000-0000-4000-8000-000000000${suffix}`);source=source.replace(/a2130000-0000-4000-8000-[a-f0-9]{12}/g,mapped);
 const authColumns='id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at';
 const authValues=['001','002','003'].map(suffix=>{const user=ids.get(`a2130000-0000-4000-8000-000000000${suffix}`);return`(${quote(user)},'00000000-0000-0000-0000-000000000000','authenticated','authenticated',${quote(`rfq-${user}@example.invalid`)},'',now(),'{}','{}',now(),now())`;});
 source=source.split('\n').map(line=>line.startsWith('insert into auth.users(')?`insert into auth.users(${authColumns})values${authValues.join(',')};`:line).join('\n');
 const tag=`R${randomUUID().replaceAll('-','').slice(0,15).toUpperCase()}`;source=source.replaceAll('CANONICAL213',tag).replaceAll('canonical213',tag.toLowerCase()).replaceAll("'diagnostic213-'",quote(`rfq-${tag}-`));
 const actor=ids.get('a2130000-0000-4000-8000-000000000001'),organization=ids.get('a2130000-0000-4000-8000-000000000010'),membership=ids.get('a2130000-0000-4000-8000-000000000011'),library=ids.get('a2130000-0000-4000-8000-000000000100'),service=ids.get('a2130000-0000-4000-8000-000000000107'),questionnaire=ids.get('a2130000-0000-4000-8000-000000000201'),session=randomUUID(),request=randomUUID(),version=randomUUID(),matching=randomUUID();
 const fixtureSql=`${source}
 insert into auth.sessions(id,user_id,created_at,updated_at,aal)values(${quote(session)},${quote(actor)},now(),now(),'aal2');
 insert into public.service_requests(id,client_organization_id,library_id,service_id,questionnaire_version_id,status,created_by)values(${quote(request)},${quote(organization)},${quote(library)},${quote(service)},${quote(questionnaire)},'MATCHING',${quote(actor)});
 insert into public.service_request_versions(id,request_id,client_organization_id,library_id,version_number,description,urgency,required_quote_data,required_fields_complete,catalog_snapshot_hash,questionnaire_snapshot_hash,change_reason,content_hash,created_by)values(${quote(version)},${quote(request)},${quote(organization)},${quote(library)},1,'Historical matching precondition for isolated RFQ guard race','NORMAL','{"region_code":"CASABLANCA_SETTAT"}',true,repeat('a',64),repeat('b',64),'Declared concurrency reference precondition',repeat('d',64),${quote(actor)});
 update public.service_requests set current_version_id=${quote(version)}where id=${quote(request)};
 insert into public.matching_runs(id,request_id,request_version_id,policy_version,status,target_panel_size,started_by,completed_at)values(${quote(matching)},${quote(request)},${quote(version)},'MATCH-V1','COMPLETED',1,${quote(actor)},clock_timestamp());commit;`;await writeFile(resolve(evidence,`fixture-${tag}.sql`),fixtureSql,{mode:0o600});await control.query(fixtureSql);
 return{actor,organization,membership,session,request,version,matching};
}
async function actor(client,f){await client.query(`begin;set local role authenticated;set local lock_timeout='12s';set local statement_timeout='15s';select set_config('request.jwt.claim.sub',${quote(f.actor)},true);select set_config('request.jwt.claims',${quote(JSON.stringify({sub:f.actor,role:'authenticated',aal:'aal2',session_id:f.session}))},true);`);}
function probe(f,key){return`select pg_temp.open_rfq_probe(${quote(f.request)},${quote(f.matching)},${quote(key)});`;}
async function race(control,locker,worker,kind){
 const f=await setup(control),key=randomUUID();
 await actor(worker,f);const baseline=await worker.json(probe(f,randomUUID()));report.lastBaseline=baseline;check(baseline.state==='55000'&&baseline.reason==='NO_CURRENTLY_ELIGIBLE_PROVIDER','BASELINE_AUTHORITY_AND_FINANCIAL_GUARDS_PASS');await worker.query('rollback;');
 await locker.query(`begin;set local lock_timeout='12s';select pg_advisory_xact_lock(hashtextextended('subscription-financial:'||${quote(f.organization)},0));select id from public.service_requests where id=${quote(f.request)}for update;`);
 if(kind==='finance')await locker.query(`insert into public.subscriptions(organization_id,status)values(${quote(f.organization)},'SUSPENDED');`);
 if(kind==='identity'){const compliance=randomUUID();await locker.query(`insert into public.client_compliance_cases(id,organization_id,status,created_by)values(${quote(compliance)},${quote(f.organization)},'PROFILE_IN_PROGRESS',${quote(f.actor)});insert into public.client_administrative_anomalies(compliance_case_id,organization_id,anomaly_code,field_path,severity,blocking,status,client_message_fr,client_message_ar,detected_by)values(${quote(compliance)},${quote(f.organization)},'ICE_NOT_VERIFIED','organization.ICE','CRITICAL',true,'OPEN','Synthetic race identity review','مراجعة هوية اصطناعية للاختبار','RULE_ENGINE');`);}
 if(kind==='role')await locker.query(`update public.organization_member_roles set revoked_at=clock_timestamp()where membership_id=${quote(f.membership)}and role_code='CLIENT_OWNER';`);
 await actor(worker,f);const waiting=worker.json(probe(f,key));waiting.catch(()=>{});
 const deadline=Date.now()+8000;let blocked=false;while(Date.now()<deadline){const state=await control.json(`select jsonb_build_object('wait',wait_event,'type',wait_event_type,'blockers',pg_blocking_pids(pid))from pg_stat_activity where datname=${quote(database)}and pid=${worker.pid};`);if(state.wait==='advisory'&&state.type==='Lock'&&state.blockers.includes(locker.pid)){blocked=true;break;}await new Promise(done=>setTimeout(done,50));}
 check(blocked,'FINANCIAL_ADVISORY_WAIT_OBSERVED_BEFORE_REQUEST_LOCK');await locker.query('commit;');
 const outcome=await waiting;check(outcome.state==='42501'&&outcome.reason===(kind==='role'?'REQUEST_SCOPE_DENIED':'CLIENT_REQUEST_NOT_ENTITLED'),'CURRENT_COMMITTED_RESTRICTION_REFUSED');await worker.query('rollback;');
 const counts=await control.json(`select jsonb_build_object('rfqs',(select count(*)from public.rfqs where request_id=${quote(f.request)}),'opened_audits',(select count(*)from public.audit_events where resource_type='rfq'and action='rfq.opened'and organization_id=${quote(f.organization)}),'outbox',(select count(*)from public.event_outbox where event_type='RFQ_OPENED'and organization_id=${quote(f.organization)}),'status',(select status from public.service_requests where id=${quote(f.request)}),'versions',(select count(*)from public.service_request_versions where request_id=${quote(f.request)}),'credits',(select count(*)from public.credit_ledger_entries where organization_id=${quote(f.organization)}));`);
 check(counts.rfqs===0&&counts.opened_audits===0&&counts.outbox===0&&counts.status==='MATCHING'&&counts.versions===1&&counts.credits===0,'NO_BUSINESS_OR_FINANCIAL_SIDE_EFFECT_AFTER_CONCURRENT_REFUSAL');report.cases.push({kind,wait:'financial advisory observed',outcome:outcome.reason,noBusinessSideEffect:true});
}
let control,locker,worker;
try{
 control=new Session('control');locker=new Session('locker');worker=new Session('worker');
 for(const client of[control,locker,worker])client.pid=Number((await client.query('select pg_backend_pid();')).at(-1));
 const installed=await control.json(`select jsonb_build_object('database',current_database(),'source',pg_get_functiondef('public.open_service_request_rfq(uuid,uuid,timestamptz,text,uuid)'::regprocedure));`);check(installed.database===database,'EXACT_DISPOSABLE_DATABASE');check(installed.source.includes('RFQ_OPEN_MFA_REQUIRED')&&installed.source.indexOf('subscription-financial:')<installed.source.indexOf('service-request:'),'INSTALLED_GUARD_LOCK_ORDER');report.installedSourceSha256=hash(installed.source);report.sourceSha256=hash(await readFile(resolve(root,'supabase/migrations/20261031266120_client_rfq_commitment_serialization.sql')));
 await worker.query(`create function pg_temp.open_rfq_probe(p_request uuid,p_matching uuid,p_key text)returns jsonb language plpgsql security invoker as $$begin perform public.open_service_request_rfq(p_request,p_matching,statement_timestamp()+interval'7 days',p_key);return jsonb_build_object('state','00000','reason','UNEXPECTED_RFQ_OPENED');exception when others then return jsonb_build_object('state',sqlstate,'reason',case when sqlerrm~'^[A-Z0-9_]+$'then sqlerrm else'UNCLASSIFIED_DATABASE_FAILURE'end);end$$;`);
 for(const kind of['finance','identity','role'])await race(control,locker,worker,kind);
 report.status='PASSED';
}catch(error){report.failureCode=/^[A-Z0-9_]+$/.test(error.message)?error.message:'HARNESS_OPERATION_FAILED';}
finally{
 for(const client of[locker,worker,control].filter(Boolean)){try{await client.close();}catch{report.cleanupFailure='OWN_CONNECTION_CLOSE_FAILED';}}
 try{const remaining=Number(docker(['exec',container,'psql','-X','-qAt','-U','postgres','-d',database,'-c',`select count(*)from pg_stat_activity where datname=${quote(database)}and application_name like ${quote(`cfr-${runId}-%`)};`]).trim());report.connectionsClosed=remaining===0;}catch{report.connectionsClosed=false;}
 if(!report.connectionsClosed||report.cleanupFailure)report.status='FAILED';report.finishedAt=new Date().toISOString();await writeFile(resolve(evidence,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(report,null,2));
}
if(report.status!=='PASSED')process.exitCode=1;
